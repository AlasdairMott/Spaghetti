import type { PanelComponent } from "../../models/types";
import { gridToMm } from "../../utils/grid";
import { ButtonShape } from "./shapes/ButtonShape";
import { LedShape } from "./shapes/LedShape";
import { ComponentLabel } from "./ComponentLabel";
import { computeButtonLayout, resolveLabelLayout } from "../../utils/buttonLayout";

interface Props {
  component: PanelComponent;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent<SVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGElement>) => void;
  onDoubleClick?: () => void;
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
  const ledPosition = component.buttonLedPosition ?? "above";
  const layout = computeButtonLayout(ledCount, ledPosition);
  const label = resolveLabelLayout(component, 5);

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      style={{ cursor: "pointer" }}
    >
      {layout.ledPositions.map((p, i) => (
        <g key={i} transform={`translate(${p.x}, ${p.y})`}>
          <LedShape />
        </g>
      ))}
      <g transform={`translate(${layout.buttonOffset.x}, ${layout.buttonOffset.y})`}>
        <ButtonShape stroke={isSelected ? "#4af" : "#aaa"} />
      </g>
      <ComponentLabel
        component={component}
        x={label.x}
        y={label.y}
        textAnchor={label.textAnchor}
        rotation={label.rotation}
      />
    </g>
  );
}
