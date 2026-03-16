import type { PanelComponent } from "../../models/types";
import { gridToMm } from "../../utils/grid";
import { JackShape } from "./shapes/JackShape";
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

export function JackSymbol({
  component,
  isSelected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
}: Props) {
  const { x, y } = gridToMm(component.position);

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      style={{ cursor: "pointer" }}
    >
      <JackShape stroke={isSelected ? "#4af" : "#aaa"} />
      {component.hasLed && (
        <g transform="translate(-6.35, 0)">
          <LedShape />
        </g>
      )}
      <ComponentLabel component={component} y={-5} />
    </g>
  );
}
