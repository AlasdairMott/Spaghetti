import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../../store";
import type { AppMode } from "../../models/types";
import { Sun, Moon, Play, Square } from "lucide-react";
import { toggleAudio } from "../../audio/singleton";

export function Toolbar() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const editingModule = useAppStore((s) => s.editingModule);
  const modules = useAppStore((s) => s.modules);
  const saveModule = useAppStore((s) => s.saveModule);
  const createNewModule = useAppStore((s) => s.createNewModule);
  const openModuleForEditing = useAppStore((s) => s.openModuleForEditing);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const audioRunning = useAppStore((s) => s.audioRunning);
  const [saved, setSaved] = useState(false);

  const handleToggleAudio = useCallback(() => { toggleAudio(); }, []);

  // Spacebar play/pause (ignore when typing in inputs/editors)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).closest(".monaco-editor")) return;
      e.preventDefault();
      toggleAudio();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    { id: "canvas", label: "Canvas" },
    { id: "rack", label: "Rack View" },
  ];

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-1 border-b border-border">
      <button
        onClick={handleToggleAudio}
        className={`p-1.5 rounded cursor-pointer border ${
          audioRunning
            ? "bg-danger-bg border-danger-border text-danger"
            : "bg-success-bg border-success-border text-success-text"
        }`}
        title={audioRunning ? "Stop Audio (Space)" : "Play Audio (Space)"}
      >
        {audioRunning ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>

      <div className="flex gap-0.5">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-1 text-[13px] cursor-pointer border-none rounded-t-md relative ${
              mode === m.id
                ? "bg-surface-2 text-text font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent"
                : "bg-transparent text-text-dim hover:text-text-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="p-1.5 bg-surface-3 border border-border-light rounded cursor-pointer text-text-muted"
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      {mode === "designer" && (
        <>
          {modules.length > 0 && (
            <select
              className="px-2 py-1 bg-surface-3 text-text border border-border-light rounded text-xs cursor-pointer"
              onChange={handleLoad}
              defaultValue=""
            >
              <option value="" disabled>Load Module...</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.widthHP}HP)</option>
              ))}
            </select>
          )}
          <button
            onClick={handleNew}
            className="px-3 py-1 bg-surface-3 text-text border border-border-light rounded text-xs cursor-pointer"
          >
            New Module
          </button>
          <button
            onClick={handleSave}
            className={`px-3 py-1 rounded text-xs cursor-pointer border transition-all ${
              saved
                ? "bg-[#363] text-[#8f8] border-[#5b5]"
                : "bg-success-bg text-success-text border-success-border"
            }`}
          >
            {saved ? "Saved!" : "Save Module"}
          </button>
        </>
      )}
    </div>
  );
}
