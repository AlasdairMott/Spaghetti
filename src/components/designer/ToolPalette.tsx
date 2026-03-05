import { useAppStore } from "../../store";
import type { Tool } from "../../models/types";
import type { JSX } from "react";

function SelectIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M5 2 L5 16 L9 12 L13 18 L15 17 L11 11 L16 11 Z"
        fill={color}
      />
    </svg>
  );
}

function JackIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.2" fill="none" />
      <circle cx="10" cy="10" r="4.5" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}

function PotIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.2" fill="none" />
      <line x1="10" y1="10" x2="10" y2="2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ButtonIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="16" height="16" rx="2" stroke={color} strokeWidth="1.2" fill="none" />
      <rect x="5" y="5" width="10" height="10" rx="1.5" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}

function LineIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <line x1="3" y1="17" x2="17" y2="3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <line x1="3" y1="17" x2="17" y2="3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <polyline points="11,3 17,3 17,9" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

const tools: { id: Tool; label: string; shortcut: string; Icon: (props: { color: string }) => JSX.Element }[] = [
  { id: "select", label: "Select", shortcut: "V", Icon: SelectIcon },
  { id: "addJack", label: "Add Jack", shortcut: "J", Icon: JackIcon },
  { id: "addPot", label: "Add Pot", shortcut: "P", Icon: PotIcon },
  { id: "addButton", label: "Add Button", shortcut: "B", Icon: ButtonIcon },
  { id: "addLine", label: "Line", shortcut: "L", Icon: LineIcon },
  { id: "addArrow", label: "Arrow", shortcut: "A", Icon: ArrowIcon },
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
      {tools.map((tool) => {
        const isActive = activeTool === tool.id;
        const color = isActive ? "#111" : "#ddd";
        return (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            style={{
              padding: "4px 8px",
              background: isActive ? "#4af" : "#333",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <tool.Icon color={color} />
          </button>
        );
      })}
    </div>
  );
}
