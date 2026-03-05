import { useEffect } from "react";
import { useAppStore } from "../../store";
import { PanelCanvas } from "./PanelCanvas";
import { ToolPalette } from "./ToolPalette";
import { PropertyEditor } from "./PropertyEditor";


export function DesignerView() {
  const editingModule = useAppStore((s) => s.editingModule);
  const createNewModule = useAppStore((s) => s.createNewModule);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const removeComponent = useAppStore((s) => s.removeComponent);
  const selectedComponentIds = useAppStore((s) => s.selectedComponentIds);
  const selectComponent = useAppStore((s) => s.selectComponent);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture if typing in an input
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT") return;

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v":
          setActiveTool("select");
          break;
        case "j":
          setActiveTool("addJack");
          break;
        case "p":
          setActiveTool("addPot");
          break;
        case "b":
          setActiveTool("addButton");
          break;
        case "delete":
        case "backspace":
          if (selectedComponentIds.length > 0) {
            selectedComponentIds.forEach((id) => removeComponent(id));
          }
          break;
        case "escape":
          selectComponent(null);
          setActiveTool("select");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveTool, removeComponent, selectedComponentIds, selectComponent, undo, redo]);

  // Auto-create a module if none is open
  useEffect(() => {
    if (!editingModule) {
      createNewModule("Untitled Module", 10);
    }
  }, [editingModule, createNewModule]);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <PanelCanvas />
        <ToolPalette />
      </div>
      <PropertyEditor />
    </div>
  );
}
