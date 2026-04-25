import { useCallback, useRef } from "react";
import { useAppStore } from "../store";
import { snapToGrid } from "../utils/grid";
import { GRID_X, GRID_Y } from "../constants/grid";
import { screenToSvg } from "../utils/svg";

export function useDragComponent() {
  const moveComponent = useAppStore((s) => s.moveComponent);
  const moveComponentsByDelta = useAppStore((s) => s.moveComponentsByDelta);
  const moveConnectionsByDelta = useAppStore((s) => s.moveConnectionsByDelta);
  const moveRectsByDelta = useAppStore((s) => s.moveRectsByDelta);
  const selectComponent = useAppStore((s) => s.selectComponent);
  const selectItems = useAppStore((s) => s.selectItems);
  const selectedComponentIds = useAppStore((s) => s.selectedComponentIds);
  const selectedConnectionIds = useAppStore((s) => s.selectedConnectionIds);
  const selectedRectIds = useAppStore((s) => s.selectedRectIds);
  const pushSnapshot = useAppStore((s) => s.pushSnapshot);
  const duplicateItems = useAppStore((s) => s.duplicateItems);
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
        const isInSelection = selectedComponentIds.includes(componentId);
        const multi = isInSelection && (selectedComponentIds.length + selectedConnectionIds.length + selectedRectIds.length) > 1;
        const result = duplicateItems(
          multi ? selectedComponentIds : [componentId],
          multi ? selectedConnectionIds : [],
          multi ? selectedRectIds : [],
        );
        if (result?.componentIds.length) {
          dragId.current = result.componentIds[0];
          dragMulti.current = multi;
        }
      } else {
        const isInSelection = selectedComponentIds.includes(componentId);
        const totalSelected = selectedComponentIds.length + selectedConnectionIds.length + selectedRectIds.length;
        if (e.shiftKey) {
          // Shift+click: toggle component in/out of selection, preserve other types
          const compIds = isInSelection
            ? selectedComponentIds.filter((id) => id !== componentId)
            : [...selectedComponentIds, componentId];
          selectItems(compIds, selectedConnectionIds, selectedRectIds);
          dragId.current = componentId;
          dragMulti.current = true;
        } else if (isInSelection && totalSelected > 1) {
          // Clicking a component that's part of multi-selection: drag all
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
    [activeTool, selectComponent, selectItems, selectedComponentIds, selectedConnectionIds, selectedRectIds, pushSnapshot, duplicateItems]
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
        const dxMm = deltaX * GRID_X;
        const dyMm = deltaY * GRID_Y;
        if (selectedConnectionIds.length > 0) moveConnectionsByDelta(selectedConnectionIds, dxMm, dyMm);
        if (selectedRectIds.length > 0) moveRectsByDelta(selectedRectIds, dxMm, dyMm);
      } else {
        moveComponent(dragId.current, newGrid);
      }
      lastGrid.current = newGrid;
    },
    [moveComponent, moveComponentsByDelta, moveConnectionsByDelta, moveRectsByDelta, selectedComponentIds, selectedConnectionIds, selectedRectIds]
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
