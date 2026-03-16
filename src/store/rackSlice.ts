import type { StateCreator } from "zustand";
import type { Rack, RackPlacement, RackWireEndpoint } from "../models/types";
import type { AppStore } from "./index";

const WIRE_COLORS = ["#e44", "#4ae", "#4d4", "#fd0", "#f4a", "#a4f", "#fa4", "#4dd"];

export interface RackSlice {
  rack: Rack;
  selectedWireIds: string[];
  selectedPlacementIds: string[];
  setRackWidth: (hp: number) => void;
  setRackRows: (rows: number) => void;
  placeModule: (moduleId: string, positionHP: number, row: number) => void;
  removeFromRack: (placementId: string) => void;
  moveInRack: (placementId: string, newPositionHP: number, newRow?: number) => void;
  addWire: (from: RackWireEndpoint, to: RackWireEndpoint) => void;
  removeWire: (id: string) => void;
  selectWires: (ids: string[]) => void;
  selectPlacements: (ids: string[]) => void;
  setKnobAngle: (placementId: string, componentId: string, angle: number) => void;
  toggleButton: (placementId: string, componentId: string) => void;
  updateWireEndpoint: (wireId: string, end: "from" | "to", newEndpoint: RackWireEndpoint) => void;
  clearWires: () => void;
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
  rack: {
    id: crypto.randomUUID(),
    name: "My Rack",
    widthHP: 104,
    rows: 4,
    placements: [],
    wires: [],
    knobStates: [],
    buttonStates: [],
  },

  selectedWireIds: [],
  selectedPlacementIds: [],

  setRackWidth: (hp) =>
    set((state) => ({ rack: { ...state.rack, widthHP: hp } })),

  setRackRows: (rows) =>
    set((state) => ({ rack: { ...state.rack, rows } })),

  placeModule: (moduleId, positionHP, row) =>
    set((state) => {
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
      if (hasOverlap(state.rack.placements, placement, getWidth, state.rack.widthHP)) {
        return state;
      }
      return {
        rack: {
          ...state.rack,
          placements: [...state.rack.placements, placement],
        },
      };
    }),

  removeFromRack: (placementId) =>
    set((state) => ({
      rack: {
        ...state.rack,
        placements: state.rack.placements.filter((p) => p.id !== placementId),
        // Also remove wires connected to this placement
        wires: (state.rack.wires ?? []).filter(
          (w) => w.from.placementId !== placementId && w.to.placementId !== placementId
        ),
        // Remove knob states for this placement
        knobStates: (state.rack.knobStates ?? []).filter(
          (k) => k.placementId !== placementId
        ),
        // Remove button states for this placement
        buttonStates: (state.rack.buttonStates ?? []).filter(
          (b) => b.placementId !== placementId
        ),
      },
    })),

  moveInRack: (placementId, newPositionHP, newRow?) =>
    set((state) => {
      const existing = state.rack.placements.find((p) => p.id === placementId);
      if (!existing) return state;
      const getWidth = (id: string) =>
        state.modules.find((m) => m.id === id)?.widthHP ?? 0;
      const row = newRow !== undefined ? newRow : existing.row;
      const moved: RackPlacement = { ...existing, positionHP: newPositionHP, row };
      const others = state.rack.placements.filter((p) => p.id !== placementId);
      if (hasOverlap(others, moved, getWidth, state.rack.widthHP)) {
        return state;
      }
      return {
        rack: { ...state.rack, placements: [...others, moved] },
      };
    }),

  addWire: (from, to) =>
    set((state) => {
      const existingWires = state.rack.wires ?? [];

      // Check if either endpoint is an input jack that already has a wire
      const isInputOccupied = (ep: RackWireEndpoint) => {
        const placement = state.rack.placements.find((p) => p.id === ep.placementId);
        if (!placement) return false;
        const mod = state.modules.find((m) => m.id === placement.moduleId);
        if (!mod) return false;
        const comp = mod.components.find((c) => c.id === ep.componentId);
        if (!comp || comp.kind !== "jack") return false;
        const dir = comp.jackDirection ?? "input";
        if (dir !== "input" && dir !== "both") return false;
        // Check if this input already has a wire connected to it
        return existingWires.some(
          (w) =>
            (w.to.placementId === ep.placementId && w.to.componentId === ep.componentId) ||
            (w.from.placementId === ep.placementId && w.from.componentId === ep.componentId)
        );
      };

      if (isInputOccupied(from) || isInputOccupied(to)) return state;

      return {
        rack: {
          ...state.rack,
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

  removeWire: (id) =>
    set((state) => ({
      rack: {
        ...state.rack,
        wires: (state.rack.wires ?? []).filter((w) => w.id !== id),
      },
      selectedWireIds: state.selectedWireIds.filter((wid) => wid !== id),
    })),

  selectWires: (ids) => set({ selectedWireIds: ids }),

  selectPlacements: (ids) => set({ selectedPlacementIds: ids, selectedWireIds: [] }),

  setKnobAngle: (placementId, componentId, angle) =>
    set((state) => {
      const knobStates = [...(state.rack.knobStates ?? [])];
      const idx = knobStates.findIndex(
        (k) => k.placementId === placementId && k.componentId === componentId
      );
      if (idx >= 0) {
        knobStates[idx] = { ...knobStates[idx], angle };
      } else {
        knobStates.push({ placementId, componentId, angle });
      }
      return { rack: { ...state.rack, knobStates } };
    }),

  toggleButton: (placementId, componentId) =>
    set((state) => {
      const buttonStates = [...(state.rack.buttonStates ?? [])];
      const idx = buttonStates.findIndex(
        (b) => b.placementId === placementId && b.componentId === componentId
      );
      if (idx >= 0) {
        buttonStates[idx] = { ...buttonStates[idx], pressed: !buttonStates[idx].pressed };
      } else {
        buttonStates.push({ placementId, componentId, pressed: true });
      }
      return { rack: { ...state.rack, buttonStates } };
    }),

  updateWireEndpoint: (wireId, end, newEndpoint) =>
    set((state) => {
      const wires = state.rack.wires ?? [];
      const wire = wires.find((w) => w.id === wireId);
      if (!wire) return state;

      // Check single-wire-per-input constraint for the new endpoint
      const otherWires = wires.filter((w) => w.id !== wireId);
      const placement = state.rack.placements.find((p) => p.id === newEndpoint.placementId);
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

      return {
        rack: {
          ...state.rack,
          wires: wires.map((w) =>
            w.id === wireId ? { ...w, [end]: newEndpoint } : w
          ),
        },
      };
    }),

  clearWires: () =>
    set((state) => ({
      rack: { ...state.rack, wires: [] },
      selectedWireIds: [],
    })),
});
