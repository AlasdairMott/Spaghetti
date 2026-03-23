import type { StateCreator } from "zustand";
import type { Canvas, CanvasPlacement, RackWireEndpoint } from "../models/types";
import type { AppStore } from "./index";
import { HP_WIDTH, PANEL_HEIGHT } from "../constants/grid";

const WIRE_COLORS = ["#e44", "#4ae", "#4d4", "#fd0", "#f4a", "#a4f", "#fa4", "#4dd"];
const SNAP_THRESHOLD = 3; // mm

export interface CanvasSlice {
  canvas: Canvas;
  canvasSelectedWireIds: string[];
  canvasSelectedPlacementIds: string[];
  canvasPlaceModule: (moduleId: string, x: number, y: number) => void;
  canvasRemovePlacement: (placementId: string) => void;
  canvasMoveModule: (placementId: string, x: number, y: number) => void;
  canvasBatchMoveModules: (moves: Array<{ placementId: string; x: number; y: number }>) => void;
  canvasAddWire: (from: RackWireEndpoint, to: RackWireEndpoint) => void;
  canvasRemoveWire: (id: string) => void;
  canvasSelectWires: (ids: string[]) => void;
  canvasSelectPlacements: (ids: string[]) => void;
  canvasSetKnobAngle: (placementId: string, componentId: string, angle: number) => void;
  canvasToggleButton: (placementId: string, componentId: string) => void;
  canvasUpdateWireEndpoint: (wireId: string, end: "from" | "to", newEndpoint: RackWireEndpoint) => void;
  canvasClearWires: () => void;
}

/** Snap a placement position to nearby module edges */
export function snapPosition(
  x: number,
  y: number,
  widthMm: number,
  allPlacements: CanvasPlacement[],
  excludeId: string,
  getModuleWidth: (moduleId: string) => number,
): { x: number; y: number } {
  let snappedX = x;
  let snappedY = y;
  let bestDx = SNAP_THRESHOLD;
  let bestDy = SNAP_THRESHOLD;

  const myRight = x + widthMm;
  const myBottom = y + PANEL_HEIGHT;

  for (const p of allPlacements) {
    if (p.id === excludeId) continue;
    const pw = getModuleWidth(p.moduleId);
    const pRight = p.x + pw;
    const pBottom = p.y + PANEL_HEIGHT;

    // Check if modules overlap/touch on each axis (within threshold)
    const overlapY = myBottom + SNAP_THRESHOLD > p.y && y - SNAP_THRESHOLD < pBottom;
    const overlapX = myRight + SNAP_THRESHOLD > p.x && x - SNAP_THRESHOLD < pRight;

    if (overlapY) {
      // Horizontal snapping: my right edge to their left edge
      const d1 = Math.abs(myRight - p.x);
      if (d1 < bestDx) { bestDx = d1; snappedX = p.x - widthMm; }

      // My left edge to their right edge
      const d2 = Math.abs(x - pRight);
      if (d2 < bestDx) { bestDx = d2; snappedX = pRight; }

      // Align left edges
      const d3 = Math.abs(x - p.x);
      if (d3 < bestDx) { bestDx = d3; snappedX = p.x; }

      // Align right edges
      const d4 = Math.abs(myRight - pRight);
      if (d4 < bestDx) { bestDx = d4; snappedX = pRight - widthMm; }
    }

    if (overlapX) {
      // Vertical snapping: my bottom to their top
      const d5 = Math.abs(myBottom - p.y);
      if (d5 < bestDy) { bestDy = d5; snappedY = p.y - PANEL_HEIGHT; }

      // My top to their bottom
      const d6 = Math.abs(y - pBottom);
      if (d6 < bestDy) { bestDy = d6; snappedY = pBottom; }

      // Align tops
      const d7 = Math.abs(y - p.y);
      if (d7 < bestDy) { bestDy = d7; snappedY = p.y; }

      // Align bottoms
      const d8 = Math.abs(myBottom - pBottom);
      if (d8 < bestDy) { bestDy = d8; snappedY = pBottom - PANEL_HEIGHT; }
    }
  }

  return { x: snappedX, y: snappedY };
}

export const createCanvasSlice: StateCreator<AppStore, [], [], CanvasSlice> = (set) => ({
  canvas: {
    id: crypto.randomUUID(),
    name: "Canvas",
    placements: [],
    wires: [],
    knobStates: [],
    buttonStates: [],
  },

  canvasSelectedWireIds: [],
  canvasSelectedPlacementIds: [],

  canvasPlaceModule: (moduleId, x, y) =>
    set((state) => {
      const mod = state.modules.find((m) => m.id === moduleId);
      if (!mod) return state;
      const placement: CanvasPlacement = {
        id: crypto.randomUUID(),
        moduleId,
        x,
        y,
      };
      // Snap to nearby modules
      const getWidth = (id: string) =>
        (state.modules.find((m) => m.id === id)?.widthHP ?? 0) * HP_WIDTH;
      const snapped = snapPosition(
        x, y, mod.widthHP * HP_WIDTH,
        state.canvas.placements, placement.id, getWidth,
      );
      placement.x = snapped.x;
      placement.y = snapped.y;
      return {
        canvas: {
          ...state.canvas,
          placements: [...state.canvas.placements, placement],
        },
      };
    }),

  canvasRemovePlacement: (placementId) =>
    set((state) => ({
      canvas: {
        ...state.canvas,
        placements: state.canvas.placements.filter((p) => p.id !== placementId),
        wires: (state.canvas.wires ?? []).filter(
          (w) => w.from.placementId !== placementId && w.to.placementId !== placementId,
        ),
        knobStates: (state.canvas.knobStates ?? []).filter(
          (k) => k.placementId !== placementId,
        ),
        buttonStates: (state.canvas.buttonStates ?? []).filter(
          (b) => b.placementId !== placementId,
        ),
      },
    })),

  canvasMoveModule: (placementId, x, y) =>
    set((state) => {
      const existing = state.canvas.placements.find((p) => p.id === placementId);
      if (!existing) return state;
      const mod = state.modules.find((m) => m.id === existing.moduleId);
      if (!mod) return state;
      const getWidth = (id: string) =>
        (state.modules.find((m) => m.id === id)?.widthHP ?? 0) * HP_WIDTH;
      const snapped = snapPosition(
        x, y, mod.widthHP * HP_WIDTH,
        state.canvas.placements, placementId, getWidth,
      );
      const others = state.canvas.placements.filter((p) => p.id !== placementId);
      return {
        canvas: {
          ...state.canvas,
          placements: [...others, { ...existing, x: snapped.x, y: snapped.y }],
        },
      };
    }),

  canvasBatchMoveModules: (moves) =>
    set((state) => {
      const moveMap = new Map(moves.map((m) => [m.placementId, m]));
      return {
        canvas: {
          ...state.canvas,
          placements: state.canvas.placements.map((p) => {
            const move = moveMap.get(p.id);
            return move ? { ...p, x: move.x, y: move.y } : p;
          }),
        },
      };
    }),

  canvasAddWire: (from, to) =>
    set((state) => {
      const existingWires = state.canvas.wires ?? [];

      const isInputOccupied = (ep: RackWireEndpoint) => {
        const placement = state.canvas.placements.find((p) => p.id === ep.placementId);
        if (!placement) return false;
        const mod = state.modules.find((m) => m.id === placement.moduleId);
        if (!mod) return false;
        const comp = mod.components.find((c) => c.id === ep.componentId);
        if (!comp || comp.kind !== "jack") return false;
        const dir = comp.jackDirection ?? "input";
        if (dir !== "input" && dir !== "both") return false;
        return existingWires.some(
          (w) =>
            (w.to.placementId === ep.placementId && w.to.componentId === ep.componentId) ||
            (w.from.placementId === ep.placementId && w.from.componentId === ep.componentId),
        );
      };

      if (isInputOccupied(from) || isInputOccupied(to)) return state;

      return {
        canvas: {
          ...state.canvas,
          wires: [
            ...existingWires,
            {
              id: crypto.randomUUID(),
              color: WIRE_COLORS[Math.floor(Math.random() * WIRE_COLORS.length)],
              from,
              to,
            },
          ],
        },
      };
    }),

  canvasRemoveWire: (id) =>
    set((state) => ({
      canvas: {
        ...state.canvas,
        wires: (state.canvas.wires ?? []).filter((w) => w.id !== id),
      },
      canvasSelectedWireIds: state.canvasSelectedWireIds.filter((wid) => wid !== id),
    })),

  canvasSelectWires: (ids) => set({ canvasSelectedWireIds: ids }),

  canvasSelectPlacements: (ids) => set({ canvasSelectedPlacementIds: ids, canvasSelectedWireIds: [] }),

  canvasSetKnobAngle: (placementId, componentId, angle) =>
    set((state) => {
      const knobStates = [...(state.canvas.knobStates ?? [])];
      const idx = knobStates.findIndex(
        (k) => k.placementId === placementId && k.componentId === componentId,
      );
      if (idx >= 0) {
        knobStates[idx] = { ...knobStates[idx], angle };
      } else {
        knobStates.push({ placementId, componentId, angle });
      }
      return { canvas: { ...state.canvas, knobStates } };
    }),

  canvasToggleButton: (placementId, componentId) =>
    set((state) => {
      const buttonStates = [...(state.canvas.buttonStates ?? [])];
      const idx = buttonStates.findIndex(
        (b) => b.placementId === placementId && b.componentId === componentId,
      );
      if (idx >= 0) {
        buttonStates[idx] = { ...buttonStates[idx], pressed: !buttonStates[idx].pressed };
      } else {
        buttonStates.push({ placementId, componentId, pressed: true });
      }
      return { canvas: { ...state.canvas, buttonStates } };
    }),

  canvasUpdateWireEndpoint: (wireId, end, newEndpoint) =>
    set((state) => {
      const wires = state.canvas.wires ?? [];
      const wire = wires.find((w) => w.id === wireId);
      if (!wire) return state;

      const otherWires = wires.filter((w) => w.id !== wireId);
      const placement = state.canvas.placements.find((p) => p.id === newEndpoint.placementId);
      if (placement) {
        const mod = state.modules.find((m) => m.id === placement.moduleId);
        if (mod) {
          const comp = mod.components.find((c) => c.id === newEndpoint.componentId);
          if (comp?.kind === "jack") {
            const dir = comp.jackDirection ?? "input";
            if (dir === "input" || dir === "both") {
              const occupied = otherWires.some(
                (w) =>
                  (w.to.placementId === newEndpoint.placementId && w.to.componentId === newEndpoint.componentId) ||
                  (w.from.placementId === newEndpoint.placementId && w.from.componentId === newEndpoint.componentId),
              );
              if (occupied) return state;
            }
          }
        }
      }

      return {
        canvas: {
          ...state.canvas,
          wires: wires.map((w) =>
            w.id === wireId ? { ...w, [end]: newEndpoint } : w,
          ),
        },
      };
    }),

  canvasClearWires: () =>
    set((state) => ({
      canvas: { ...state.canvas, wires: [] },
      canvasSelectedWireIds: [],
    })),
});
