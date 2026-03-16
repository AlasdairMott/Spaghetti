import type { StateCreator } from "zustand";
import type { Module } from "../models/types";
import type { AppStore } from "./index";
import { builtinModules } from "../data/builtinModules";

export interface ModulesSlice {
  modules: Module[];
  saveModule: (module: Module) => void;
  deleteModule: (id: string) => void;
  resetProject: () => void;
}

export const createModulesSlice: StateCreator<AppStore, [], [], ModulesSlice> = (set) => ({
  modules: [],

  saveModule: (module) =>
    set((state) => {
      const idx = state.modules.findIndex((m) => m.id === module.id);
      if (idx >= 0) {
        const updated = [...state.modules];
        updated[idx] = module;
        return { modules: updated };
      }
      return { modules: [...state.modules, module] };
    }),

  deleteModule: (id) =>
    set((state) => ({
      modules: state.modules.filter((m) => m.id !== id),
    })),

  resetProject: () =>
    set(() => ({
      modules: builtinModules.map((m) => ({ ...m })),
      rack: {
        id: "default",
        name: "Rack",
        widthHP: 84,
        rows: 1,
        placements: [],
        wires: [],
        knobStates: [],
        buttonStates: [],
      },
      canvas: {
        id: "default",
        name: "Canvas",
        placements: [],
        wires: [],
        knobStates: [],
        buttonStates: [],
      },
    })),
});
