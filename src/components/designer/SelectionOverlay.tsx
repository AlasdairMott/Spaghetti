import { useAppStore } from "../../store";
import { gridToMm } from "../../utils/grid";

export function SelectionOverlay() {
  const editingModule = useAppStore((s) => s.editingModule);
  const selectedIds = useAppStore((s) => s.selectedComponentIds);

  if (!editingModule || selectedIds.length === 0) return null;

  return (
    <>
      {selectedIds.map((id) => {
        const comp = editingModule.components.find((c) => c.id === id);
        if (!comp) return null;
        const { x, y } = gridToMm(comp.position);
        const r = comp.kind === "pot" ? 4 : 3.5;
        return (
          <rect
            key={id}
            x={x - r}
            y={y - r}
            width={r * 2}
            height={r * 2}
            fill="none"
            stroke="#4af"
            strokeWidth={0.25}
            strokeDasharray="0.8 0.4"
            pointerEvents="none"
          />
        );
      })}
    </>
  );
}
