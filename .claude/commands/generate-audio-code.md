Generate AudioWorklet processor code for a Loudest Warning modular synth module.

The user will provide (or you should ask for) the module JSON from the clipboard. Parse it to understand the module's components.

## Module JSON Structure

The module JSON has this shape:
```json
{
  "id": "uuid",
  "name": "Module Name",
  "widthHP": 10,
  "components": [
    { "id": "uuid", "kind": "jack|pot|button", "label": "Name", "ref": "paramRef", "jackDirection": "input|output|both|headphones", ... },
    ...
  ],
  "connections": [...],
  "code": "existing code if any"
}
```

## Audio Code Contract

The code must define two functions:

```js
// Called once when audio starts. sampleRate is typically 44100.
function init(sampleRate) {
  return { /* initial state */ };
}

// Called every 128 samples.
// inputs: object keyed by jack ref/label → Float32Array (128 samples)
// outputs: object keyed by jack ref/label → Float32Array (128 samples)
// params: object keyed by pot ref/label → 0.0-1.0 float
// buttons: object keyed by button ref/label → true/false (toggle state)
// Must return the updated state object.
function process(state, inputs, outputs, params, buttons) {
  return state;
}
```

## Key Rules

- **Pots/knobs** appear in `params` keyed by their `ref` field (falls back to `label` if no ref, then `id`). Values are always 0.0 to 1.0 (normalized from 0-300 degree knob sweep). Map these to musically useful ranges in the code (e.g., exponential frequency scaling).
- **Input jacks** (`jackDirection: "input"` or `"both"`) appear in `inputs` as named properties, keyed by the jack's `ref` field (falls back to `label`, then `id`). E.g., a jack with label "IN" is accessed as `inputs.IN` or `inputs["IN"]`.
- **Output jacks** (`jackDirection: "output"`, `"both"`, or `"headphones"`) appear in `outputs` as named properties, keyed the same way. Headphones jacks are automatically routed to speakers. E.g., `outputs.OUT` or `outputs["L Out"]`.
- **Buttons** appear in `buttons` (5th argument) keyed by their `ref` field (falls back to `label`, then `id`). Values are `true` (pressed/toggled on) or `false`. Buttons toggle on click in the rack view. Use them for mode switches, triggers, gates, etc.
- Keep amplitude reasonable (multiply by 0.1-0.3) to avoid clipping.
- Use one-pole smoothing for any parameter-driven frequency/gain changes within the process loop if needed for extra smoothness beyond the built-in worklet smoothing.
- Common DSP patterns: `phase += freq / sampleRate; if (phase >= 1) phase -= 1;` for oscillators, `y = y + alpha * (x - y)` for filters.

## What To Generate

1. Analyze the module's jacks (inputs vs outputs), pots (params), and purpose based on the module name and labels.
2. Write appropriate `init()` and `process()` functions.
3. Add brief comments explaining parameter mappings (e.g., "// Pitch: 0-1 maps to 50Hz-5kHz exponential").
4. If the module has input jacks, process the incoming audio (filter, effect, mix, etc.).
5. If the module has only output jacks, generate audio (oscillator, noise, LFO, etc.).

Output ONLY the JavaScript code (no markdown fences), ready to paste into the Monaco editor.

$ARGUMENTS
