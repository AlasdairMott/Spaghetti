import { useCallback, useState, useEffect, useRef } from "react";
import { useAppStore } from "../store";
import { snapToGrid, gridToMm } from "../utils/grid";
import { HIT_RADIUS } from "../constants/grid";
import type { MmPoint, PanelComponent, ConnectionKind, ComponentKind } from "../models/types";

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
  const selectConnection = useAppStore((s) => s.selectConnection);

  const [lineStart, setLineStart] = useState<MmPoint | null>(null);
  const startOffsetRef = useRef(0);

  // Clear pending line start when tool changes
  useEffect(() => {
    setLineStart(null);
    startOffsetRef.current = 0;
  }, [activeTool]);

  const handleCanvasClick = useCallback(
    (svgX: number, svgY: number) => {
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
            selectComponent(hitId);
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
          } else {
            selectComponent(null);
          }
          break;
        }
      }
    },
    [activeTool, editingModule, addComponent, addConnection, selectComponent, selectConnection, lineStart]
  );

  return { handleCanvasClick, lineStart };
}
