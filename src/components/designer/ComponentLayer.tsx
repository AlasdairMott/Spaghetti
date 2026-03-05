import { useAppStore } from "../../store";
import { JackSymbol } from "./JackSymbol";
import { PotSymbol } from "./PotSymbol";
import { ButtonSymbol } from "./ButtonSymbol";
import { useDragComponent } from "../../hooks/useDragComponent";
import type { JSX } from "react";

interface Props {
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export function ComponentLayer({ svgRef }: Props) {
  const components = useAppStore((s) => s.editingModule?.components ?? []);
  const selectedIds = useAppStore((s) => s.selectedComponentIds);
  const updateComponent = useAppStore((s) => s.updateComponent);
  const {
    handleComponentPointerDown,
    handleComponentPointerMove,
    handleComponentPointerUp,
  } = useDragComponent();

  const handleDoubleClick = (compId: string, currentLabel: string) => {
    const newLabel = prompt("Enter label:", currentLabel);
    if (newLabel !== null) {
      updateComponent(compId, { label: newLabel });
    }
  };

  return (
    <g>
      {components.map((comp) => {
        const isSelected = selectedIds.includes(comp.id);
        let Symbol: (props: any) => JSX.Element;
        switch (comp.kind) {
          case "jack":
            Symbol = JackSymbol;
            break;
          case "pot":
            Symbol = PotSymbol;
            break;
          case "button":
            Symbol = ButtonSymbol;
            break;
          default:
            return null;
        }

        const onDown = (e: React.PointerEvent<SVGElement>) => {
          if (svgRef.current) {
            handleComponentPointerDown(e, comp.id, svgRef.current);
          }
        };
        const onMove = (e: React.PointerEvent<SVGElement>) => {
          if (svgRef.current) {
            handleComponentPointerMove(e, svgRef.current);
          }
        };

        return (
          <Symbol
            key={comp.id}
            component={comp}
            isSelected={isSelected}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={handleComponentPointerUp}
            onDoubleClick={() => handleDoubleClick(comp.id, comp.label)}
          />
        );
      })}
    </g>
  );
}
