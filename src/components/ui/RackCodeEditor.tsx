import Editor from "@monaco-editor/react";
import { useAppStore } from "../../store";
import { useCallback, useRef, useState, useEffect } from "react";
import { toggleAudio } from "../../audio/singleton";

const DEFAULT_CODE = `// Called once when audio starts
function init(sampleRate) {
  return { phase: 0 };
}

// Called for each audio block (128 samples)
function process(state, inputs, outputs, params, buttons) {
  return state;
}
`;

export function RackCodeEditor() {
  const modules = useAppStore((s) => s.modules);
  const saveModule = useAppStore((s) => s.saveModule);
  const audioRunning = useAppStore((s) => s.audioRunning);
  const theme = useAppStore((s) => s.theme);

  const [selectedId, setSelectedId] = useState<string>(() => modules[0]?.id ?? "");
  const module = modules.find((m) => m.id === selectedId) ?? null;

  const [localCode, setLocalCode] = useState(module?.code ?? DEFAULT_CODE);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when selected module changes
  useEffect(() => {
    const mod = modules.find((m) => m.id === selectedId);
    setLocalCode(mod?.code ?? DEFAULT_CODE);
    setDirty(false);
  }, [selectedId, modules]);

  // If selected module was deleted, pick first available
  useEffect(() => {
    if (selectedId && !modules.find((m) => m.id === selectedId)) {
      setSelectedId(modules[0]?.id ?? "");
    }
  }, [modules, selectedId]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value == null) return;
      setLocalCode(value);
      setDirty(value !== (module?.code ?? DEFAULT_CODE));
    },
    [module?.code],
  );

  const handleSave = useCallback(async () => {
    if (!module) return;
    saveModule({ ...module, code: localCode });
    setDirty(false);
    setSaved(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), 1500);

    // Restart audio to recompile if it was running
    if (audioRunning) {
      await toggleAudio(); // stop
      await toggleAudio(); // start with new code
    }
  }, [module, localCode, saveModule, audioRunning]);

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.target as HTMLElement)?.closest(".monaco-editor")) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-1 border-b border-border">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 min-w-0 px-1.5 py-0.5 bg-surface-3 border border-border-light rounded text-text text-[12px] cursor-pointer truncate"
        >
          {modules.length === 0 && <option value="">No modules</option>}
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.widthHP}HP)
            </option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={!dirty && !saved}
          className={`px-2 py-0.5 rounded text-[11px] cursor-pointer border transition-all shrink-0 ${
            saved
              ? "bg-[#363] text-[#8f8] border-[#5b5]"
              : dirty
                ? "bg-success-bg text-success-text border-success-border"
                : "bg-surface-3 text-text-dim border-border-light cursor-default"
          }`}
        >
          {saved ? "Saved!" : dirty ? "Save & Recompile" : "Saved"}
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {module ? (
          <Editor
            key={selectedId}
            defaultLanguage="javascript"
            value={localCode}
            onChange={handleChange}
            theme={theme === "light" ? "light" : "vs-dark"}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              tabSize: 2,
              automaticLayout: true,
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-text-faint">
            No modules available
          </div>
        )}
      </div>
    </div>
  );
}
