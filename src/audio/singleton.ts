import { AudioEngine } from "./engine";
import { useAppStore } from "../store";
import type { Rack, Canvas } from "../models/types";

/** Module-level singleton so the engine survives mode switches */
let engine: AudioEngine | null = null;

/** Which source started the current engine instance */
let activeSource: "rack" | "canvas" = "rack";

export function getAudioEngine(): AudioEngine | null {
  return engine;
}

export function getAnalyserNode(): AnalyserNode | null {
  return engine?.analyser ?? null;
}

/** Convert a Canvas to a Rack-shaped object for the engine (positions are unused by audio) */
function canvasToRack(canvas: Canvas): Rack {
  return {
    id: canvas.id,
    name: canvas.name,
    widthHP: 0,
    rows: 0,
    placements: canvas.placements.map((p) => ({
      id: p.id,
      moduleId: p.moduleId,
      positionHP: 0,
      row: 0,
    })),
    wires: canvas.wires,
    knobStates: canvas.knobStates,
    buttonStates: canvas.buttonStates,
  };
}

export async function toggleAudio() {
  const store = useAppStore.getState();

  if (engine?.isRunning) {
    engine.stop();
    engine = null;
    store.setAudioRunning(false);
    store.setFaultedIds(new Set());
  } else {
    const e = new AudioEngine();
    e.onFault = (placementId) => {
      const s = useAppStore.getState();
      s.setFaultedIds(new Set(s.faultedIds).add(placementId));

      // Look up module name from either rack or canvas
      const rackPlacement = s.rack.placements.find((p) => p.id === placementId);
      const canvasPlacement = s.canvas.placements.find((p) => p.id === placementId);
      const placement = rackPlacement ?? canvasPlacement;
      const mod = placement
        ? s.modules.find((m) => m.id === placement.moduleId)
        : null;
      console.warn(
        `Audio fault: ${mod?.name ?? "unknown"} (${placementId}) produced NaN/Infinity — output zeroed`,
      );
    };
    const state = useAppStore.getState();
    store.setFaultedIds(new Set());

    // Determine source from active view tab
    const activeTab = state.viewTabs.find((t) => t.id === state.activeViewTabId);
    const source = activeTab?.kind === "canvas" ? "canvas" : "rack";
    const rackData = source === "canvas" ? canvasToRack(state.canvas) : state.rack;

    try {
      await e.start(rackData, state.modules);
      engine = e;
      activeSource = source;
      store.setAudioRunning(true);
    } catch (err) {
      console.error("Audio engine start failed:", err);
      e.stop();
    }
  }
}

/** Re-send wire routing without restarting (rack) */
export function updateAudioWires() {
  if (engine?.isRunning && activeSource === "rack") {
    engine.updateWires(useAppStore.getState().rack);
  }
}

/** Re-send wire routing without restarting (canvas) */
export function updateCanvasAudioWires() {
  if (engine?.isRunning && activeSource === "canvas") {
    engine.updateWires(canvasToRack(useAppStore.getState().canvas));
  }
}

/** Restart the engine with new rack data, preserving the fault handler. */
async function restartEngine(rackData: Rack) {
  const prevOnFault = engine?.onFault;
  engine?.stop();
  engine = null;
  const e = new AudioEngine();
  if (prevOnFault) e.onFault = prevOnFault;
  try {
    await e.start(rackData, useAppStore.getState().modules);
    engine = e;
    useAppStore.getState().setAudioRunning(true);
  } catch {
    e.stop();
    useAppStore.getState().setAudioRunning(false);
  }
}

/** Guard against concurrent placement-update calls racing each other. */
let placementUpdateInFlight = false;

/**
 * Hot-add any new rack placements while audio is running.
 * If a placement uses a module type not yet registered in the worklet,
 * the engine is restarted so it can compile in the new type.
 */
export async function updateAudioPlacements() {
  if (placementUpdateInFlight || !engine?.isRunning || activeSource !== "rack") return;
  placementUpdateInFlight = true;
  try {
    const state = useAppStore.getState();
    let needsRestart = false;
    for (const placement of state.rack.placements) {
      if (!engine.hasPlacement(placement.id)) {
        const ok = engine.addPlacement(placement, state.rack, state.modules);
        if (!ok) { needsRestart = true; break; }
      }
    }
    if (needsRestart) await restartEngine(useAppStore.getState().rack);
  } finally {
    placementUpdateInFlight = false;
  }
}

/**
 * Hot-add any new canvas placements while audio is running.
 * Restarts if a new module type is encountered.
 */
export async function updateCanvasAudioPlacements() {
  if (placementUpdateInFlight || !engine?.isRunning || activeSource !== "canvas") return;
  placementUpdateInFlight = true;
  try {
    const state = useAppStore.getState();
    const rackData = canvasToRack(state.canvas);
    let needsRestart = false;
    for (const placement of state.canvas.placements) {
      if (!engine.hasPlacement(placement.id)) {
        const ok = engine.addPlacement(placement, rackData, state.modules);
        if (!ok) { needsRestart = true; break; }
      }
    }
    if (needsRestart) await restartEngine(canvasToRack(useAppStore.getState().canvas));
  } finally {
    placementUpdateInFlight = false;
  }
}

export function updateAudioKnob(
  placementId: string,
  componentId: string,
  angle: number,
) {
  if (engine?.isRunning && activeSource === "rack") {
    engine.updateKnobParam(
      placementId,
      componentId,
      angle,
      useAppStore.getState().modules,
    );
  }
}

export function updateCanvasAudioKnob(
  placementId: string,
  componentId: string,
  angle: number,
) {
  if (engine?.isRunning && activeSource === "canvas") {
    engine.updateKnobParam(
      placementId,
      componentId,
      angle,
      useAppStore.getState().modules,
    );
  }
}

export function updateAudioButton(
  placementId: string,
  componentId: string,
  pressed: boolean,
) {
  if (engine?.isRunning && activeSource === "rack") {
    engine.updateButton(
      placementId,
      componentId,
      pressed,
      useAppStore.getState().modules,
    );
  }
}

export function updateCanvasAudioButton(
  placementId: string,
  componentId: string,
  pressed: boolean,
) {
  if (engine?.isRunning && activeSource === "canvas") {
    engine.updateButton(
      placementId,
      componentId,
      pressed,
      useAppStore.getState().modules,
    );
  }
}
