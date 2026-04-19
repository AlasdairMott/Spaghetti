import type { ReactNode, MouseEvent } from "react";

type Variant = "default" | "accent" | "danger";

const base =
  "flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-xs border transition-transform duration-75 active:scale-[0.97] select-none";

const variants: Record<Variant, string> = {
  default: "bg-surface-3 border-border-light text-text hover:bg-surface-4",
  accent:
    "bg-accent-bg border-accent-border text-accent-text hover:brightness-110",
  danger:
    "bg-danger-bg border-danger-border text-danger hover:brightness-110",
};

interface Props {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
}

export function SidebarButton({
  children,
  onClick,
  variant = "default",
  className = "",
  disabled = false,
}: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${disabled ? "opacity-40 pointer-events-none" : ""} ${className}`}
    >
      {children}
    </button>
  );
}
