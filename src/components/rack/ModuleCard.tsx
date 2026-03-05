import type { Module } from "../../models/types";

interface Props {
  module: Module;
  onDragStart: (moduleId: string) => void;
  onDelete: (moduleId: string) => void;
}

export function ModuleCard({ module, onDragStart, onDelete }: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("moduleId", module.id);
        onDragStart(module.id);
      }}
      style={{
        padding: "8px 12px",
        background: "#2a2a2a",
        border: "1px solid #444",
        borderRadius: 4,
        cursor: "grab",
        fontSize: 13,
        color: "#ddd",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{module.name}</div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
          {module.widthHP} HP &middot; {module.components.length} components
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete "${module.name}"? This will also remove it from the rack.`)) {
            onDelete(module.id);
          }
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 2,
          color: "#666",
          fontSize: 14,
          lineHeight: 1,
        }}
        title="Delete module"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}
