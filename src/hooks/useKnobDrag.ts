import { useCallback, useRef, useState } from "react";
import type { Module } from "../models/types";

interface KnobDragState {
  placementId: string;
  componentId: string;
  startY: number;
  startAngle: number;
}

/**
 * Shared knob drag logic for rack and canvas views.
 * Uses window-level pointer listeners (not pointer capture) so that
 * double-click-to-reset still works on the knob element.
 * Hold shift for fine control (5× slower).
 */
export function useKnobDrag(
  getStartAngle: (placementId: string, componentId: string) => number,
  onAngleChange: (placementId: string, componentId: string, angle: number) => void,
) {
  const [knobDrag, setKnobDrag] = useState<KnobDragState | null>(null);
  const angleRef = useRef<number>(150);

  const handlePotPointerDown = useCallback(
    (
      e: React.PointerEvent<SVGElement>,
      placementId: string,
      componentId: string,
    ) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      const startAngle = getStartAngle(placementId, componentId);
      const startY = e.clientY;
      angleRef.current = startAngle;
      setKnobDrag({ placementId, componentId, startY, startAngle });

      let lastY = startY;
      const onMove = (ev: PointerEvent) => {
        const dy = lastY - ev.clientY;
        lastY = ev.clientY;
        const speed = ev.shiftKey ? 0.3 : 1.5;
        const newAngle = Math.max(0, Math.min(300, angleRef.current + dy * speed));
        angleRef.current = newAngle;
        onAngleChange(placementId, componentId, newAngle);
      };
      const onUp = () => {
        setKnobDrag(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [getStartAngle, onAngleChange],
  );

  return { knobDrag, handlePotPointerDown, knobDragAngleRef: angleRef };
}

/** Randomize all pot knobs for the given placement IDs. */
export function randomizeKnobs(
  placementIds: string[],
  placements: Array<{ id: string; moduleId: string }>,
  modules: Module[],
  onAngleChange: (placementId: string, componentId: string, angle: number) => void,
) {
  for (const pid of placementIds) {
    const placement = placements.find((p) => p.id === pid);
    if (!placement) continue;
    const mod = modules.find((m) => m.id === placement.moduleId);
    if (!mod) continue;
    for (const comp of mod.components) {
      if (comp.kind !== "pot") continue;
      onAngleChange(pid, comp.id, Math.random() * 300);
    }
  }
}
