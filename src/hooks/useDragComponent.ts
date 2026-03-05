import { useCallback, useRef } from "react";
import { useAppStore } from "../store";
import { snapToGrid } from "../utils/grid";
import { screenToSvg } from "../utils/svg";

export function useDragComponent() {
  const moveComponent = useAppStore((s) => s.moveComponent);
  const moveComponentsByDelta = useAppStore((s) => s.moveComponentsByDelta);
  const selectComponent = useAppStore((s) => s.selectComponent);
  const selectedComponentIds = useAppStore((s) => s.selectedComponentIds);
  const pushSnapshot = useAppStore((s) => s.pushSnapshot);
  const duplicateComponent = useAppStore((s) => s.duplicateComponent);
  const activeTool = useAppStore((s) => s.activeTool);
  const isDragging = useRef(false);
  const dragId = useRef<string | null>(null);
  const dragMulti = useRef(false);
  const lastGrid = useRef({ gridX: 0, gridY: 0 });

  const handleComponentPointerDown = useCallback(
    (e: React.PointerEvent<SVGElement>, componentId: string, svgEl: SVGSVGElement) => {
      if (activeTool !== "select" || e.button !== 0) return;
      e.stopPropagation();
      isDragging.current = true;

      const pt = screenToSvg(svgEl, e.clientX, e.clientY);
      const snapped = snapToGrid(pt.x, pt.y);
      lastGrid.current = snapped;

      if (e.altKey) {
        const newId = duplicateComponent(componentId);
        if (newId) {
          dragId.current = newId;
          dragMulti.current = false;
        } else {
          dragId.current = componentId;
          dragMulti.current = false;
          pushSnapshot();
        }
      } else {
        // If clicking a component that's part of multi-selection, drag all
        const isInSelection = selectedComponentIds.includes(componentId);
        if (isInSelection && selectedComponentIds.length > 1) {
          dragId.current = componentId;
          dragMulti.current = true;
        } else {
          dragId.current = componentId;
          dragMulti.current = false;
          selectComponent(componentId);
        }
        pushSnapshot();
      }

      (e.target as SVGElement).setPointerCapture(e.pointerId);
    },
    [activeTool, selectComponent, selectedComponentIds, pushSnapshot, duplicateComponent]
  );

  const handleComponentPointerMove = useCallback(
    (e: React.PointerEvent<SVGElement>, svgEl: SVGSVGElement) => {
      if (!isDragging.current || !dragId.current) return;
      const pt = screenToSvg(svgEl, e.clientX, e.clientY);
      const newGrid = snapToGrid(pt.x, pt.y);

      const deltaX = newGrid.gridX - lastGrid.current.gridX;
      const deltaY = newGrid.gridY - lastGrid.current.gridY;
      if (deltaX === 0 && deltaY === 0) return;

      if (dragMulti.current) {
        moveComponentsByDelta(selectedComponentIds, deltaX, deltaY);
      } else {
        moveComponent(dragId.current, newGrid);
      }
      lastGrid.current = newGrid;
    },
    [moveComponent, moveComponentsByDelta, selectedComponentIds]
  );

  const handleComponentPointerUp = useCallback(
    () => {
      isDragging.current = false;
      dragId.current = null;
      dragMulti.current = false;
    },
    []
  );

  return {
    handleComponentPointerDown,
    handleComponentPointerMove,
    handleComponentPointerUp,
    isDragging,
  };
}
