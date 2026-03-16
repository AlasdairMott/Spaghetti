Design a complete Loudest Warning modular synth module — both the panel layout JSON and the audio processing code.

The user will describe what kind of module they want (e.g., "a dual VCO with sync and FM", "a stereo delay with tap tempo", "a 4-channel mixer with mutes"). Generate both the module JSON (for import into the designer) and the audio code.

## Panel Layout Rules

The panel is a 4U Eurorack-format module (175mm tall). Components are placed on a grid:
- **GRID_X** = 12.7mm (horizontal pitch)
- **GRID_Y** = 9.5mm (vertical pitch)
- **GRID_Y_OFFSET** = 2.0mm from top
- **HP_WIDTH** = 5.08mm, **GRID_COLS_PER_HP** = 4 (so 1 HP = 4 grid columns)
- Grid positions use integer `gridX` and `gridY` values
- Components should not overlap. Minimum spacing: 2 grid units between jacks/pots, 1 grid unit between buttons

### Standard Layout Conventions
- Module name appears at the top (rendered automatically from `module.name`)
- **Jacks** go at the bottom of the module (high gridY values, typically rows 14-17)
- **Pots/knobs** go in the middle section (gridY ~4-12)
- **Buttons** can go anywhere but typically above jacks
- Input jacks on the left, output jacks on the right
- Group related controls vertically (e.g., a knob with its CV input below it)
- Use `connections` (lines/arrows) to visually link related components on the panel

### Width Guidelines
- Simple utility modules: 4-8 HP
- Standard modules (VCO, VCF, VCA): 10-14 HP
- Complex modules (effects, sequencers): 16-24 HP
- Maximum practical width: ~30 HP

### Labeling
- Use short, clear labels (e.g., "Freq", "Res", "FM", "Out", "In L", "Mix")
- Use `labelColor` to color-code: "yellow" for pitch/frequency, "blue" for modulation, "red" for audio outputs, "green" for CV/gate
- Use `ref` fields for unique audio param references (e.g., "pitch", "cutoff", "resonance")

## Module JSON Structure

```json
{
  "id": "<generate a UUID>",
  "name": "Module Name",
  "widthHP": 10,
  "components": [
    {
      "id": "<generate a UUID>",
      "kind": "jack",
      "position": { "gridX": 4, "gridY": 16 },
      "label": "In",
      "ref": "in",
      "rotation": 0,
      "jackDirection": "input",
      "hasLed": false
    },
    {
      "id": "<generate a UUID>",
      "kind": "pot",
      "position": { "gridX": 4, "gridY": 6 },
      "label": "Freq",
      "ref": "pitch",
      "rotation": 0
    },
    {
      "id": "<generate a UUID>",
      "kind": "button",
      "position": { "gridX": 4, "gridY": 12 },
      "label": "Sync",
      "rotation": 0,
      "buttonLedCount": 1
    }
  ],
  "connections": [
    {
      "id": "<generate a UUID>",
      "kind": "line",
      "from": { "x": 50.8, "y": 59.0 },
      "to": { "x": 50.8, "y": 154.0 },
      "label": "Signal Flow"
    }
  ],
  "code": "<the audio code goes here>"
}
```

### Component Types
- **jack**: Has `jackDirection` — `"input"`, `"output"`, `"both"`, or `"headphones"` (headphones auto-routes to speakers). Optional `hasLed` for a status LED. Optional `voltageMin`/`voltageMax` (default -10 to 10V).
- **pot**: A knob. Always has a `ref` field for the audio code param key. Value is normalized 0.0-1.0 from a 0-300 degree sweep.
- **button**: Optional `buttonLedCount` (0-3) for LEDs above the button. Buttons are not yet wired to the audio engine.

### Connection Lines
Connection `from`/`to` coordinates are in **mm** (not grid units). Convert: `x = gridX * 12.7`, `y = 2.0 + gridY * 9.5`. Use `startOffset` and `endOffset` (in mm) to inset lines from component centers (typically 5-8mm to avoid overlapping components).

## Audio Code Contract

The `code` field must define two JavaScript functions:

```js
// Called once when audio starts. sampleRate is typically 44100.
function init(sampleRate) {
  return { /* initial state */ };
}

// Called every 128 samples.
// inputs: object keyed by jack ref/label → Float32Array (128 samples)
// outputs: object keyed by jack ref/label → Float32Array (128 samples)
// params: object keyed by pot ref/label → 0.0-1.0 float
// Must return the updated state object.
function process(state, inputs, outputs, params) {
  return state;
}
```

### Audio Code Rules
- **Pots/knobs** appear in `params` keyed by their `ref` field (falls back to `label` if no ref, then `id`). Values are always 0.0 to 1.0. Map these to musically useful ranges in the code (e.g., exponential frequency scaling for pitch).
- **Input jacks** (`jackDirection: "input"` or `"both"`) appear in `inputs` as named properties keyed by jack `ref` (falls back to `label`, then `id`). E.g., `inputs.IN`, `inputs["V/Oct"]`.
- **Output jacks** (`jackDirection: "output"`, `"both"`, or `"headphones"`) appear in `outputs` as named properties keyed the same way. E.g., `outputs.OUT`, `outputs["L Out"]`. Headphones jacks are automatically routed to speakers.
- **Buttons** are not yet wired to the audio engine — ignore them for now.
- Keep amplitude reasonable (multiply by 0.1-0.3) to avoid clipping.
- Use `Math.tanh()` for soft clipping in feedback paths to prevent NaN/Infinity.
- Common DSP patterns:
  - Oscillator: `phase += freq / sampleRate; if (phase >= 1) phase -= 1;`
  - Filter: `y = y + alpha * (x - y)` (one-pole lowpass)
  - Smoothing: `smoothed += 0.002 * (target - smoothed)` (per-sample one-pole)

### Parameter Mapping Examples
- **Pitch**: `freq = 20 * Math.pow(1000, param)` → 20Hz to 20kHz exponential
- **Cutoff**: `cutoff = 20 * Math.pow(1000, param)` → 20Hz to 20kHz exponential
- **Resonance**: `Q = 0.5 + param * 20` → 0.5 to 20.5
- **Volume/Mix**: Use directly as a linear 0-1 multiplier, or `dB = -60 + param * 60` for logarithmic
- **FM Amount**: `fmDepth = param * param * 5000` → quadratic for musical feel
- **Time/Delay**: `delaySec = 0.001 + param * param * 2` → 1ms to 2s quadratic
- **Rate/Speed**: `hz = 0.05 * Math.pow(200, param)` → 0.05Hz to 10Hz exponential

## What To Generate

1. Read the user's description carefully. Determine what components are needed (jacks, pots, buttons), their layout, and the appropriate module width.
2. Generate the complete module JSON with:
   - Sensible panel layout following the conventions above
   - All UUIDs generated fresh (use the format `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`)
   - Appropriate `ref` fields on all pots
   - `jackDirection` set correctly on all jacks
   - `labelColor` for visual grouping
   - Connection lines where they aid readability
3. Generate the audio processing code and embed it in the `code` field.
4. Add brief comments in the code explaining parameter mappings.

Output the complete module JSON (with code embedded) inside a single JSON code block. The user can then import this via the Import Project feature or paste it into the app.

$ARGUMENTS
