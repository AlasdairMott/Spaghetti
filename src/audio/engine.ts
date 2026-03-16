import type { Rack, Module } from "../models/types";
import { buildMegaProcessorCode } from "./worklet-template";
import { gridToMm } from "../utils/grid";

export class AudioEngine {
  audioCtx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  private megaNode: AudioWorkletNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private blobUrls: string[] = [];
  private moduleJackInfo = new Map<
    string,
    {
      inputJackIds: string[];
      outputJackIds: string[];
      outputJackDirections: string[];
      inputJackNames: string[];
      outputJackNames: string[];
    }
  >();
  /** Map placementId -> moduleId for param/button routing */
  private placementModuleMap = new Map<string, string>();
  isRunning = false;
  faultedPlacements = new Set<string>();
  onFault?: (placementId: string) => void;

  async start(rack: Rack, modules: Module[]) {
    if (this.isRunning) return;

    const ctx = new AudioContext({ sampleRate: 48000 });

    // Pre-compute jack info per module type
    this.moduleJackInfo.clear();
    this.placementModuleMap.clear();

    const moduleTypes: Array<{ moduleId: string; code: string }> = [];
    const seenModules = new Set<string>();

    for (const placement of rack.placements) {
      const mod = modules.find((m) => m.id === placement.moduleId);
      if (!mod || !mod.code) continue;

      this.placementModuleMap.set(placement.id, mod.id);

      if (!this.moduleJackInfo.has(mod.id)) {
        const sorted = [...mod.components].sort((a, b) => {
          const ap = gridToMm(a.position);
          const bp = gridToMm(b.position);
          return ap.y - bp.y || ap.x - bp.x;
        });
        const inputJacks = sorted.filter(
          (c) => c.kind === "jack" && (c.jackDirection === "input" || c.jackDirection === "both"),
        );
        const outputJacks = sorted.filter(
          (c) =>
            c.kind === "jack" &&
            (c.jackDirection === "output" || c.jackDirection === "both" || c.jackDirection === "headphones"),
        );
        this.moduleJackInfo.set(mod.id, {
          inputJackIds: inputJacks.map((c) => c.id),
          outputJackIds: outputJacks.map((c) => c.id),
          outputJackDirections: outputJacks.map((c) => c.jackDirection ?? "output"),
          inputJackNames: inputJacks.map((c) => c.ref || c.label || c.id),
          outputJackNames: outputJacks.map((c) => c.ref || c.label || c.id),
        });
      }

      if (!seenModules.has(mod.id)) {
        seenModules.add(mod.id);
        moduleTypes.push({ moduleId: mod.id, code: mod.code });
      }
    }

    // Build and register the single mega-processor
    const code = buildMegaProcessorCode(moduleTypes);
    const blob = new Blob([code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    this.blobUrls.push(url);
    try {
      await ctx.audioWorklet.addModule(url);
    } catch (e) {
      console.error("Failed to register mega processor:", e);
      ctx.close();
      return;
    }

    // Single node with stereo output
    const node = new AudioWorkletNode(ctx, "LwMegaProcessor", {
      numberOfInputs: 0,
      numberOfOutputs: 2,
      outputChannelCount: [1, 1],
    });

    node.port.onmessage = (e) => {
      if (e.data.type === "fault") {
        this.faultedPlacements.add(e.data.placementId);
        this.onFault?.(e.data.placementId);
      }
    };

    // Connect stereo outputs to destination via channel merger
    const merger = ctx.createChannelMerger(2);
    node.connect(merger, 0, 0); // L
    node.connect(merger, 1, 1); // R

    // Insert analyser between merger and destination
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    merger.connect(analyser);
    analyser.connect(ctx.destination);
    this.analyser = analyser;

    // Add each placement to the mega processor
    for (const placement of rack.placements) {
      const mod = modules.find((m) => m.id === placement.moduleId);
      if (!mod || !mod.code) continue;

      const jacks = this.moduleJackInfo.get(mod.id)!;
      const sorted = [...mod.components].sort((a, b) => {
        const ap = gridToMm(a.position);
        const bp = gridToMm(b.position);
        return ap.y - bp.y || ap.x - bp.x;
      });

      const initialParams: Record<string, number> = {};
      for (const comp of sorted) {
        if (comp.kind === "pot") {
          const knob = (rack.knobStates ?? []).find(
            (k) => k.placementId === placement.id && k.componentId === comp.id,
          );
          const key = comp.ref || comp.label || comp.id;
          initialParams[key] = (knob?.angle ?? 150) / 300;
        }
      }

      const initialButtons: Record<string, boolean> = {};
      for (const comp of sorted) {
        if (comp.kind === "button") {
          const btn = (rack.buttonStates ?? []).find(
            (b) => b.placementId === placement.id && b.componentId === comp.id,
          );
          const key = comp.ref || comp.label || comp.id;
          initialButtons[key] = btn?.pressed ?? false;
        }
      }

      node.port.postMessage({
        type: "addPlacement",
        placementId: placement.id,
        moduleId: mod.id,
        numInputs: jacks.inputJackIds.length,
        numOutputs: jacks.outputJackIds.length,
        inputNames: jacks.inputJackNames,
        outputNames: jacks.outputJackNames,
        initialParams,
        initialButtons,
      });
    }

    // Send wire routing, topo order, and headphone config
    this.megaNode = node;
    this.merger = merger;
    this.audioCtx = ctx;
    this.isRunning = true;

    this.sendRouting(rack);
    this.sendHeadphones(rack);
  }

  private computeWireRouting(rack: Rack) {
    const placementIncomingWires = new Map<
      string,
      { srcPlacementId: string; srcOutputIdx: number; dstInputIdx: number }[]
    >();
    for (const placement of rack.placements) {
      placementIncomingWires.set(placement.id, []);
    }

    for (const wire of rack.wires ?? []) {
      const fromPlacement = rack.placements.find((p) => p.id === wire.from.placementId);
      const toPlacement = rack.placements.find((p) => p.id === wire.to.placementId);
      if (!fromPlacement || !toPlacement) continue;

      const fromJacks = this.moduleJackInfo.get(fromPlacement.moduleId);
      const toJacks = this.moduleJackInfo.get(toPlacement.moduleId);
      if (!fromJacks || !toJacks) continue;

      const fwdOut = fromJacks.outputJackIds.indexOf(wire.from.componentId);
      const fwdIn = toJacks.inputJackIds.indexOf(wire.to.componentId);

      if (fwdOut >= 0 && fwdIn >= 0) {
        placementIncomingWires.get(wire.to.placementId)?.push({
          srcPlacementId: wire.from.placementId,
          srcOutputIdx: fwdOut,
          dstInputIdx: fwdIn,
        });
      } else {
        const revOut = toJacks.outputJackIds.indexOf(wire.to.componentId);
        const revIn = fromJacks.inputJackIds.indexOf(wire.from.componentId);
        if (revOut >= 0 && revIn >= 0) {
          placementIncomingWires.get(wire.from.placementId)?.push({
            srcPlacementId: wire.to.placementId,
            srcOutputIdx: revOut,
            dstInputIdx: revIn,
          });
        }
      }
    }
    return placementIncomingWires;
  }

  private computeTopologicalOrder(
    rack: Rack,
    routing: Map<string, { srcPlacementId: string; srcOutputIdx: number; dstInputIdx: number }[]>,
  ): string[] {
    const placementIds = rack.placements.map((p) => p.id);
    const inDegree = new Map<string, number>();
    const adj = new Map<string, Set<string>>();

    for (const pid of placementIds) {
      inDegree.set(pid, 0);
      adj.set(pid, new Set());
    }

    // Build edges: for each destination's incoming wire, src -> dst
    for (const [dstPid, wires] of routing) {
      for (const wire of wires) {
        const srcSet = adj.get(wire.srcPlacementId);
        if (srcSet && !srcSet.has(dstPid)) {
          srcSet.add(dstPid);
          inDegree.set(dstPid, (inDegree.get(dstPid) ?? 0) + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [pid, deg] of inDegree) {
      if (deg === 0) queue.push(pid);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const pid = queue.shift()!;
      order.push(pid);
      for (const neighbor of adj.get(pid) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    // Remaining placements are in feedback cycles — append them
    for (const pid of placementIds) {
      if (!order.includes(pid)) order.push(pid);
    }

    return order;
  }

  private sendRouting(rack: Rack) {
    if (!this.megaNode) return;
    const routing = this.computeWireRouting(rack);
    const order = this.computeTopologicalOrder(rack, routing);

    const routingObj: Record<string, { srcPlacementId: string; srcOutputIdx: number; dstInputIdx: number }[]> = {};
    for (const [pid, wires] of routing) {
      routingObj[pid] = wires;
    }

    this.megaNode.port.postMessage({
      type: "updateRouting",
      routing: routingObj,
      order,
    });
  }

  private sendHeadphones(rack: Rack) {
    if (!this.megaNode) return;
    const outputs: Array<{ placementId: string; outputIdx: number; channel: number }> = [];

    for (const placement of rack.placements) {
      const jacks = this.moduleJackInfo.get(placement.moduleId);
      if (!jacks) continue;

      const hpIndices: number[] = [];
      for (let i = 0; i < jacks.outputJackDirections.length; i++) {
        if (jacks.outputJackDirections[i] === "headphones") {
          hpIndices.push(i);
        }
      }

      if (hpIndices.length >= 2) {
        outputs.push({ placementId: placement.id, outputIdx: hpIndices[0], channel: 0 });
        outputs.push({ placementId: placement.id, outputIdx: hpIndices[1], channel: 1 });
      } else if (hpIndices.length === 1) {
        // Mono: send to both channels
        outputs.push({ placementId: placement.id, outputIdx: hpIndices[0], channel: 0 });
        outputs.push({ placementId: placement.id, outputIdx: hpIndices[0], channel: 1 });
      }
    }

    this.megaNode.port.postMessage({ type: "setHeadphones", outputs });
  }

  /** Re-send wire routing to the worklet without restarting audio */
  updateWires(rack: Rack) {
    if (!this.isRunning) return;
    this.sendRouting(rack);
  }

  updateKnobParam(placementId: string, componentId: string, angle: number, modules: Module[]) {
    if (!this.megaNode) return;

    const moduleId = this.placementModuleMap.get(placementId);
    if (!moduleId) return;

    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const comp = mod.components.find((c) => c.id === componentId);
    if (!comp) return;

    const key = comp.ref || comp.label || comp.id;
    this.megaNode.port.postMessage({
      type: "params",
      placementId,
      params: { [key]: angle / 300 },
    });
  }

  updateButton(placementId: string, componentId: string, pressed: boolean, modules: Module[]) {
    if (!this.megaNode) return;

    const moduleId = this.placementModuleMap.get(placementId);
    if (!moduleId) return;

    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const comp = mod.components.find((c) => c.id === componentId);
    if (!comp) return;

    const key = comp.ref || comp.label || comp.id;
    this.megaNode.port.postMessage({
      type: "buttons",
      placementId,
      buttons: { [key]: pressed },
    });
  }

  stop() {
    this.megaNode?.disconnect();
    this.merger?.disconnect();
    this.analyser?.disconnect();
    this.megaNode = null;
    this.merger = null;
    this.analyser = null;
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    for (const url of this.blobUrls) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls = [];
    this.placementModuleMap.clear();
    this.faultedPlacements.clear();
    this.isRunning = false;
  }
}
