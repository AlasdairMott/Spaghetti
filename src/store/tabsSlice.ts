import type { StateCreator } from "zustand";
import type { ViewTab } from "../models/types";
import type { AppStore } from "./index";

export interface TabsSlice {
  viewTabs: ViewTab[];
  activeViewTabId: string;
  addViewTab: (kind: "rack" | "canvas") => void;
  closeViewTab: (id: string) => void;
  renameViewTab: (id: string, name: string) => void;
  setActiveViewTab: (id: string) => void;
}

export const createTabsSlice: StateCreator<AppStore, [], [], TabsSlice> = (
  set,
  get,
) => ({
  viewTabs: [],
  activeViewTabId: "",

  addViewTab: (kind) =>
    set((state) => {
      const id = crypto.randomUUID();
      const dataId = crypto.randomUUID();

      // Count existing tabs of this kind for auto-naming
      const count = state.viewTabs.filter((t) => t.kind === kind).length + 1;
      const name = kind === "rack" ? `Rack ${count}` : `Canvas ${count}`;

      const newTab: ViewTab = { id, kind, name, dataId };

      if (kind === "rack") {
        return {
          racks: [
            ...state.racks,
            {
              id: dataId,
              name,
              widthHP: 84,
              rows: 1,
              placements: [],
              wires: [],
              knobStates: [],
              buttonStates: [],
            },
          ],
          viewTabs: [...state.viewTabs, newTab],
          activeViewTabId: id,
          mode: "view" as const,
        };
      } else {
        return {
          canvases: [
            ...state.canvases,
            {
              id: dataId,
              name,
              placements: [],
              wires: [],
              knobStates: [],
              buttonStates: [],
            },
          ],
          viewTabs: [...state.viewTabs, newTab],
          activeViewTabId: id,
          mode: "view" as const,
        };
      }
    }),

  closeViewTab: (id) =>
    set((state) => {
      if (state.viewTabs.length <= 1) return state;

      const tab = state.viewTabs.find((t) => t.id === id);
      if (!tab) return state;

      const idx = state.viewTabs.findIndex((t) => t.id === id);
      const newTabs = state.viewTabs.filter((t) => t.id !== id);

      // Activate neighbor if closing active tab
      let newActiveId = state.activeViewTabId;
      if (state.activeViewTabId === id) {
        const newIdx = Math.min(idx, newTabs.length - 1);
        newActiveId = newTabs[newIdx].id;
      }

      // Remove associated data
      const result: Partial<AppStore> = {
        viewTabs: newTabs,
        activeViewTabId: newActiveId,
      };

      if (tab.kind === "rack") {
        result.racks = state.racks.filter((r) => r.id !== tab.dataId);
      } else {
        result.canvases = state.canvases.filter((c) => c.id !== tab.dataId);
      }

      return result as AppStore;
    }),

  renameViewTab: (id, name) =>
    set((state) => ({
      viewTabs: state.viewTabs.map((t) =>
        t.id === id ? { ...t, name } : t,
      ),
    })),

  setActiveViewTab: (id) => set({ activeViewTabId: id, mode: "view" }),
});
