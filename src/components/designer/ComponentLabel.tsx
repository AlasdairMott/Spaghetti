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
  y: number;
}

export function ComponentLabel({ component, y }: Props) {
  const renderMode = useAppStore((s) => s.renderMode);
  const textColor = renderMode === "rendered" ? "#231F20" : "#ddd";
  if (!component.label && !component.labelColor) return null;

  const dotColor = component.labelColor
    ? component.labelColor === "custom"
      ? component.labelColorCustom || "#fff"
      : COLOR_MAP[component.labelColor]
    : null;

  // Measure approximate text width for dot positioning
  const textLen = (component.label?.length ?? 0) * 1.1;
  const dotOffset = textLen / 2 + 1.5;

  return (
    <>
      {component.label && (
        <text
          y={y}
          textAnchor="middle"
          fill={textColor}
          fontSize={2}
          style={{ userSelect: "none", fontFamily: "Plus Jakarta Sans" }}
        >
          {component.label}
        </text>
      )}
      {dotColor && (
        <circle
          cx={component.label ? -dotOffset : 0}
          cy={component.label ? y - 0.7 : y - 0.7}
          r={0.7}
          fill={dotColor}
        />
      )}
    </>
  );
}
