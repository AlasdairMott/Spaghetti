import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "../../store";
import type { AppMode, Module } from "../../models/types";
import { Sun, Moon, Play, Square, Menu } from "lucide-react";
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
  const resetProject = useAppStore((s) => s.resetProject);
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggleAudio = useCallback(() => {
    toggleAudio();
  }, []);

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

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [menuOpen]);

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

  const handleExport = () => {
    setMenuOpen(false);
    const state = useAppStore.getState();
    const data = JSON.stringify(
      { modules: state.modules, rack: state.rack, canvas: state.canvas },
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
  };

  const handleImport = () => {
    setMenuOpen(false);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.modules || !Array.isArray(data.modules)) {
          alert("Invalid project file.");
          return;
        }
        if (!confirm("This will replace your current project. Continue?"))
          return;
        if (audioRunning) toggleAudio();
        useAppStore.setState({
          modules: data.modules as Module[],
          ...(data.rack ? { rack: data.rack } : {}),
          ...(data.canvas ? { canvas: data.canvas } : {}),
        });
      } catch {
        alert("Failed to read project file.");
      }
    };
    input.click();
  };

  const handleNewProject = () => {
    setMenuOpen(false);
    if (
      !confirm(
        "Start a new project? This will replace all modules, rack, and canvas with the built-in defaults.",
      )
    )
      return;
    if (audioRunning) toggleAudio();
    resetProject();
  };

  const modes: { id: AppMode; label: string }[] = [
    { id: "designer", label: "Module Designer" },
    { id: "canvas", label: "Canvas" },
    { id: "rack", label: "Rack View" },
  ];

  const menuItemCls =
    "w-full text-left px-3 py-1.5 text-[13px] bg-transparent border-none cursor-pointer text-text hover:bg-surface-3";

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-1 border-b border-border">
      {/* Hamburger menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 bg-surface-3 border border-border-light rounded cursor-pointer text-text-muted"
          title="Menu"
        >
          <Menu size={14} />
        </button>
        {menuOpen && (
          <div className="absolute top-full left-0 mt-1 bg-surface-2 border border-border-light rounded-lg shadow-lg overflow-hidden z-50 min-w-40">
            <button onClick={handleNewProject} className={menuItemCls}>
              New Project
            </button>
            <div className="h-px bg-border mx-2" />
            <button onClick={handleImport} className={menuItemCls}>
              Import Project...
            </button>
            <button onClick={handleExport} className={menuItemCls}>
              Export Project
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleToggleAudio}
        className={`p-1.5 rounded cursor-pointer border ${
          audioRunning
            ? "bg-danger-bg border-danger-border text-danger"
            : "bg-success-bg border-success-border text-success-text"
        }`}
        title={audioRunning ? "Stop Audio (Space)" : "Play Audio (Space)"}
      >
        {audioRunning ? (
          <Square size={14} fill="currentColor" />
        ) : (
          <Play size={14} fill="currentColor" />
        )}
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
              <option value="" disabled>
                Load Module...
              </option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.widthHP}HP)
                </option>
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
