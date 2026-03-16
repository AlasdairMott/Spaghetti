import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store";
import { PanelCanvas } from "./PanelCanvas";
import { ToolPalette } from "./ToolPalette";
import { PropertyEditor } from "./PropertyEditor";
import { CodeEditor } from "./CodeEditor";
import { Code } from "lucide-react";


export function DesignerView() {
  const editingModule = useAppStore((s) => s.editingModule);
  const createNewModule = useAppStore((s) => s.createNewModule);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const removeComponent = useAppStore((s) => s.removeComponent);
  const removeConnection = useAppStore((s) => s.removeConnection);
  const selectedComponentIds = useAppStore((s) => s.selectedComponentIds);
  const selectedConnectionId = useAppStore((s) => s.selectedConnectionId);
  const selectComponent = useAppStore((s) => s.selectComponent);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);

  const [codeOpen, setCodeOpen] = useState(false);
  const [codeWidth, setCodeWidth] = useState(() => {
    const saved = localStorage.getItem("lw-code-width");
    return saved ? parseInt(saved, 10) || 500 : 500;
  });
  const resizing = useRef(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture if typing in an input or in the Monaco editor
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.target as HTMLElement).closest(".monaco-editor")) return;

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
        case "l":
          setActiveTool("addLine");
          break;
        case "a":
          setActiveTool("addArrow");
          break;
        case "delete":
        case "backspace":
          if (selectedComponentIds.length > 0) {
            selectedComponentIds.forEach((id) => removeComponent(id));
          } else if (selectedConnectionId) {
            removeConnection(selectedConnectionId);
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
  }, [setActiveTool, removeComponent, removeConnection, selectedComponentIds, selectedConnectionId, selectComponent, undo, redo]);

  // Auto-create a module if none is open
  useEffect(() => {
    if (!editingModule) {
      createNewModule("Untitled Module", 10);
    }
  }, [editingModule, createNewModule]);

  // Drag handle for code editor resize
  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startWidth = codeWidth;
    let lastWidth = startWidth;

    const onMove = (ev: PointerEvent) => {
      if (!resizing.current) return;
      const delta = startX - ev.clientX;
      lastWidth = Math.max(200, Math.min(1200, startWidth + delta));
      setCodeWidth(lastWidth);
    };
    const onUp = () => {
      resizing.current = false;
      localStorage.setItem("lw-code-width", String(lastWidth));
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [codeWidth]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="relative flex-1 min-w-0">
        <PanelCanvas />
        <ToolPalette />
      </div>
      <PropertyEditor />
      {/* Code editor toggle button */}
      <button
        onClick={() => setCodeOpen(!codeOpen)}
        className={`absolute top-12 z-10 border-none rounded p-1.5 cursor-pointer ${
          codeOpen ? "bg-accent" : "bg-surface-3"
        }`}
        style={{ right: codeOpen ? codeWidth + 4 : 4 }}
        title="Toggle Code Editor"
      >
        <Code size={16} color={codeOpen ? "var(--color-surface-0)" : "var(--color-text)"} strokeWidth={1.5} />
      </button>
      {/* Code editor panel */}
      {codeOpen && (
        <>
          <div
            onPointerDown={handleResizeStart}
            className="w-1 cursor-col-resize bg-surface-3 shrink-0"
          />
          <div className="shrink-0 bg-surface-1 flex flex-col" style={{ width: codeWidth }}>
            <CodeEditor />
          </div>
        </>
      )}
    </div>
  );
}
