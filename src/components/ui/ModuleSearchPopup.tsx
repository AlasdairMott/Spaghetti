import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../../store";

interface ModuleSearchPopupProps {
  /** Screen pixel position to anchor the popup */
  screenX: number;
  screenY: number;
  /** Called when a module is selected — receives the module id */
  onSelect: (moduleId: string) => void;
  onClose: () => void;
}

export function ModuleSearchPopup({ screenX, screenY, onSelect, onClose }: ModuleSearchPopupProps) {
  const modules = useAppStore((s) => s.modules);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? modules.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    : modules;

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightIdx]) {
        onSelect(filtered[highlightIdx].id);
      }
    }
  };

  // Position: anchor below the click point, clamp to viewport
  const popupWidth = 200;
  const popupMaxHeight = 260;
  const left = Math.min(screenX - popupWidth / 2, window.innerWidth - popupWidth - 8);
  const top = Math.min(screenY + 4, window.innerHeight - popupMaxHeight - 8);

  if (modules.length === 0) return null;

  return (
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        left: Math.max(8, left),
        top: Math.max(8, top),
        width: popupWidth,
        maxHeight: popupMaxHeight,
        zIndex: 1000,
      }}
      className="bg-surface-2 border border-border-light rounded-lg shadow-lg overflow-hidden flex flex-col"
    >
      <div className="p-1.5">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search modules..."
          className="w-full px-2 py-1 bg-surface-3 border border-border-light rounded text-text text-[13px] outline-none placeholder:text-text-faint"
        />
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-text-faint">No modules found</div>
        ) : (
          filtered.map((mod, i) => (
            <button
              key={mod.id}
              onClick={() => onSelect(mod.id)}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`w-full text-left px-3 py-1.5 text-[13px] cursor-pointer border-none ${
                i === highlightIdx
                  ? "bg-accent/20 text-text"
                  : "bg-transparent text-text-muted hover:bg-surface-3"
              }`}
            >
              <span className="font-medium">{mod.name}</span>
              <span className="text-text-faint text-[11px] ml-1.5">{mod.widthHP}HP</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
