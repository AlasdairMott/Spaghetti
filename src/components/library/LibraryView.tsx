import { useMemo, useState } from "react";
import { Copy, Pencil, Trash2, Tag, Plus } from "lucide-react";
import { useAppStore } from "../../store";
import type { Module } from "../../models/types";
import { ModulePanel } from "../shared/ModulePanel";
import { PANEL_HEIGHT, HP_WIDTH } from "../../constants/grid";
import { TagFilter, filterModulesByTag } from "../ui/TagFilter";
import { SidebarButton } from "../ui/SidebarButton";

const CARD_MAX_W = 260;

export function LibraryView() {
  const modules = useAppStore((s) => s.modules);
  const racks = useAppStore((s) => s.racks);
  const canvases = useAppStore((s) => s.canvases);
  const saveModule = useAppStore((s) => s.saveModule);
  const deleteModule = useAppStore((s) => s.deleteModule);
  const openModuleForEditing = useAppStore((s) => s.openModuleForEditing);
  const createNewModule = useAppStore((s) => s.createNewModule);
  const setMode = useAppStore((s) => s.setMode);
  const theme = useAppStore((s) => s.theme);
  const renderMode = useAppStore((s) => s.renderMode);

  const isLight = theme === "light";
  const isRendered = renderMode === "rendered";
  const panelBg = isRendered ? "#E7E0D8" : isLight ? "#e8e4e0" : "#222";
  const lineColor = isRendered ? "#231F20" : isLight ? "#555" : "#444";
  const textColor = isRendered ? "#231F20" : isLight ? "#444" : "#777";
  const panelStroke = isLight ? "#b0acaa" : "#959495";
  const compStroke = isLight ? "#555" : "#888";

  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const byTag = filterModulesByTag(modules, tagFilter);
    if (!query.trim()) return byTag;
    const q = query.toLowerCase();
    return byTag.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [modules, tagFilter, query]);

  const handleEdit = (mod: Module) => {
    openModuleForEditing(mod);
    setMode("designer");
  };

  const handleNew = () => {
    const name = prompt("Module name:", "New Module");
    if (!name) return;
    const hpStr = prompt("Width in HP:", "10");
    const hp = parseInt(hpStr || "10") || 10;
    createNewModule(name, hp);
    setMode("designer");
  };

  const handleDuplicate = (mod: Module) => {
    saveModule({
      ...mod,
      id: crypto.randomUUID(),
      name: `${mod.name} (copy)`,
    });
  };

  const handleRename = (mod: Module) => {
    const name = prompt("New name:", mod.name);
    if (!name || name.trim() === "" || name === mod.name) return;
    saveModule({ ...mod, name: name.trim() });
  };

  const handleEditTags = (mod: Module) => {
    const current = (mod.tags ?? []).join(", ");
    const next = prompt("Tags (comma separated):", current);
    if (next === null) return;
    const tags = next
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    saveModule({ ...mod, tags });
  };

  const handleDelete = (mod: Module) => {
    const racksWith = racks.filter((r) =>
      r.placements.some((p) => p.moduleId === mod.id),
    ).length;
    const canvasesWith = canvases.filter((c) =>
      c.placements.some((p) => p.moduleId === mod.id),
    ).length;
    const usageMsg =
      racksWith + canvasesWith > 0
        ? ` It is used in ${racksWith} rack${racksWith === 1 ? "" : "s"} and ${canvasesWith} canvas${canvasesWith === 1 ? "" : "es"}; those placements will also be removed.`
        : "";
    if (!confirm(`Delete "${mod.name}"?${usageMsg}`)) return;

    const newRacks = racks.map((r) => ({
      ...r,
      placements: r.placements.filter((p) => p.moduleId !== mod.id),
      wires: r.wires.filter((w) => {
        const fromP = r.placements.find((p) => p.id === w.from.placementId);
        const toP = r.placements.find((p) => p.id === w.to.placementId);
        return fromP?.moduleId !== mod.id && toP?.moduleId !== mod.id;
      }),
      knobStates: r.knobStates.filter((k) => {
        const p = r.placements.find((p) => p.id === k.placementId);
        return p?.moduleId !== mod.id;
      }),
      buttonStates: r.buttonStates.filter((b) => {
        const p = r.placements.find((p) => p.id === b.placementId);
        return p?.moduleId !== mod.id;
      }),
    }));
    const newCanvases = canvases.map((c) => ({
      ...c,
      placements: c.placements.filter((p) => p.moduleId !== mod.id),
      wires: c.wires.filter((w) => {
        const fromP = c.placements.find((p) => p.id === w.from.placementId);
        const toP = c.placements.find((p) => p.id === w.to.placementId);
        return fromP?.moduleId !== mod.id && toP?.moduleId !== mod.id;
      }),
      knobStates: c.knobStates.filter((k) => {
        const p = c.placements.find((p) => p.id === k.placementId);
        return p?.moduleId !== mod.id;
      }),
      buttonStates: c.buttonStates.filter((b) => {
        const p = c.placements.find((p) => p.id === b.placementId);
        return p?.moduleId !== mod.id;
      }),
    }));
    useAppStore.setState({ racks: newRacks, canvases: newCanvases });
    deleteModule(mod.id);
  };

  return (
    <div className="flex-1 overflow-auto bg-surface-0">
      <div className="max-w-[1400px] mx-auto p-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h1 className="text-lg font-semibold text-text">Module Library</h1>
          <div className="text-[13px] text-text-muted">
            {modules.length} module{modules.length === 1 ? "" : "s"}
          </div>
          <div className="flex-1" />
          <input
            type="text"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="px-2 py-1 bg-surface-2 text-text border border-border-light rounded text-[13px] w-48"
          />
          <SidebarButton variant="accent" onClick={handleNew}>
            <Plus size={12} /> New Module
          </SidebarButton>
        </div>

        <div className="mb-4">
          <TagFilter
            modules={modules}
            activeTag={tagFilter}
            onTagChange={setTagFilter}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-[13px] text-text-faint py-8 text-center">
            {modules.length === 0
              ? "No modules yet. Design one to see it here."
              : "No modules match this filter."}
          </div>
        ) : (
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(180px, 1fr))`,
            }}
          >
            {filtered.map((mod) => {
              const modWidth = mod.widthHP * HP_WIDTH;
              return (
                <div
                  key={mod.id}
                  className="group relative flex flex-col bg-surface-2 border border-border-light rounded overflow-hidden"
                  style={{ maxWidth: CARD_MAX_W }}
                >
                  <div
                    className="relative flex items-center justify-center bg-surface-1 cursor-pointer"
                    style={{ padding: 12 }}
                    onDoubleClick={() => handleEdit(mod)}
                    title="Double-click to edit"
                  >
                    <svg
                      viewBox={`0 0 ${modWidth} ${PANEL_HEIGHT}`}
                      style={{ maxHeight: 240, width: "auto" }}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <ModulePanel
                        module={mod}
                        placementId="library-thumb"
                        panelBg={panelBg}
                        panelStroke={panelStroke}
                        lineColor={lineColor}
                        textColor={textColor}
                        compStroke={compStroke}
                        getKnobAngle={() => 150}
                        isButtonPressed={() => false}
                        handlePotPointerDown={() => {}}
                        onPotDoubleClick={() => {}}
                        onButtonClick={() => {}}
                      />
                    </svg>
                  </div>

                  <div className="p-2.5 flex flex-col gap-1.5 border-t border-border">
                    <div className="flex items-baseline gap-2">
                      <div className="font-medium text-[13px] text-text truncate flex-1" title={mod.name}>
                        {mod.name}
                      </div>
                      <div className="text-[11px] text-text-muted shrink-0">
                        {mod.widthHP} HP
                      </div>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {mod.components.length} component
                      {mod.components.length === 1 ? "" : "s"}
                    </div>
                    {mod.tags && mod.tags.length > 0 && (
                      <div className="flex flex-wrap gap-0.5">
                        {mod.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] text-text-dim bg-surface-3 rounded px-1 py-px"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action row — anchored to bottom of card, only visible on hover */}
                  <div className="absolute bottom-0 left-0 right-0 flex gap-1 p-2 bg-surface-2/95 backdrop-blur-sm border-t border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                    <SidebarButton
                      onClick={() => handleEdit(mod)}
                      className="flex-1 text-[11px]"
                    >
                      <Pencil size={11} /> Edit
                    </SidebarButton>
                    <SidebarButton
                      onClick={() => handleRename(mod)}
                      className="text-[11px] px-1.5"
                      title="Rename"
                    >
                      Aa
                    </SidebarButton>
                    <SidebarButton
                      onClick={() => handleEditTags(mod)}
                      className="text-[11px] px-1.5"
                      title="Edit tags"
                    >
                      <Tag size={11} />
                    </SidebarButton>
                    <SidebarButton
                      onClick={() => handleDuplicate(mod)}
                      className="text-[11px] px-1.5"
                      title="Duplicate"
                    >
                      <Copy size={11} />
                    </SidebarButton>
                    <SidebarButton
                      variant="danger"
                      onClick={() => handleDelete(mod)}
                      className="text-[11px] px-1.5"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </SidebarButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
