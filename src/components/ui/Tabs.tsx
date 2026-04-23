import { useState, useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";

export interface Tab {
  id: string;
  name: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  onAdd?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRename?: (id: string, name: string) => void;
  className?: string;
}

export function Tabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  onAdd,
  onRename,
  className,
}: TabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (tab: Tab) => {
    if (onRename) {
      setEditingId(tab.id);
      setEditValue(tab.name);
    }
  };

  const commitEdit = () => {
    if (editingId && onRename && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div
      className={`flex items-center gap-px overflow-x-auto overflow-y-hidden scrollbar-none ${className ?? ""}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          onDoubleClick={() => startEditing(tab)}
          className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors shrink-0 bg-transparent border-0 cursor-pointer relative ${
            activeId === tab.id
              ? "text-text after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent"
              : "text-text-dim hover:text-text-muted hover:bg-surface-2/30"
          }`}
        >
          {tab.icon && (
            <span className="flex items-center opacity-60">{tab.icon}</span>
          )}
          {editingId === tab.id ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-24 bg-surface-3 text-text px-1 py-0.5 rounded text-xs outline-none border border-border-light"
            />
          ) : (
            <span className="truncate max-w-[120px]">{tab.name}</span>
          )}
          {onClose && tabs.length > 1 && editingId !== tab.id && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className={`p-0.5 rounded hover:bg-surface-3 ${
                activeId === tab.id
                  ? "opacity-60 hover:opacity-100"
                  : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
              }`}
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </button>
      ))}
      {onAdd && (
        <button
          onClick={onAdd}
          className="p-1.5 text-text-dim hover:text-text-muted hover:bg-surface-2/30 transition-colors shrink-0 bg-transparent border-none cursor-pointer"
          title="New tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
