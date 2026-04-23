import type { StateCreator } from "zustand";
import type { AppMode, RenderMode } from "../models/types";
import type { AppStore } from "./index";

export type ThemeMode = "dark" | "light";

export interface UiSlice {
  mode: AppMode;
  renderMode: RenderMode;
  theme: ThemeMode;
  zoom: number;
  panOffset: { x: number; y: number };
  audioRunning: boolean;
  faultedIds: Set<string>;
  setMode: (mode: AppMode) => void;
  setRenderMode: (renderMode: RenderMode) => void;
  setTheme: (theme: ThemeMode) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setAudioRunning: (running: boolean) => void;
  setFaultedIds: (ids: Set<string>) => void;
}

export const createUiSlice: StateCreator<AppStore, [], [], UiSlice> = (
  set,
) => ({
  mode: "view",
  renderMode: "wireframe",
  theme: (localStorage.getItem("spaghetti-theme") as ThemeMode) || "dark",
  zoom: 0.33,
  panOffset: { x: 0, y: 0 },
  audioRunning: false,
  faultedIds: new Set<string>(),
  setMode: (mode) => set({ mode }),
  setRenderMode: (renderMode) => set({ renderMode }),
  setTheme: (theme) => {
    localStorage.setItem("spaghetti-theme", theme);
    set({ theme });
  },
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(zoom, 20)) }),
  setPanOffset: (panOffset) => set({ panOffset }),
  setAudioRunning: (audioRunning) => set({ audioRunning }),
  setFaultedIds: (faultedIds) => set({ faultedIds }),
});
