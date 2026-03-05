import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEditorSlice, type EditorSlice } from "./editorSlice";
import { createModulesSlice, type ModulesSlice } from "./modulesSlice";
import { createRackSlice, type RackSlice } from "./rackSlice";
import { createUiSlice, type UiSlice } from "./uiSlice";

export type AppStore = EditorSlice & ModulesSlice & RackSlice & UiSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (...args) => ({
      ...createEditorSlice(...args),
      ...createModulesSlice(...args),
      ...createRackSlice(...args),
      ...createUiSlice(...args),
    }),
    {
      name: "lw-designer-storage",
      partialize: (state) => ({
        modules: state.modules,
        rack: state.rack,
      }),
    }
  )
);
