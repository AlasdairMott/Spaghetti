import { useAppStore } from "../../store";
import type { Tool } from "../../models/types";

const tools: { id: Tool; label: string; shortcut: string }[] = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "addJack", label: "Add Jack", shortcut: "J" },
  { id: "addPot", label: "Add Pot", shortcut: "P" },
  { id: "addButton", label: "Add Button", shortcut: "B" },
];

export function ToolPalette() {
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);

  return (
    <div style={{
      display: "flex",
      gap: 8,
      padding: "8px 16px",
      background: "#1e1e1e",
      borderTop: "1px solid #333",
    }}>
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          style={{
            padding: "6px 16px",
            background: activeTool === tool.id ? "#4af" : "#333",
            color: activeTool === tool.id ? "#000" : "#ddd",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: activeTool === tool.id ? 600 : 400,
          }}
          title={`${tool.label} (${tool.shortcut})`}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}
