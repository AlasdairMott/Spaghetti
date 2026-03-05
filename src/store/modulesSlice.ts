import type { StateCreator } from "zustand";
import type { Module } from "../models/types";
import type { AppStore } from "./index";

export interface ModulesSlice {
  modules: Module[];
  saveModule: (module: Module) => void;
  deleteModule: (id: string) => void;
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
});
