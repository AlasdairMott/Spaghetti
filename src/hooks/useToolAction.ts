import { useCallback, useState, useEffect, useRef } from "react";
import { useAppStore } from "../store";
import { snapToGrid, gridToMm } from "../utils/grid";
import { HIT_RADIUS } from "../constants/grid";
import type { MmPoint, PanelComponent, ConnectionKind, ComponentKind, PanelRect } from "../models/types";

interface ResolvedEndpoint {
  point: MmPoint;
  offset: number;
}

/** Auto-offset when connecting to a component, so the line clears the symbol */
const COMPONENT_OFFSET: Record<ComponentKind, number> = {
  pot: 7.5,
  jack: 4.5,
  button: 3.5,
};

/** Snap to nearest component center if within HIT_RADIUS, else snap to grid */
function resolveEndpoint(svgX: number, svgY: number, components: PanelComponent[]): ResolvedEndpoint {
  for (const comp of components) {
    const mm = gridToMm(comp.position);
    const dist = Math.hypot(svgX - mm.x, svgY - mm.y);
    if (dist <= HIT_RADIUS) {
      return { point: { x: mm.x, y: mm.y }, offset: COMPONENT_OFFSET[comp.kind] };
    }
  }
  const grid = snapToGrid(svgX, svgY);
  const mm = gridToMm(grid);
  return { point: { x: mm.x, y: mm.y }, offset: 0 };
}

/** Hit-test a point against the border of a rect (within tolerance) */
function hitTestRect(px: number, py: number, rect: PanelRect, tol = 1.5): boolean {
  const x1 = Math.min(rect.from.x, rect.to.x);
  const y1 = Math.min(rect.from.y, rect.to.y);
  const x2 = Math.max(rect.from.x, rect.to.x);
  const y2 = Math.max(rect.from.y, rect.to.y);
  if (px < x1 - tol || px > x2 + tol || py < y1 - tol || py > y2 + tol) return false;
  // Inside the inner (inset) region → not a border hit
  if (px > x1 + tol && px < x2 - tol && py > y1 + tol && py < y2 - tol) return false;
  return true;
}

/** Point-to-line-segment distance */
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function useToolAction() {
  const activeTool = useAppStore((s) => s.activeTool);
  const editingModule = useAppStore((s) => s.editingModule);
  const addComponent = useAppStore((s) => s.addComponent);
  const addConnection = useAppStore((s) => s.addConnection);
  const selectComponent = useAppStore((s) => s.selectComponent);
  const selectComponents = useAppStore((s) => s.selectComponents);
  const selectedComponentIds = useAppStore((s) => s.selectedComponentIds);
  const selectConnection = useAppStore((s) => s.selectConnection);
  const selectRect = useAppStore((s) => s.selectRect);

  const [lineStart, setLineStart] = useState<MmPoint | null>(null);
  const startOffsetRef = useRef(0);

  // Clear pending starts when tool changes
  useEffect(() => {
    setLineStart(null);
    startOffsetRef.current = 0;
  }, [activeTool]);

  const handleCanvasClick = useCallback(
    (svgX: number, svgY: number, shiftKey = false) => {
      if (!editingModule) return;

      switch (activeTool) {
        case "addJack": {
          const pos = snapToGrid(svgX, svgY);
          addComponent("jack", pos);
          break;
        }
        case "addPot": {
          const pos = snapToGrid(svgX, svgY);
          addComponent("pot", pos);
          break;
        }
        case "addButton": {
          const pos = snapToGrid(svgX, svgY);
          addComponent("button", pos);
          break;
        }
        case "addLine":
        case "addArrow": {
          const kind: ConnectionKind = activeTool === "addLine" ? "line" : "arrow";
          const resolved = resolveEndpoint(svgX, svgY, editingModule.components);
          if (!lineStart) {
            setLineStart(resolved.point);
            startOffsetRef.current = resolved.offset;
          } else {
            addConnection(kind, lineStart, resolved.point, startOffsetRef.current, resolved.offset);
            setLineStart(null);
            startOffsetRef.current = 0;
          }
          break;
        }
        case "select": {
          // Hit-test components first
          let hitId: string | null = null;
          for (const comp of editingModule.components) {
            const mm = gridToMm(comp.position);
            const dx = svgX - mm.x;
            const dy = svgY - mm.y;
            if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS) {
              hitId = comp.id;
              break;
            }
          }
          if (hitId) {
            if (shiftKey) {
              // Toggle in/out of current selection
              const current = selectedComponentIds;
              if (current.includes(hitId)) {
                selectComponents(current.filter((id) => id !== hitId));
              } else {
                selectComponents([...current, hitId]);
              }
            } else {
              selectComponent(hitId);
            }
            break;
          }

          // Hit-test connections
          const connections = editingModule.connections ?? [];
          let hitConnId: string | null = null;
          for (const conn of connections) {
            const dist = distToSegment(svgX, svgY, conn.from.x, conn.from.y, conn.to.x, conn.to.y);
            if (dist <= 1.5) {
              hitConnId = conn.id;
              break;
            }
          }
          if (hitConnId) {
            selectConnection(hitConnId);
            break;
          }

          // Hit-test rects (border only)
          const rects = editingModule.rects ?? [];
          let hitRectId: string | null = null;
          for (const rect of rects) {
            if (hitTestRect(svgX, svgY, rect)) {
              hitRectId = rect.id;
              break;
            }
          }
          if (hitRectId) {
            selectRect(hitRectId);
          } else if (!shiftKey) {
            selectComponent(null);
          }
          break;
        }
      }
    },
    [activeTool, editingModule, addComponent, addConnection, selectComponent, selectComponents, selectedComponentIds, selectConnection, selectRect, lineStart]
  );

  return { handleCanvasClick, lineStart };
}
