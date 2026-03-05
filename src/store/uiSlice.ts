import type { StateCreator } from "zustand";
import type { AppMode, RenderMode } from "../models/types";
import type { AppStore } from "./index";

export interface UiSlice {
  mode: AppMode;
  renderMode: RenderMode;
  zoom: number;
  panOffset: { x: number; y: number };
  setMode: (mode: AppMode) => void;
  setRenderMode: (renderMode: RenderMode) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
}

export const createUiSlice: StateCreator<AppStore, [], [], UiSlice> = (set) => ({
  mode: "designer",
  renderMode: "wireframe",
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  setMode: (mode) => set({ mode }),
  setRenderMode: (renderMode) => set({ renderMode }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(zoom, 20)) }),
  setPanOffset: (panOffset) => set({ panOffset }),
});
