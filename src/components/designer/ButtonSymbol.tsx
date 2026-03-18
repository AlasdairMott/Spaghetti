import type { PanelComponent } from "../../models/types";
import { gridToMm } from "../../utils/grid";
import { ButtonShape } from "./shapes/ButtonShape";
import { LedShape } from "./shapes/LedShape";
import { ComponentLabel } from "./ComponentLabel";

interface Props {
  component: PanelComponent;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent<SVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGElement>) => void;
  onDoubleClick?: () => void;
}

/** Compute LED X positions for a given count, spread horizontally */
function ledXPositions(count: number): number[] {
  switch (count) {
    case 1:
      return [0];
    case 2:
      return [-2, 2];
    case 3:
      return [-5.08, 0, 5.08];
    default:
      return [];
  }
}

export function ButtonSymbol({
  component,
  isSelected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
}: Props) {
  const { x, y } = gridToMm(component.position);
  const ledCount = component.buttonLedCount ?? 0;
  const hasLeds = ledCount > 0;

  // When LEDs present: shift button down, LEDs up, label below button
  const buttonOffsetY = hasLeds ? 2.607 : 0;
  const ledOffsetY = hasLeds ? -(5.73 - buttonOffsetY) : 0;
  const labelY = hasLeds ? 8 : -8;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      style={{ cursor: "pointer" }}
    >
      {hasLeds &&
        ledXPositions(ledCount).map((lx, i) => (
          <g key={i} transform={`translate(${lx}, ${ledOffsetY})`}>
            <LedShape />
          </g>
        ))}
      <g transform={`translate(0, ${buttonOffsetY})`}>
        <ButtonShape stroke={isSelected ? "#4af" : "#aaa"} />
      </g>
      <ComponentLabel component={component} y={labelY} />
    </g>
  );
}
