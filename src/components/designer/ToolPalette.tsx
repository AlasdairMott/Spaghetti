import { useAppStore } from "../../store";
import type { Tool } from "../../models/types";
import type { ComponentType } from "react";
import {
  MousePointer2,
  MoveUpRight,
  Slash,
  Square,
} from "lucide-react";

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
  { id: "addRect", label: "Rectangle", shortcut: "R", Icon: lucideIcon(Square) },
];

export function ToolPalette() {
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1.5 p-1.5 bg-surface-1 rounded-xl shadow-lg border border-border-light">
      {tools.map((tool) => {
        const isActive = activeTool === tool.id;
        const color = isActive ? "var(--color-surface-0)" : "var(--color-text)";
        return (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={`w-8 h-8 border-none rounded-lg cursor-pointer flex items-center justify-center ${
              isActive ? "bg-accent" : "bg-transparent hover:bg-surface-3"
            }`}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <tool.Icon color={color} />
          </button>
        );
      })}
    </div>
  );
}
