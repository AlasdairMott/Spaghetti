import { useAppStore } from "../../store";
import type { Tool } from "../../models/types";
import type { ComponentType } from "react";
import {
  MousePointer2,
  MoveUpRight,
  Slash,
} from "lucide-react";

function JackIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke={color}
        strokeWidth="1.2"
        fill="none"
      />
      <circle
        cx="10"
        cy="10"
        r="4.5"
        stroke={color}
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

function PotIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke={color}
        strokeWidth="1.2"
        fill="none"
      />
      <line
        x1="10"
        y1="10"
        x2="10"
        y2="2"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ButtonIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect
        x="2"
        y="2"
        width="16"
        height="16"
        rx="2"
        stroke={color}
        strokeWidth="1.2"
        fill="none"
      />
      <rect
        x="5"
        y="5"
        width="10"
        height="10"
        rx="1.5"
        stroke={color}
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

type IconProps = { color: string };

function lucideIcon(
  LucideComp: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
) {
  return function Icon({ color }: IconProps) {
    return <LucideComp size={20} color={color} strokeWidth={1.5} />;
  };
}

const tools: {
  id: Tool;
  label: string;
  shortcut: string;
  Icon: (props: IconProps) => React.JSX.Element;
}[] = [
  { id: "select", label: "Select", shortcut: "V", Icon: lucideIcon(MousePointer2) },
  { id: "addJack", label: "Add Jack", shortcut: "J", Icon: JackIcon },
  { id: "addPot", label: "Add Pot", shortcut: "P", Icon: PotIcon },
  { id: "addButton", label: "Add Button", shortcut: "B", Icon: ButtonIcon },
  { id: "addLine", label: "Line", shortcut: "L", Icon: lucideIcon(Slash) },
  { id: "addArrow", label: "Arrow", shortcut: "A", Icon: lucideIcon(MoveUpRight) },
];

export function ToolPalette() {
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "8px 16px",
        background: "#1e1e1e",
        borderTop: "1px solid #333",
      }}
    >
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
