import type { GridPosition, ComponentKind } from "../../models/types";
import { gridToMm } from "../../utils/grid";
import { JackShape } from "./shapes/JackShape";
import { PotShape } from "./shapes/PotShape";
import { ButtonShape } from "./shapes/ButtonShape";

interface Props {
  position: GridPosition;
  kind: ComponentKind;
}

const shapeMap: Record<ComponentKind, React.FC<{ stroke?: string }>> = {
  jack: JackShape,
  pot: PotShape,
  button: ButtonShape,
};

export function PlacementPreview({ position, kind }: Props) {
  const { x, y } = gridToMm(position);
  const Shape = shapeMap[kind];

  return (
    <g transform={`translate(${x}, ${y})`} opacity={0.5} pointerEvents="none">
      <Shape stroke="#4af" />
    </g>
  );
}
