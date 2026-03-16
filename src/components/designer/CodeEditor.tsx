import Editor from "@monaco-editor/react";
import { useAppStore } from "../../store";
import { useCallback, useRef } from "react";


const DEFAULT_CODE = `// Called once when audio starts
// sampleRate: number (e.g. 44100)
function init(sampleRate) {
  return { phase: 0 };
}

// Called for each audio block (128 samples)
// inputs: { jackLabel: Float32Array, ... } — one per input jack, keyed by label/ref
// outputs: { jackLabel: Float32Array, ... } — one per output jack, keyed by label/ref
// params: { knobLabel: 0-1, ... } — one per pot, keyed by label/ref
// buttons: { btnLabel: true/false, ... } — one per button, keyed by label/ref
function process(state, inputs, outputs, params, buttons) {
  return state;
}
`;

export function CodeEditor() {
  const code = useAppStore((s) => s.editingModule?.code);
  const updateModuleCode = useAppStore((s) => s.updateModuleCode);
  const theme = useAppStore((s) => s.theme);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value == null) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        updateModuleCode(value);
      }, 500);
    },
    [updateModuleCode],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1.5 bg-surface-1 border-b border-border text-xs text-text-muted font-sans">
        Module Audio Code
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          defaultLanguage="javascript"
          value={code ?? DEFAULT_CODE}
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
      </div>
    </div>
  );
}
