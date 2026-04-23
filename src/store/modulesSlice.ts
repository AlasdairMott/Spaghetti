import type { StateCreator } from "zustand";
import type { Module, ViewTab } from "../models/types";
import type { AppStore } from "./index";
import { builtinModules } from "../data/builtinModules";
import { defaultRack, defaultCanvas } from "../data/defaultProject";

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
    set(() => {
      const rack = structuredClone(defaultRack);
      const canvas = structuredClone(defaultCanvas);
      const rackTabId = crypto.randomUUID();
      const canvasTabId = crypto.randomUUID();
      return {
        modules: structuredClone(builtinModules),
        racks: [rack],
        canvases: [canvas],
        viewTabs: [
          { id: rackTabId, kind: "rack", name: "Rack 1", dataId: rack.id } as ViewTab,
          { id: canvasTabId, kind: "canvas", name: "Canvas 1", dataId: canvas.id } as ViewTab,
        ],
        activeViewTabId: rackTabId,
      };
    }),
});
