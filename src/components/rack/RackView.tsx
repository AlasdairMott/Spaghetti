import { useAppStore } from "../../store";
import { RackCanvas } from "./RackCanvas";
import { ModuleCard } from "./ModuleCard";

export function RackView() {
  const modules = useAppStore((s) => s.modules);
  const rack = useAppStore((s) => s.rack);
  const setRackWidth = useAppStore((s) => s.setRackWidth);
  const setRackRows = useAppStore((s) => s.setRackRows);
  const deleteModule = useAppStore((s) => s.deleteModule);
  const removeFromRack = useAppStore((s) => s.removeFromRack);

  const handleDeleteModule = (moduleId: string) => {
    // Remove all placements of this module from the rack
    rack.placements
      .filter((p) => p.moduleId === moduleId)
      .forEach((p) => removeFromRack(p.id));
    deleteModule(moduleId);
  };

  const inputStyle: React.CSSProperties = {
    width: 70,
    padding: "3px 6px",
    background: "#2a2a2a",
    border: "1px solid #444",
    borderRadius: 3,
    color: "#ddd",
    fontSize: 13,
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <RackCanvas />
      </div>
      <div style={{
        width: 220,
        background: "#1a1a1a",
        borderLeft: "1px solid #333",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflowY: "auto",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>
          Rack Settings
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#888" }}>Width:</span>
          <input
            style={inputStyle}
            type="number"
            value={rack.widthHP}
            onChange={(e) => setRackWidth(parseInt(e.target.value) || 84)}
            min={1}
          />
          <span style={{ fontSize: 12, color: "#666" }}>HP</span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#888" }}>Rows:</span>
          <input
            style={inputStyle}
            type="number"
            value={rack.rows}
            onChange={(e) => setRackRows(parseInt(e.target.value) || 1)}
            min={1}
            max={8}
          />
        </div>

        <div style={{ borderTop: "1px solid #333", paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Module Library
          </div>
          {modules.length === 0 ? (
            <div style={{ fontSize: 12, color: "#555" }}>
              No saved modules yet. Design a module first, then save it.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {modules.map((mod) => (
                <ModuleCard
                  key={mod.id}
                  module={mod}
                  onDragStart={() => {}}
                  onDelete={handleDeleteModule}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: "#555", marginTop: "auto" }}>
          Drag modules from the library onto the rack. Double-click a placed module to remove it.
        </div>
      </div>
    </div>
  );
}
