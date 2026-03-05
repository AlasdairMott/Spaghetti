import type { PanelComponent } from "../../models/types";
import { gridToMm } from "../../utils/grid";
import { PotShape } from "./shapes/PotShape";
import { ComponentLabel } from "./ComponentLabel";

interface Props {
  component: PanelComponent;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent<SVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGElement>) => void;
  onDoubleClick?: () => void;
}

export function PotSymbol({
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
      <PotShape stroke={isSelected ? "#4af" : "#aaa"} />
      <ComponentLabel component={component} y={-8} />
    </g>
  );
}
