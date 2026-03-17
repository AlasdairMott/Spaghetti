import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useAppStore } from "../../store";
import { RackCanvas } from "./RackCanvas";
import { ModuleCard } from "./ModuleCard";
import { TagFilter, filterModulesByTag } from "../ui/TagFilter";
import type { Module, Rack } from "../../models/types";
import {
  Clipboard,
  Unplug,
  Download,
  Upload,
  AlertTriangle,
  PackagePlus,
  Copy,
  Pencil,
  Trash2,
  TableProperties,
  X,
  Code,
} from "lucide-react";
import {
  updateAudioWires,
  updateAudioKnob,
  updateAudioButton,
} from "../../audio/singleton";
import { SidebarButton } from "../ui/SidebarButton";
import { RackCodeEditor } from "../ui/RackCodeEditor";
import { ScopePanel } from "../ui/ScopePanel";

export function RackView() {
  const modules = useAppStore((s) => s.modules);
  const rack = useAppStore((s) => s.rack);
  const setRackWidth = useAppStore((s) => s.setRackWidth);
  const setRackRows = useAppStore((s) => s.setRackRows);
  const deleteModule = useAppStore((s) => s.deleteModule);
  const removeFromRack = useAppStore((s) => s.removeFromRack);
  const clearWires = useAppStore((s) => s.clearWires);
  const saveModule = useAppStore((s) => s.saveModule);
  const selectedPlacementIds = useAppStore((s) => s.selectedPlacementIds);
  const selectPlacements = useAppStore((s) => s.selectPlacements);
  const openModuleForEditing = useAppStore((s) => s.openModuleForEditing);
  const setMode = useAppStore((s) => s.setMode);

  // Resolve selected placement to its module
  const selectedPlacement =
    selectedPlacementIds.length === 1
      ? rack.placements.find((p) => p.id === selectedPlacementIds[0])
      : null;
  const selectedModule = selectedPlacement
    ? modules.find((m) => m.id === selectedPlacement.moduleId)
    : null;

  const [libraryTag, setLibraryTag] = useState<string | null>(null);
  const filteredModules = useMemo(
    () => filterModulesByTag(modules, libraryTag),
    [modules, libraryTag],
  );

  const faultedIds = useAppStore((s) => s.faultedIds);
  const [showBom, setShowBom] = useState(false);
  const [showComponents, setShowComponents] = useState(false);

  // Code editor panel
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeWidth, setCodeWidth] = useState(() => {
    const saved = localStorage.getItem("spaghetti-code-width");
    return saved ? parseInt(saved, 10) || 500 : 500;
  });
  const resizing = useRef(false);
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
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
        localStorage.setItem("spaghetti-code-width", String(lastWidth));
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [codeWidth],
  );

  // Hot-repatch wires while audio is running
  const wires = rack.wires;
  useEffect(() => {
    updateAudioWires();
  }, [wires]);

  const handleKnobChange = useCallback(
    (placementId: string, componentId: string, angle: number) => {
      updateAudioKnob(placementId, componentId, angle);
    },
    [],
  );

  const handleButtonToggle = useCallback(
    (placementId: string, componentId: string, pressed: boolean) => {
      updateAudioButton(placementId, componentId, pressed);
    },
    [],
  );

  const tryImportModule = (json: string) => {
    try {
      const data = JSON.parse(json);
      if (!data.id || !data.name || !data.components) {
        alert("Invalid module JSON — needs id, name, and components");
        return;
      }
      // Give it a fresh ID to avoid collisions
      data.id = crypto.randomUUID();
      saveModule(data);
    } catch {
      alert("Failed to parse JSON");
    }
  };

  const handleImportModuleFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      tryImportModule(text);
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
      reader.onload = () => tryImportModule(reader.result as string);
      reader.readAsText(file);
    };
    input.click();
  };

  const handleDeleteModule = (moduleId: string) => {
    // Remove all placements of this module from the rack
    rack.placements
      .filter((p) => p.moduleId === moduleId)
      .forEach((p) => removeFromRack(p.id));
    deleteModule(moduleId);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="relative flex flex-col flex-1 min-w-0">
        <RackCanvas
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
          <Code
            size={16}
            color={codeOpen ? "var(--color-surface-0)" : "var(--color-text)"}
            strokeWidth={1.5}
          />
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
          <div
            className="shrink-0 bg-surface-1 flex flex-col"
            style={{ width: codeWidth }}
          >
            <RackCodeEditor />
          </div>
        </>
      )}
      <div className="w-[220px] bg-surface-1 border-l border-border p-3 flex flex-col gap-3 overflow-hidden shrink-0">
        <div className="text-[13px] font-semibold text-text-muted uppercase tracking-wide">
          Rack Settings
        </div>

        {/* Audio fault warning */}
        {faultedIds.size > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-warning-bg border border-warning-border rounded text-xs text-warning-text">
            <AlertTriangle size={14} />
            <span>
              {faultedIds.size} module{faultedIds.size > 1 ? "s" : ""} produced
              NaN/Infinity — output muted. Check code for runaway feedback.
            </span>
          </div>
        )}

        <div className="flex gap-2 items-center">
          <span className="text-xs text-text-muted">Width:</span>
          <input
            className="w-[70px] px-1.5 py-0.5 bg-surface-2 border border-border-light rounded text-text text-[13px]"
            type="number"
            value={rack.widthHP}
            onChange={(e) => setRackWidth(parseInt(e.target.value) || 84)}
            min={1}
          />
          <span className="text-xs text-text-dim">HP</span>
        </div>

        <div className="flex gap-2 items-center">
          <span className="text-xs text-text-muted">Rows:</span>
          <input
            className="w-[70px] px-1.5 py-0.5 bg-surface-2 border border-border-light rounded text-text text-[13px]"
            type="number"
            value={rack.rows}
            onChange={(e) => setRackRows(parseInt(e.target.value) || 1)}
            min={1}
            max={8}
          />
        </div>

        {/* Utility buttons */}
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <SidebarButton
            onClick={() =>
              navigator.clipboard.writeText(JSON.stringify(rack, null, 2))
            }
          >
            <Clipboard size={14} /> Copy Rack to Clipboard
          </SidebarButton>
          <SidebarButton
            onClick={() => {
              if (confirm("Remove all cables?")) clearWires();
            }}
          >
            <Unplug size={14} /> Clear All Cables
          </SidebarButton>
          <SidebarButton onClick={() => setShowBom(true)}>
            <TableProperties size={14} /> Bill of Materials
          </SidebarButton>
          {/* <SidebarButton
            onClick={() => {
              const state = useAppStore.getState();
              const data = JSON.stringify(
                { modules: state.modules, rack: state.rack },
                null,
                2,
              );
              const blob = new Blob([data], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "spaghetti-project.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={14} /> Export Project
          </SidebarButton>
          <SidebarButton
            onClick={() => {
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
                    if (!data.modules || !data.rack) {
                      alert("Invalid project file");
                      return;
                    }
                    if (
                      !confirm(
                        "This will replace all modules and the rack. Continue?",
                      )
                    )
                      return;
                    useAppStore.setState({
                      modules: data.modules,
                      rack: data.rack,
                    });
                  } catch {
                    alert("Failed to parse JSON file");
                  }
                };
                reader.readAsText(file);
              };
              input.click();
            }}
          >
            <Upload size={14} /> Import Project
          </SidebarButton> */}
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

            {/* Component list */}
            <div
              onClick={() => setShowComponents((v) => !v)}
              className="text-[11px] text-text-muted mb-1 uppercase tracking-tight cursor-pointer select-none"
            >
              {showComponents ? "▾" : "▸"} Components (
              {selectedModule.components.length})
            </div>
            {showComponents && (
              <div className="flex flex-col gap-0.5 mb-3">
                {selectedModule.components.map((comp) => (
                  <div key={comp.id} className="text-xs text-[#aaa] py-0.5">
                    <span className="text-text-dim mr-1.5">
                      {comp.kind === "jack"
                        ? comp.jackDirection === "output" ||
                          comp.jackDirection === "headphones"
                          ? "OUT"
                          : comp.jackDirection === "both"
                            ? "I/O"
                            : "IN"
                        : comp.kind === "pot"
                          ? "POT"
                          : "BTN"}
                    </span>
                    {comp.label || (
                      <span className="text-text-faint italic">unlabeled</span>
                    )}
                    {comp.ref && (
                      <span className="text-[#556] ml-1">({comp.ref})</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
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
                  removeFromRack(selectedPlacement.id);
                  selectPlacements([]);
                }}
              >
                <Trash2 size={14} /> Remove from Rack
              </SidebarButton>
            </div>
          </div>
        ) : (
          <div className="border-t border-border pt-3 flex-1 min-h-0 flex flex-col">
            <div className="text-[13px] font-semibold text-text-muted uppercase tracking-wide mb-2">
              Module Library
            </div>
            <div className="flex gap-1 mb-2">
              <SidebarButton
                onClick={handleImportModuleFromClipboard}
                className="flex-1 text-[11px]"
              >
                <Clipboard size={12} /> Paste
              </SidebarButton>
              <SidebarButton
                onClick={handleImportModuleFromFile}
                className="flex-1 text-[11px]"
              >
                <PackagePlus size={12} /> Import
              </SidebarButton>
            </div>
            <TagFilter
              modules={modules}
              activeTag={libraryTag}
              onTagChange={setLibraryTag}
            />
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
                    onDelete={handleDeleteModule}
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
          Click/drag modules to select & move. Click jacks to patch wires. Drag
          knobs to adjust. Delete to remove.
        </div>
      </div>

      {/* BOM Modal */}
      {showBom && (
        <BomModal
          modules={modules}
          rack={rack}
          onClose={() => setShowBom(false)}
        />
      )}
    </div>
  );
}

function BomModal({
  modules,
  rack,
  onClose,
}: {
  modules: Module[];
  rack: Rack;
  onClose: () => void;
}) {
  // Count placements per module
  const placementCounts = new Map<string, number>();
  for (const p of rack.placements) {
    placementCounts.set(p.moduleId, (placementCounts.get(p.moduleId) ?? 0) + 1);
  }

  // Build per-module rows
  const rows = modules
    .filter((m) => placementCounts.has(m.id))
    .map((mod) => {
      const qty = placementCounts.get(mod.id) ?? 0;
      let jacks = 0,
        pots = 0,
        buttons = 0,
        leds = 0;
      for (const c of mod.components) {
        if (c.kind === "jack") {
          jacks++;
          if (c.hasLed) leds++;
        } else if (c.kind === "pot") {
          pots++;
        } else if (c.kind === "button") {
          buttons++;
          leds += c.buttonLedCount ?? 0;
        }
      }
      return {
        name: mod.name,
        widthHP: mod.widthHP,
        qty,
        jacks,
        pots,
        buttons,
        leds,
      };
    });

  // Totals
  const totals = rows.reduce(
    (acc, r) => ({
      qty: acc.qty + r.qty,
      jacks: acc.jacks + r.jacks * r.qty,
      pots: acc.pots + r.pots * r.qty,
      buttons: acc.buttons + r.buttons * r.qty,
      leds: acc.leds + r.leds * r.qty,
      hp: acc.hp + r.widthHP * r.qty,
    }),
    { qty: 0, jacks: 0, pots: 0, buttons: 0, leds: 0, hp: 0 },
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-surface-2 border border-border-light rounded-lg p-5 min-w-[500px] max-w-[80vw] max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="text-[15px] font-semibold text-text">
            Bill of Materials
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-text-muted p-1"
          >
            <X size={18} />
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="text-text-dim text-[13px]">
            No modules in the rack.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {[
                  "Module",
                  "HP",
                  "Qty",
                  "Jacks",
                  "Pots",
                  "Buttons",
                  "LEDs",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`px-2.5 py-1.5 border-b border-border-light text-text-muted text-[11px] uppercase tracking-tight ${i === 0 ? "text-left" : "text-right"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="px-2.5 py-1 border-b border-border text-[13px] text-text">
                    {r.name}
                  </td>
                  {[r.widthHP, r.qty, r.jacks, r.pots, r.buttons, r.leds].map(
                    (v, i) => (
                      <td
                        key={i}
                        className="px-2.5 py-1 border-b border-border text-[13px] text-text text-right tabular-nums"
                      >
                        {v}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="px-2.5 py-1 text-[13px] text-[#aaa]">Total</td>
                {[
                  totals.hp,
                  totals.qty,
                  totals.jacks,
                  totals.pots,
                  totals.buttons,
                  totals.leds,
                ].map((v, i) => (
                  <td
                    key={i}
                    className="px-2.5 py-1 text-[13px] text-[#aaa] text-right tabular-nums"
                  >
                    {v}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
