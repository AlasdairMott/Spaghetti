import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../store";
import { CanvasCanvas } from "./CanvasCanvas";
import { ModuleCard } from "../rack/ModuleCard";
import { TagFilter, filterModulesByTag } from "../ui/TagFilter";
import {
  Clipboard,
  Unplug,
  PackagePlus,
  Pencil,
  Copy,
  Trash2,
  Code,
} from "lucide-react";
import {
  updateCanvasAudioWires,
  updateCanvasAudioKnob,
  updateCanvasAudioButton,
} from "../../audio/singleton";
import { SidebarButton } from "../ui/SidebarButton";
import { RackCodeEditor } from "../ui/RackCodeEditor";
import { ScopePanel } from "../ui/ScopePanel";

export function CanvasView() {
  const modules = useAppStore((s) => s.modules);
  const canvas = useAppStore((s) => s.canvas);
  const canvasRemovePlacement = useAppStore((s) => s.canvasRemovePlacement);
  const canvasClearWires = useAppStore((s) => s.canvasClearWires);
  const saveModule = useAppStore((s) => s.saveModule);
  const canvasSelectedPlacementIds = useAppStore((s) => s.canvasSelectedPlacementIds);
  const canvasSelectPlacements = useAppStore((s) => s.canvasSelectPlacements);
  const openModuleForEditing = useAppStore((s) => s.openModuleForEditing);
  const setMode = useAppStore((s) => s.setMode);

  const selectedPlacement =
    canvasSelectedPlacementIds.length === 1
      ? canvas.placements.find((p) => p.id === canvasSelectedPlacementIds[0])
      : null;
  const selectedModule = selectedPlacement
    ? modules.find((m) => m.id === selectedPlacement.moduleId)
    : null;

  const [libraryTag, setLibraryTag] = useState<string | null>(null);
  const filteredModules = useMemo(
    () => filterModulesByTag(modules, libraryTag),
    [modules, libraryTag],
  );

  // Code editor panel
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeWidth, setCodeWidth] = useState(() => {
    const saved = localStorage.getItem("lw-code-width");
    return saved ? parseInt(saved, 10) || 500 : 500;
  });
  const resizing = useRef(false);
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

  // Hot-repatch wires while audio is running
  const wires = canvas.wires;
  useEffect(() => {
    updateCanvasAudioWires();
  }, [wires]);

  const handleKnobChange = useCallback(
    (placementId: string, componentId: string, angle: number) => {
      updateCanvasAudioKnob(placementId, componentId, angle);
    },
    [],
  );

  const handleButtonToggle = useCallback(
    (placementId: string, componentId: string, pressed: boolean) => {
      updateCanvasAudioButton(placementId, componentId, pressed);
    },
    [],
  );

  const handleImportModuleFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      try {
        const data = JSON.parse(text);
        if (!data.id || !data.name || !data.components) {
          alert("Invalid module JSON — needs id, name, and components");
          return;
        }
        data.id = crypto.randomUUID();
        saveModule(data);
      } catch {
        alert("Failed to parse JSON");
      }
    } catch {
      alert("Could not read clipboard. Check browser permissions.");
    }
  };

  const handleImportModuleFromFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (!data.id || !data.name || !data.components) {
            alert("Invalid module JSON");
            return;
          }
          data.id = crypto.randomUUID();
          saveModule(data);
        } catch {
          alert("Failed to parse JSON");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="relative flex flex-col flex-1 min-w-0">
        <CanvasCanvas
          onKnobChange={handleKnobChange}
          onButtonToggle={handleButtonToggle}
        />
        {/* Code editor toggle */}
        <button
          onClick={() => setCodeOpen(!codeOpen)}
          className={`absolute top-2 right-2 z-10 border-none rounded p-1.5 cursor-pointer ${
            codeOpen ? "bg-accent" : "bg-surface-3"
          }`}
          title="Toggle Code Editor"
        >
          <Code size={16} color={codeOpen ? "var(--color-surface-0)" : "var(--color-text)"} strokeWidth={1.5} />
        </button>
        <ScopePanel />
      </div>
      {/* Code editor panel */}
      {codeOpen && (
        <>
          <div
            onPointerDown={handleResizeStart}
            className="w-1 cursor-col-resize bg-surface-3 shrink-0"
          />
          <div className="shrink-0 bg-surface-1 flex flex-col" style={{ width: codeWidth }}>
            <RackCodeEditor />
          </div>
        </>
      )}
      <div className="w-[220px] bg-surface-1 border-l border-border p-3 flex flex-col gap-3 overflow-hidden shrink-0">
        <div className="text-[13px] font-semibold text-text-muted uppercase tracking-wide">
          Canvas
        </div>

        {/* Utility buttons */}
        <div className="flex flex-col gap-1.5">
          <SidebarButton
            onClick={() => {
              if (confirm("Remove all cables?")) canvasClearWires();
            }}
          >
            <Unplug size={14} /> Clear All Cables
          </SidebarButton>
        </div>

        {/* Selected module properties OR Module Library */}
        {selectedModule && selectedPlacement ? (
          <div className="border-t border-border pt-3 flex-1 min-h-0 overflow-y-auto">
            <div className="text-[13px] font-semibold text-text-muted uppercase tracking-wide mb-2">
              Selected Module
            </div>
            <div className="text-sm font-semibold text-text mb-1">
              {selectedModule.name}
            </div>
            <div className="text-xs text-text-muted mb-2">
              {selectedModule.widthHP} HP &middot;{" "}
              {selectedModule.components.length} components
            </div>

            <div className="flex flex-col gap-1.5">
              <SidebarButton
                variant="accent"
                onClick={() => {
                  openModuleForEditing(selectedModule);
                  setMode("designer");
                }}
              >
                <Pencil size={14} /> Edit Module
              </SidebarButton>
              <SidebarButton
                variant="accent"
                onClick={() => {
                  const clone = {
                    ...selectedModule,
                    id: crypto.randomUUID(),
                    name: selectedModule.name + " (copy)",
                  };
                  saveModule(clone);
                }}
              >
                <Copy size={14} /> Duplicate Module
              </SidebarButton>
              <SidebarButton
                variant="danger"
                onClick={() => {
                  canvasRemovePlacement(selectedPlacement.id);
                  canvasSelectPlacements([]);
                }}
              >
                <Trash2 size={14} /> Remove from Canvas
              </SidebarButton>
            </div>
          </div>
        ) : (
          <div className="border-t border-border pt-3 flex-1 min-h-0 flex flex-col">
            <div className="text-[13px] font-semibold text-text-muted uppercase tracking-wide mb-2">
              Module Library
            </div>
            <div className="flex gap-1 mb-2">
              <SidebarButton onClick={handleImportModuleFromClipboard} className="flex-1 text-[11px]">
                <Clipboard size={12} /> Paste
              </SidebarButton>
              <SidebarButton onClick={handleImportModuleFromFile} className="flex-1 text-[11px]">
                <PackagePlus size={12} /> Import
              </SidebarButton>
            </div>
            <TagFilter modules={modules} activeTag={libraryTag} onTagChange={setLibraryTag} />
            {filteredModules.length === 0 ? (
              <div className="text-xs text-text-faint">
                {modules.length === 0
                  ? "No saved modules yet. Design a module first, then save it."
                  : "No modules match this tag."}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
                {filteredModules.map((mod) => (
                  <ModuleCard
                    key={mod.id}
                    module={mod}
                    onDragStart={() => {}}
                    onDelete={() => {}}
                    onEdit={(moduleId) => {
                      const m = modules.find((x) => x.id === moduleId);
                      if (m) {
                        openModuleForEditing(m);
                        setMode("designer");
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] text-text-faint shrink-0">
          Drag modules from the library. They snap together when close. Click jacks to patch wires.
        </div>
      </div>
    </div>
  );
}
