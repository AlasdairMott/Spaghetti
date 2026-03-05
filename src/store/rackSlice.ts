import type { StateCreator } from "zustand";
import type { Rack, RackPlacement } from "../models/types";
import type { AppStore } from "./index";

export interface RackSlice {
  rack: Rack;
  setRackWidth: (hp: number) => void;
  setRackRows: (rows: number) => void;
  placeModule: (moduleId: string, positionHP: number, row: number) => void;
  removeFromRack: (placementId: string) => void;
  moveInRack: (placementId: string, newPositionHP: number) => void;
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
  },

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
      },
    })),

  moveInRack: (placementId, newPositionHP) =>
    set((state) => {
      const existing = state.rack.placements.find((p) => p.id === placementId);
      if (!existing) return state;
      const getWidth = (id: string) =>
        state.modules.find((m) => m.id === id)?.widthHP ?? 0;
      const moved: RackPlacement = { ...existing, positionHP: newPositionHP };
      const others = state.rack.placements.filter((p) => p.id !== placementId);
      if (hasOverlap(others, moved, getWidth, state.rack.widthHP)) {
        return state;
      }
      return {
        rack: { ...state.rack, placements: [...others, moved] },
      };
    }),
});
