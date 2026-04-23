import type { StateCreator } from "zustand";
import type { Rack, RackPlacement, RackWireEndpoint, ViewState } from "../models/types";
import type { AppStore } from "./index";

const WIRE_COLORS = ["#e44", "#4ae", "#4d4", "#fd0", "#f4a", "#a4f", "#fa4", "#4dd"];

export interface RackSlice {
  racks: Rack[];
  /** Computed getter — resolves to the active rack via activeViewTabId */
  rack: Rack;
  selectedWireIds: string[];
  selectedPlacementIds: string[];
  setRackWidth: (hp: number) => void;
  setRackRows: (rows: number) => void;
  placeModule: (moduleId: string, positionHP: number, row: number) => void;
  removeFromRack: (placementId: string) => void;
  moveInRack: (placementId: string, newPositionHP: number, newRow?: number) => void;
  batchMoveInRack: (moves: Array<{ placementId: string; positionHP: number; row: number }>) => void;
  addWire: (from: RackWireEndpoint, to: RackWireEndpoint) => void;
  removeWire: (id: string) => void;
  selectWires: (ids: string[]) => void;
  selectPlacements: (ids: string[]) => void;
  setKnobAngle: (placementId: string, componentId: string, angle: number) => void;
  toggleButton: (placementId: string, componentId: string) => void;
  updateWireEndpoint: (wireId: string, end: "from" | "to", newEndpoint: RackWireEndpoint) => void;
  clearWires: () => void;
  setActiveRackView: (view: ViewState) => void;
}

const EMPTY_RACK: Rack = {
  id: "empty",
  name: "Empty",
  widthHP: 84,
  rows: 1,
  placements: [],
  wires: [],
  knobStates: [],
  buttonStates: [],
};

function getActiveRack(state: AppStore): Rack {
  const tab = state.viewTabs.find((t) => t.id === state.activeViewTabId);
  if (tab?.kind === "rack") {
    return state.racks.find((r) => r.id === tab.dataId) ?? state.racks[0] ?? EMPTY_RACK;
  }
  return state.racks[0] ?? EMPTY_RACK;
}

function updateActiveRack(state: AppStore, updater: (rack: Rack) => Rack): Partial<AppStore> {
  const active = getActiveRack(state);
  return {
    racks: state.racks.map((r) => (r.id === active.id ? updater(r) : r)),
  };
}

function hasOverlap(
  placements: RackPlacement[],
  check: RackPlacement,
  getModuleWidth: (moduleId: string) => number,
  rackWidth: number
): boolean {
  const newLeft = check.positionHP;
  const newRight = newLeft + getModuleWidth(check.moduleId);
  if (newLeft < 0 || newRight > rackWidth) return true;

  for (const p of placements) {
    if (p.row !== check.row) continue;
    if (p.id === check.id) continue;
    const left = p.positionHP;
    const right = left + getModuleWidth(p.moduleId);
    if (newLeft < right && newRight > left) return true;
  }
  return false;
}

export const createRackSlice: StateCreator<AppStore, [], [], RackSlice> = (set) => ({
  racks: [],

  // Derived field — kept in sync by the subscribe handler in store/index.ts
  rack: EMPTY_RACK,

  selectedWireIds: [],
  selectedPlacementIds: [],

  setRackWidth: (hp) =>
    set((state) => updateActiveRack(state, (r) => ({ ...r, widthHP: hp }))),

  setRackRows: (rows) =>
    set((state) => updateActiveRack(state, (r) => ({ ...r, rows }))),

  placeModule: (moduleId, positionHP, row) =>
    set((state) => {
      const rack = getActiveRack(state);
      const mod = state.modules.find((m) => m.id === moduleId);
      if (!mod) return state;
      const getWidth = (id: string) =>
        state.modules.find((m) => m.id === id)?.widthHP ?? 0;
      const placement: RackPlacement = {
        id: crypto.randomUUID(),
        moduleId,
        positionHP,
        row,
      };
      if (hasOverlap(rack.placements, placement, getWidth, rack.widthHP)) {
        return state;
      }
      return updateActiveRack(state, (r) => ({
        ...r,
        placements: [...r.placements, placement],
      }));
    }),

  removeFromRack: (placementId) =>
    set((state) =>
      updateActiveRack(state, (r) => ({
        ...r,
        placements: r.placements.filter((p) => p.id !== placementId),
        wires: (r.wires ?? []).filter(
          (w) => w.from.placementId !== placementId && w.to.placementId !== placementId
        ),
        knobStates: (r.knobStates ?? []).filter(
          (k) => k.placementId !== placementId
        ),
        buttonStates: (r.buttonStates ?? []).filter(
          (b) => b.placementId !== placementId
        ),
      }))
    ),

  moveInRack: (placementId, newPositionHP, newRow?) =>
    set((state) => {
      const rack = getActiveRack(state);
      const existing = rack.placements.find((p) => p.id === placementId);
      if (!existing) return state;
      const getWidth = (id: string) =>
        state.modules.find((m) => m.id === id)?.widthHP ?? 0;
      const row = newRow !== undefined ? newRow : existing.row;
      const moved: RackPlacement = { ...existing, positionHP: newPositionHP, row };
      const others = rack.placements.filter((p) => p.id !== placementId);
      if (hasOverlap(others, moved, getWidth, rack.widthHP)) {
        return state;
      }
      return updateActiveRack(state, (r) => ({
        ...r,
        placements: [...r.placements.filter((p) => p.id !== placementId), moved],
      }));
    }),

  batchMoveInRack: (moves) =>
    set((state) => {
      const rack = getActiveRack(state);
      const getWidth = (id: string) =>
        state.modules.find((m) => m.id === id)?.widthHP ?? 0;
      const moveIds = new Set(moves.map((m) => m.placementId));
      const others = rack.placements.filter((p) => !moveIds.has(p.id));
      const movedPlacements: RackPlacement[] = [];

      for (const move of moves) {
        const existing = rack.placements.find((p) => p.id === move.placementId);
        if (!existing) continue;
        const moved: RackPlacement = { ...existing, positionHP: move.positionHP, row: move.row };
        if (hasOverlap(others, moved, getWidth, rack.widthHP)) return state;
        movedPlacements.push(moved);
      }

      return updateActiveRack(state, (r) => ({
        ...r,
        placements: [...others, ...movedPlacements],
      }));
    }),

  addWire: (from, to) =>
    set((state) => {
      const rack = getActiveRack(state);
      const existingWires = rack.wires ?? [];

      const isInputOccupied = (ep: RackWireEndpoint) => {
        const placement = rack.placements.find((p) => p.id === ep.placementId);
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
            (w.from.placementId === ep.placementId && w.from.componentId === ep.componentId)
        );
      };

      if (isInputOccupied(from) || isInputOccupied(to)) return state;

      return updateActiveRack(state, (r) => ({
        ...r,
        wires: [
          ...(r.wires ?? []),
          {
            id: crypto.randomUUID(),
            color: WIRE_COLORS[Math.floor(Math.random() * WIRE_COLORS.length)],
            from,
            to,
          },
        ],
      }));
    }),

  removeWire: (id) =>
    set((state) => ({
      ...updateActiveRack(state, (r) => ({
        ...r,
        wires: (r.wires ?? []).filter((w) => w.id !== id),
      })),
      selectedWireIds: state.selectedWireIds.filter((wid) => wid !== id),
    })),

  selectWires: (ids) => set({ selectedWireIds: ids }),

  selectPlacements: (ids) => set({ selectedPlacementIds: ids, selectedWireIds: [] }),

  setKnobAngle: (placementId, componentId, angle) =>
    set((state) =>
      updateActiveRack(state, (r) => {
        const knobStates = [...(r.knobStates ?? [])];
        const idx = knobStates.findIndex(
          (k) => k.placementId === placementId && k.componentId === componentId
        );
        if (idx >= 0) {
          knobStates[idx] = { ...knobStates[idx], angle };
        } else {
          knobStates.push({ placementId, componentId, angle });
        }
        return { ...r, knobStates };
      })
    ),

  toggleButton: (placementId, componentId) =>
    set((state) =>
      updateActiveRack(state, (r) => {
        const buttonStates = [...(r.buttonStates ?? [])];
        const idx = buttonStates.findIndex(
          (b) => b.placementId === placementId && b.componentId === componentId
        );
        if (idx >= 0) {
          buttonStates[idx] = { ...buttonStates[idx], pressed: !buttonStates[idx].pressed };
        } else {
          buttonStates.push({ placementId, componentId, pressed: true });
        }
        return { ...r, buttonStates };
      })
    ),

  updateWireEndpoint: (wireId, end, newEndpoint) =>
    set((state) => {
      const rack = getActiveRack(state);
      const wires = rack.wires ?? [];
      const wire = wires.find((w) => w.id === wireId);
      if (!wire) return state;

      const otherWires = wires.filter((w) => w.id !== wireId);
      const placement = rack.placements.find((p) => p.id === newEndpoint.placementId);
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
                  (w.from.placementId === newEndpoint.placementId && w.from.componentId === newEndpoint.componentId)
              );
              if (occupied) return state;
            }
          }
        }
      }

      return updateActiveRack(state, (r) => ({
        ...r,
        wires: (r.wires ?? []).map((w) =>
          w.id === wireId ? { ...w, [end]: newEndpoint } : w
        ),
      }));
    }),

  clearWires: () =>
    set((state) => ({
      ...updateActiveRack(state, (r) => ({ ...r, wires: [] })),
      selectedWireIds: [],
    })),

  setActiveRackView: (view) =>
    set((state) => updateActiveRack(state, (r) => ({ ...r, view }))),
});
