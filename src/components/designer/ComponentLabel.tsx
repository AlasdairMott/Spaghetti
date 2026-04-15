import type { PanelComponent, LabelColor } from "../../models/types";
import { useAppStore } from "../../store";

const COLOR_MAP: Record<Exclude<LabelColor, "custom">, string> = {
  yellow: "#E5C31F",
  blue: "#5A7CB8",
  red: "#DC1F3A",
  green: "#98B657",
};

interface Props {
  component: PanelComponent;
  /** Legacy single-axis offset (used when x/textAnchor/rotation aren't supplied). */
  y: number;
  /** Optional explicit X offset (defaults to 0). */
  x?: number;
  textAnchor?: "start" | "middle" | "end";
  /** Rotation in degrees, applied around (x, y). */
  rotation?: number;
}

export function ComponentLabel({
  component,
  y,
  x = 0,
  textAnchor = "middle",
  rotation = 0,
}: Props) {
  const renderMode = useAppStore((s) => s.renderMode);
  const theme = useAppStore((s) => s.theme);
  const isLight = theme === "light";
  const textColor = renderMode === "rendered" ? "#231F20" : isLight ? "#333" : "#ddd";
  if (!component.label && !component.labelColor) return null;

  const dotColor = component.labelColor
    ? component.labelColor === "custom"
      ? component.labelColorCustom || "#fff"
      : COLOR_MAP[component.labelColor]
    : null;

  // Approximate text width for dot positioning (only used when textAnchor === "middle")
  const textLen = (component.label?.length ?? 0) * 1.1;
  const dotMiddleOffset = textLen / 2 + 1.5;
  // Dot position depends on text anchor — sits just before the text start
  const dotCx =
    textAnchor === "middle"
      ? component.label ? -dotMiddleOffset : 0
      : textAnchor === "start"
        ? component.label ? -1.5 : 0
        : component.label ? 1.5 : 0;

  const transform = rotation ? `rotate(${rotation} ${x} ${y})` : undefined;

  return (
    <g transform={transform}>
      {component.label && (
        <text
          x={x}
          y={y}
          textAnchor={textAnchor}
          fill={textColor}
          fontSize={2}
          style={{ userSelect: "none", fontFamily: "Plus Jakarta Sans" }}
        >
          {component.label}
        </text>
      )}
      {dotColor && (
        <circle
          cx={x + dotCx}
          cy={y - 0.7}
          r={0.7}
          fill={dotColor}
        />
      )}
    </g>
  );
}
