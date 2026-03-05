import { useAppStore } from "../../../store";

interface Props {
  color?: string;
}

export function LedShape({ color = "#f44" }: Props) {
  const renderMode = useAppStore((s) => s.renderMode);

  if (renderMode === "rendered") {
    const gradId = `led-glow-${color.replace("#", "")}`;
    return (
      <>
        <defs>
          <radialGradient id={gradId} cx="40%" cy="35%">
            <stop offset="0%" stopColor="#fff" stopOpacity={0.6} />
            <stop offset="40%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={color} stopOpacity={0.5} />
          </radialGradient>
        </defs>
        {/* Glow */}
        <circle r={1.8} fill={color} opacity={0.15} />
        {/* Body */}
        <circle r={1} fill={`url(#${gradId})`} />
        {/* Specular highlight */}
        <circle cx={-0.25} cy={-0.25} r={0.35} fill="#fff" opacity={0.5} />
      </>
    );
  }

  return (
    <>
      <circle r={1} fill={color} opacity={0.8} />
      <circle r={0.5} fill="#fff" opacity={0.3} />
    </>
  );
}
