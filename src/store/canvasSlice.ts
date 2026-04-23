import type { StateCreator } from "zustand";
import type { Canvas, CanvasPlacement, RackWireEndpoint, ViewState } from "../models/types";
import type { AppStore } from "./index";
import { HP_WIDTH, PANEL_HEIGHT } from "../constants/grid";

const WIRE_COLORS = ["#e44", "#4ae", "#4d4", "#fd0", "#f4a", "#a4f", "#fa4", "#4dd"];
const SNAP_THRESHOLD = 3; // mm

export interface CanvasSlice {
  canvases: Canvas[];
  /** Computed getter — resolves to the active canvas via activeViewTabId */
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
  setActiveCanvasView: (view: ViewState) => void;
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

    const overlapY = myBottom + SNAP_THRESHOLD > p.y && y - SNAP_THRESHOLD < pBottom;
    const overlapX = myRight + SNAP_THRESHOLD > p.x && x - SNAP_THRESHOLD < pRight;

    if (overlapY) {
      const d1 = Math.abs(myRight - p.x);
      if (d1 < bestDx) { bestDx = d1; snappedX = p.x - widthMm; }
      const d2 = Math.abs(x - pRight);
      if (d2 < bestDx) { bestDx = d2; snappedX = pRight; }
      const d3 = Math.abs(x - p.x);
      if (d3 < bestDx) { bestDx = d3; snappedX = p.x; }
      const d4 = Math.abs(myRight - pRight);
      if (d4 < bestDx) { bestDx = d4; snappedX = pRight - widthMm; }
    }

    if (overlapX) {
      const d5 = Math.abs(myBottom - p.y);
      if (d5 < bestDy) { bestDy = d5; snappedY = p.y - PANEL_HEIGHT; }
      const d6 = Math.abs(y - pBottom);
      if (d6 < bestDy) { bestDy = d6; snappedY = pBottom; }
      const d7 = Math.abs(y - p.y);
      if (d7 < bestDy) { bestDy = d7; snappedY = p.y; }
      const d8 = Math.abs(myBottom - pBottom);
      if (d8 < bestDy) { bestDy = d8; snappedY = pBottom - PANEL_HEIGHT; }
    }
  }

  return { x: snappedX, y: snappedY };
}

const EMPTY_CANVAS: Canvas = {
  id: "empty",
  name: "Empty",
  placements: [],
  wires: [],
  knobStates: [],
  buttonStates: [],
};

function getActiveCanvas(state: AppStore): Canvas {
  const tab = state.viewTabs.find((t) => t.id === state.activeViewTabId);
  if (tab?.kind === "canvas") {
    return state.canvases.find((c) => c.id === tab.dataId) ?? state.canvases[0] ?? EMPTY_CANVAS;
  }
  return state.canvases[0] ?? EMPTY_CANVAS;
}

function updateActiveCanvas(state: AppStore, updater: (canvas: Canvas) => Canvas): Partial<AppStore> {
  const active = getActiveCanvas(state);
  return {
    canvases: state.canvases.map((c) => (c.id === active.id ? updater(c) : c)),
  };
}

export const createCanvasSlice: StateCreator<AppStore, [], [], CanvasSlice> = (set) => ({
  canvases: [],

  // Derived field — kept in sync by the subscribe handler in store/index.ts
  canvas: EMPTY_CANVAS,

  canvasSelectedWireIds: [],
  canvasSelectedPlacementIds: [],

  canvasPlaceModule: (moduleId, x, y) =>
    set((state) => {
      const canvas = getActiveCanvas(state);
      const mod = state.modules.find((m) => m.id === moduleId);
      if (!mod) return state;
      const placement: CanvasPlacement = {
        id: crypto.randomUUID(),
        moduleId,
        x,
        y,
      };
      const getWidth = (id: string) =>
        (state.modules.find((m) => m.id === id)?.widthHP ?? 0) * HP_WIDTH;
      const snapped = snapPosition(
        x, y, mod.widthHP * HP_WIDTH,
        canvas.placements, placement.id, getWidth,
      );
      placement.x = snapped.x;
      placement.y = snapped.y;
      return updateActiveCanvas(state, (c) => ({
        ...c,
        placements: [...c.placements, placement],
      }));
    }),

  canvasRemovePlacement: (placementId) =>
    set((state) =>
      updateActiveCanvas(state, (c) => ({
        ...c,
        placements: c.placements.filter((p) => p.id !== placementId),
        wires: (c.wires ?? []).filter(
          (w) => w.from.placementId !== placementId && w.to.placementId !== placementId,
        ),
        knobStates: (c.knobStates ?? []).filter(
          (k) => k.placementId !== placementId,
        ),
        buttonStates: (c.buttonStates ?? []).filter(
          (b) => b.placementId !== placementId,
        ),
      }))
    ),

  canvasMoveModule: (placementId, x, y) =>
    set((state) => {
      const canvas = getActiveCanvas(state);
      const existing = canvas.placements.find((p) => p.id === placementId);
      if (!existing) return state;
      const mod = state.modules.find((m) => m.id === existing.moduleId);
      if (!mod) return state;
      const getWidth = (id: string) =>
        (state.modules.find((m) => m.id === id)?.widthHP ?? 0) * HP_WIDTH;
      const snapped = snapPosition(
        x, y, mod.widthHP * HP_WIDTH,
        canvas.placements, placementId, getWidth,
      );
      return updateActiveCanvas(state, (c) => ({
        ...c,
        placements: [
          ...c.placements.filter((p) => p.id !== placementId),
          { ...existing, x: snapped.x, y: snapped.y },
        ],
      }));
    }),

  canvasBatchMoveModules: (moves) =>
    set((state) => {
      const moveMap = new Map(moves.map((m) => [m.placementId, m]));
      return updateActiveCanvas(state, (c) => ({
        ...c,
        placements: c.placements.map((p) => {
          const move = moveMap.get(p.id);
          return move ? { ...p, x: move.x, y: move.y } : p;
        }),
      }));
    }),

  canvasAddWire: (from, to) =>
    set((state) => {
      const canvas = getActiveCanvas(state);
      const existingWires = canvas.wires ?? [];

      const isInputOccupied = (ep: RackWireEndpoint) => {
        const placement = canvas.placements.find((p) => p.id === ep.placementId);
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

      return updateActiveCanvas(state, (c) => ({
        ...c,
        wires: [
          ...(c.wires ?? []),
          {
            id: crypto.randomUUID(),
            color: WIRE_COLORS[Math.floor(Math.random() * WIRE_COLORS.length)],
            from,
            to,
          },
        ],
      }));
    }),

  canvasRemoveWire: (id) =>
    set((state) => ({
      ...updateActiveCanvas(state, (c) => ({
        ...c,
        wires: (c.wires ?? []).filter((w) => w.id !== id),
      })),
      canvasSelectedWireIds: state.canvasSelectedWireIds.filter((wid) => wid !== id),
    })),

  canvasSelectWires: (ids) => set({ canvasSelectedWireIds: ids }),

  canvasSelectPlacements: (ids) => set({ canvasSelectedPlacementIds: ids, canvasSelectedWireIds: [] }),

  canvasSetKnobAngle: (placementId, componentId, angle) =>
    set((state) =>
      updateActiveCanvas(state, (c) => {
        const knobStates = [...(c.knobStates ?? [])];
        const idx = knobStates.findIndex(
          (k) => k.placementId === placementId && k.componentId === componentId,
        );
        if (idx >= 0) {
          knobStates[idx] = { ...knobStates[idx], angle };
        } else {
          knobStates.push({ placementId, componentId, angle });
        }
        return { ...c, knobStates };
      })
    ),

  canvasToggleButton: (placementId, componentId) =>
    set((state) =>
      updateActiveCanvas(state, (c) => {
        const buttonStates = [...(c.buttonStates ?? [])];
        const idx = buttonStates.findIndex(
          (b) => b.placementId === placementId && b.componentId === componentId,
        );
        if (idx >= 0) {
          buttonStates[idx] = { ...buttonStates[idx], pressed: !buttonStates[idx].pressed };
        } else {
          buttonStates.push({ placementId, componentId, pressed: true });
        }
        return { ...c, buttonStates };
      })
    ),

  canvasUpdateWireEndpoint: (wireId, end, newEndpoint) =>
    set((state) => {
      const canvas = getActiveCanvas(state);
      const wires = canvas.wires ?? [];
      const wire = wires.find((w) => w.id === wireId);
      if (!wire) return state;

      const otherWires = wires.filter((w) => w.id !== wireId);
      const placement = canvas.placements.find((p) => p.id === newEndpoint.placementId);
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

      return updateActiveCanvas(state, (c) => ({
        ...c,
        wires: (c.wires ?? []).map((w) =>
          w.id === wireId ? { ...w, [end]: newEndpoint } : w,
        ),
      }));
    }),

  canvasClearWires: () =>
    set((state) => ({
      ...updateActiveCanvas(state, (c) => ({ ...c, wires: [] })),
      canvasSelectedWireIds: [],
    })),

  setActiveCanvasView: (view) =>
    set((state) => updateActiveCanvas(state, (c) => ({ ...c, view }))),
});
