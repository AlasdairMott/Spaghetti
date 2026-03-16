import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEditorSlice, type EditorSlice } from "./editorSlice";
import { createModulesSlice, type ModulesSlice } from "./modulesSlice";
import { createRackSlice, type RackSlice } from "./rackSlice";
import { createCanvasSlice, type CanvasSlice } from "./canvasSlice";
import { createUiSlice, type UiSlice } from "./uiSlice";
import { builtinModules } from "../data/builtinModules";

export type AppStore = EditorSlice & ModulesSlice & RackSlice & CanvasSlice & UiSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (...args) => ({
      ...createEditorSlice(...args),
      ...createModulesSlice(...args),
      ...createRackSlice(...args),
      ...createCanvasSlice(...args),
      ...createUiSlice(...args),
    }),
    {
      name: "lw-designer-storage",
      partialize: (state) => ({
        modules: state.modules,
        rack: state.rack,
        canvas: state.canvas,
      }),
      onRehydrateStorage: () => (state) => {
        // Seed built-in modules on first load (empty project)
        if (state && state.modules.length === 0) {
          state.modules = builtinModules.map((m) => ({ ...m }));
        }
      },
    }
  )
);
