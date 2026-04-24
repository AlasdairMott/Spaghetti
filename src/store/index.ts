import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEditorSlice, type EditorSlice } from "./editorSlice";
import { createModulesSlice, type ModulesSlice } from "./modulesSlice";
import { createRackSlice, type RackSlice } from "./rackSlice";
import { createCanvasSlice, type CanvasSlice } from "./canvasSlice";
import { createUiSlice, type UiSlice } from "./uiSlice";
import { createTabsSlice, type TabsSlice } from "./tabsSlice";
import { builtinModules } from "../data/builtinModules";
import { defaultRack, defaultCanvas } from "../data/defaultProject";
import type { Rack, Canvas, ViewTab } from "../models/types";

export type AppStore = EditorSlice &
  ModulesSlice &
  RackSlice &
  CanvasSlice &
  UiSlice &
  TabsSlice;

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

const EMPTY_CANVAS: Canvas = {
  id: "empty",
  name: "Empty",
  placements: [],
  wires: [],
  knobStates: [],
  buttonStates: [],
};

function deriveActiveRack(state: AppStore): Rack {
  const tab = state.viewTabs.find((t) => t.id === state.activeViewTabId);
  if (tab?.kind === "rack") {
    return state.racks.find((r) => r.id === tab.dataId) ?? state.racks[0] ?? EMPTY_RACK;
  }
  return state.racks[0] ?? EMPTY_RACK;
}

function deriveActiveCanvas(state: AppStore): Canvas {
  const tab = state.viewTabs.find((t) => t.id === state.activeViewTabId);
  if (tab?.kind === "canvas") {
    return state.canvases.find((c) => c.id === tab.dataId) ?? state.canvases[0] ?? EMPTY_CANVAS;
  }
  return state.canvases[0] ?? EMPTY_CANVAS;
}

export const useAppStore = create<AppStore>()(
  persist(
    (...args) => ({
      ...createEditorSlice(...args),
      ...createModulesSlice(...args),
      ...createRackSlice(...args),
      ...createCanvasSlice(...args),
      ...createUiSlice(...args),
      ...createTabsSlice(...args),
    }),
    {
      name: "spaghetti-designer-storage",
      partialize: (state) => ({
        modules: state.modules,
        racks: state.racks,
        canvases: state.canvases,
        viewTabs: state.viewTabs,
        activeViewTabId: state.activeViewTabId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Migration: old format had `rack` and `canvas` as singletons
        const raw = state as unknown as Record<string, unknown>;
        if (raw.rack && typeof raw.rack === "object" && !state.racks?.length) {
          const oldRack = raw.rack as typeof defaultRack;
          const oldCanvas = (raw.canvas as typeof defaultCanvas) ?? structuredClone(defaultCanvas);
          const rackTabId = crypto.randomUUID();
          const canvasTabId = crypto.randomUUID();

          state.racks = [oldRack];
          state.canvases = [oldCanvas];
          state.viewTabs = [
            { id: rackTabId, kind: "rack", name: "Rack 1", dataId: oldRack.id } as ViewTab,
            { id: canvasTabId, kind: "canvas", name: "Canvas 1", dataId: oldCanvas.id } as ViewTab,
          ];
          state.activeViewTabId = rackTabId;
          // Clean up old keys
          delete raw.rack;
          delete raw.canvas;
        }

        // Seed default project on first load (empty project)
        if (state.modules.length === 0) {
          state.modules = structuredClone(builtinModules);
          const rack = structuredClone(defaultRack);
          const canvas = structuredClone(defaultCanvas);
          const rackTabId = crypto.randomUUID();
          const canvasTabId = crypto.randomUUID();

          state.racks = [rack];
          state.canvases = [canvas];
          state.viewTabs = [
            { id: rackTabId, kind: "rack", name: "Rack 1", dataId: rack.id },
            { id: canvasTabId, kind: "canvas", name: "Canvas 1", dataId: canvas.id },
          ];
          state.activeViewTabId = rackTabId;
        }

        // Ensure at least one tab exists
        if (!state.viewTabs?.length) {
          const rack = state.racks[0] ?? structuredClone(defaultRack);
          if (!state.racks.length) state.racks = [rack];
          const tabId = crypto.randomUUID();
          state.viewTabs = [
            { id: tabId, kind: "rack", name: "Rack 1", dataId: rack.id },
          ];
          state.activeViewTabId = tabId;
        }

        // Derive active rack/canvas after rehydration
        state.rack = deriveActiveRack(state);
        state.canvas = deriveActiveCanvas(state);
      },
    },
  ),
);

// Keep `rack` and `canvas` fields in sync as derived state.
// This runs after every state update so that `getState().rack` / `.canvas`
// always resolve to the active instance from the arrays.
useAppStore.subscribe((state) => {
  const newRack = deriveActiveRack(state);
  const newCanvas = deriveActiveCanvas(state);

  // Only set if the derived references actually changed to avoid infinite loops
  if (newRack !== state.rack || newCanvas !== state.canvas) {
    useAppStore.setState({ rack: newRack, canvas: newCanvas });
  }
});
