import { useCallback } from "react";
import { useAppStore } from "../store";
import { snapToGrid } from "../utils/grid";
import { HIT_RADIUS } from "../constants/grid";
import { gridToMm } from "../utils/grid";

export function useToolAction() {
  const activeTool = useAppStore((s) => s.activeTool);
  const editingModule = useAppStore((s) => s.editingModule);
  const addComponent = useAppStore((s) => s.addComponent);
  const selectComponent = useAppStore((s) => s.selectComponent);

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
        case "select": {
          // Hit-test components
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
          selectComponent(hitId);
          break;
        }
      }
    },
    [activeTool, editingModule, addComponent, selectComponent]
  );

  return { handleCanvasClick };
}
