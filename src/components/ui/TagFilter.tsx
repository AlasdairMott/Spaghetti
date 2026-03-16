import { useMemo } from "react";
import type { Module } from "../../models/types";

interface TagFilterProps {
  modules: Module[];
  activeTag: string | null;
  onTagChange: (tag: string | null) => void;
}

export function TagFilter({ modules, activeTag, onTagChange }: TagFilterProps) {
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const m of modules) {
      for (const t of m.tags ?? []) set.add(t);
    }
    return [...set].sort();
  }, [modules]);

  if (allTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {allTags.map((tag) => (
        <button
          key={tag}
          onClick={() => onTagChange(activeTag === tag ? null : tag)}
          className={`px-1.5 py-0.5 rounded text-[10px] border-none cursor-pointer ${
            activeTag === tag
              ? "bg-accent text-surface-0"
              : "bg-surface-3 text-text-muted hover:bg-surface-4"
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

export function filterModulesByTag(modules: Module[], tag: string | null): Module[] {
  if (!tag) return modules;
  return modules.filter((m) => m.tags?.includes(tag));
}
