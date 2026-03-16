/**
 * Single mega-worklet architecture.
 *
 * All modules run inside one AudioWorkletProcessor, processed in
 * topological order each block. Upstream modules write their outputs
 * to an internal bus, and downstream modules read them immediately
 * within the same block — eliminating inter-module latency on forward
 * paths. Only true feedback loops (cycles) incur a one-block delay.
 *
 * If a module produces NaN/Infinity, its outputs are zeroed and a fault
 * is reported to the main thread — preventing poison from spreading.
 */

/** Builds the single mega-processor containing all module types. */
export function buildMegaProcessorCode(
  modules: Array<{ moduleId: string; code: string }>,
): string {
  // Deduplicate by moduleId
  const seen = new Set<string>();
  const unique: typeof modules = [];
  for (const m of modules) {
    if (!seen.has(m.moduleId)) {
      seen.add(m.moduleId);
      unique.push(m);
    }
  }

  // Each module type's code wrapped in an IIFE for isolation
  const moduleCodeBlock = unique
    .map(
      (m) => `  _moduleTypes['${m.moduleId}'] = (function() {
    ${m.code}
    return {
      init: typeof init === 'function' ? init : function() { return {}; },
      process: typeof process === 'function' ? process : function(s) { return s; }
    };
  })();`,
    )
    .join("\n");

  return `
const _moduleTypes = {};
${moduleCodeBlock}

class LwMegaProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._placements = new Map();
    this._bus = {};
    this._order = [];
    this._headphones = [];

    this.port.onmessage = (e) => {
      const d = e.data;
      switch (d.type) {
        case 'addPlacement': {
          const mt = _moduleTypes[d.moduleId];
          if (!mt) break;
          const p = {
            placementId: d.placementId,
            moduleId: d.moduleId,
            userMod: mt,
            state: null,
            targetParams: d.initialParams || {},
            smoothParams: Object.assign({}, d.initialParams || {}),
            buttons: d.initialButtons || {},
            numInputs: d.numInputs,
            numOutputs: d.numOutputs,
            inputNames: d.inputNames || [],
            outputNames: d.outputNames || [],
            incomingWires: [],
            wireBusKeys: [],
            inputBufs: [],
            outputBufs: [],
            busKeys: [],
            faulted: false,
          };
          for (let i = 0; i < d.numInputs; i++) p.inputBufs.push(new Float32Array(128));
          for (let i = 0; i < d.numOutputs; i++) p.outputBufs.push(new Float32Array(128));
          for (let i = 0; i < d.numOutputs; i++) {
            const key = d.placementId + ':' + i;
            p.busKeys.push(key);
            this._bus[key] = new Float32Array(128);
          }
          this._placements.set(d.placementId, p);
          break;
        }
        case 'updateRouting': {
          const routing = d.routing;
          for (const pid in routing) {
            const p = this._placements.get(pid);
            if (p) {
              p.incomingWires = routing[pid];
              p.wireBusKeys = routing[pid].map(
                (w) => w.srcPlacementId + ':' + w.srcOutputIdx
              );
            }
          }
          this._order = d.order;
          break;
        }
        case 'params': {
          const p = this._placements.get(d.placementId);
          if (p) {
            Object.assign(p.targetParams, d.params);
            for (const key in d.params) {
              if (!(key in p.smoothParams)) p.smoothParams[key] = d.params[key];
            }
          }
          break;
        }
        case 'buttons': {
          const p = this._placements.get(d.placementId);
          if (p) Object.assign(p.buttons, d.buttons);
          break;
        }
        case 'setHeadphones': {
          this._headphones = d.outputs;
          break;
        }
      }
    };
  }

  process(allInputs, allOutputs) {
    for (let oi = 0; oi < this._order.length; oi++) {
      const pid = this._order[oi];
      const p = this._placements.get(pid);
      if (!p) continue;

      // Init state on first call
      if (p.state === null) {
        try { p.state = p.userMod.init(sampleRate); }
        catch (e) { p.state = {}; }
      }

      // Read inputs from bus — upstream already wrote current block data
      const inputs = p.inputBufs;
      for (let i = 0; i < p.numInputs; i++) inputs[i].fill(0);
      for (let w = 0; w < p.incomingWires.length; w++) {
        const wire = p.incomingWires[w];
        const srcBuf = this._bus[p.wireBusKeys[w]];
        if (srcBuf && inputs[wire.dstInputIdx]) {
          const dst = inputs[wire.dstInputIdx];
          for (let s = 0; s < 128; s++) dst[s] += srcBuf[s];
        }
      }

      // Zero outputs
      for (let i = 0; i < p.numOutputs; i++) p.outputBufs[i].fill(0);

      // One-pole param smoothing
      for (const key in p.targetParams) {
        const cur = p.smoothParams[key] ?? p.targetParams[key];
        p.smoothParams[key] = cur + 0.1 * (p.targetParams[key] - cur);
      }

      // Build named I/O
      const namedIn = {};
      for (let i = 0; i < p.inputNames.length; i++) namedIn[p.inputNames[i]] = inputs[i];
      const namedOut = {};
      for (let i = 0; i < p.outputNames.length; i++) namedOut[p.outputNames[i]] = p.outputBufs[i];

      // Process
      try {
        const ns = p.userMod.process(p.state, namedIn, namedOut, p.smoothParams, p.buttons);
        if (ns !== undefined) p.state = ns;
      } catch (e) {
        // Silence to avoid audio thread spam
      }

      // Sanitize & write outputs to bus immediately (available to downstream this block)
      for (let i = 0; i < p.numOutputs; i++) {
        const buf = p.outputBufs[i];
        let bad = false;
        for (let s = 0; s < 128; s++) {
          const v = buf[s];
          if (v !== v || v === Infinity || v === -Infinity) { bad = true; break; }
        }
        if (bad) {
          buf.fill(0);
          this._bus[p.busKeys[i]].fill(0);
          if (!p.faulted) {
            p.faulted = true;
            this.port.postMessage({ type: 'fault', placementId: p.placementId });
          }
          try { p.state = p.userMod.init(sampleRate); } catch (e) {}
          p.faulted = false;
        } else {
          this._bus[p.busKeys[i]].set(buf);
        }
      }
    }

    // Sum headphone outputs to node stereo outputs
    const outL = allOutputs[0] && allOutputs[0][0];
    const outR = allOutputs[1] && allOutputs[1][0];
    if (outL) outL.fill(0);
    if (outR) outR.fill(0);
    for (let h = 0; h < this._headphones.length; h++) {
      const hp = this._headphones[h];
      const buf = this._bus[hp.placementId + ':' + hp.outputIdx];
      if (!buf) continue;
      const dest = hp.channel === 0 ? outL : outR;
      if (dest) {
        for (let s = 0; s < 128; s++) dest[s] += buf[s];
      }
    }

    return true;
  }
}

registerProcessor('LwMegaProcessor', LwMegaProcessor);
`;
}
