import type { Module } from "../../models/types";

interface Props {
  module: Module;
  onDragStart: (moduleId: string) => void;
  onDelete: (moduleId: string) => void;
  onEdit?: (moduleId: string) => void;
}

export function ModuleCard({ module, onDragStart, onDelete, onEdit }: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("moduleId", module.id);
        e.dataTransfer.setData(`moduleid/${module.id}`, "");
        onDragStart(module.id);
      }}
      className="flex items-start gap-2 px-3 py-2 bg-surface-2 border border-border-light rounded cursor-grab text-[13px] text-text"
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium">{module.name}</div>
        <div className="text-[11px] text-text-muted mt-0.5">
          {module.widthHP} HP &middot; {module.components.length} components
        </div>
        {module.tags && module.tags.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-1">
            {module.tags.map((t) => (
              <span key={t} className="text-[9px] text-text-dim bg-surface-3 rounded px-1 py-px">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(module.id);
          }}
          className="bg-transparent border-none cursor-pointer p-0.5 text-text-dim text-sm leading-none"
          title="Edit module"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete "${module.name}"? This will also remove it from the rack.`)) {
            onDelete(module.id);
          }
        }}
        className="bg-transparent border-none cursor-pointer p-0.5 text-text-dim text-sm leading-none"
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
