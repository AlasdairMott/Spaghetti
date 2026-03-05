import { useState } from "react";
import { useAppStore } from "../../store";
import type { AppMode } from "../../models/types";

export function Toolbar() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const editingModule = useAppStore((s) => s.editingModule);
  const modules = useAppStore((s) => s.modules);
  const saveModule = useAppStore((s) => s.saveModule);
  const createNewModule = useAppStore((s) => s.createNewModule);
  const openModuleForEditing = useAppStore((s) => s.openModuleForEditing);
  const renderMode = useAppStore((s) => s.renderMode);
  const setRenderMode = useAppStore((s) => s.setRenderMode);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (editingModule) {
      saveModule({ ...editingModule });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  const handleNew = () => {
    const name = prompt("Module name:", "New Module");
    if (!name) return;
    const hpStr = prompt("Width in HP:", "10");
    const hp = parseInt(hpStr || "10") || 10;
    createNewModule(name, hp);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id) return;
    const mod = modules.find((m) => m.id === id);
    if (mod) openModuleForEditing(mod);
    e.target.value = "";
  };

  const modes: { id: AppMode; label: string }[] = [
    { id: "designer", label: "Module Designer" },
    { id: "rack", label: "Rack View" },
  ];

  const selectStyle: React.CSSProperties = {
    padding: "4px 8px",
    background: "#333",
    color: "#ddd",
    border: "1px solid #555",
    borderRadius: 4,
    fontSize: 12,
    cursor: "pointer",
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "6px 16px",
      background: "#1a1a1a",
      borderBottom: "1px solid #333",
    }}>
      <span style={{ fontWeight: 700, fontSize: 14, color: "#4af", marginRight: 8 }}>
        LW Designer
      </span>

      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          style={{
            padding: "4px 12px",
            background: mode === m.id ? "#333" : "transparent",
            color: mode === m.id ? "#ddd" : "#777",
            border: mode === m.id ? "1px solid #555" : "1px solid transparent",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {m.label}
        </button>
      ))}

      <button
        onClick={() => setRenderMode(renderMode === "wireframe" ? "rendered" : "wireframe")}
        style={{
          padding: "4px 12px",
          background: renderMode === "rendered" ? "#435" : "transparent",
          color: renderMode === "rendered" ? "#daf" : "#777",
          border: renderMode === "rendered" ? "1px solid #658" : "1px solid transparent",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        {renderMode === "wireframe" ? "Wireframe" : "Rendered"}
      </button>

      <div style={{ flex: 1 }} />

      {mode === "designer" && (
        <>
          {modules.length > 0 && (
            <select style={selectStyle} onChange={handleLoad} defaultValue="">
              <option value="" disabled>Load Module...</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.widthHP}HP)</option>
              ))}
            </select>
          )}
          <button
            onClick={handleNew}
            style={{
              padding: "4px 12px",
              background: "#333",
              color: "#ddd",
              border: "1px solid #555",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            New Module
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "4px 12px",
              background: saved ? "#363" : "#264",
              color: saved ? "#8f8" : "#afa",
              border: `1px solid ${saved ? "#5b5" : "#4a6"}`,
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              transition: "all 0.2s",
            }}
          >
            {saved ? "Saved!" : "Save Module"}
          </button>
        </>
      )}
    </div>
  );
}
