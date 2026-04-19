import JSZip from "jszip";
import type { Module, PanelComponent } from "../models/types";
import { buildKicadPcbFile, f, uuid, panelLedPositions } from "./exportKicad";
import { gridToMm } from "./grid";
import {
  POT_INSTANCE,
  JACK_INSTANCE,
  BUTTON_INSTANCE,
  LED_INSTANCE,
  R_INSTANCE,
  GND_INSTANCE,
} from "./kicadTemplates";

// -----------------------------------------------------------------------
// Library identifiers — configurable via the export modal.
// -----------------------------------------------------------------------

export interface KicadLibrarySettings {
  // Footprint lib IDs (used in schematic Footprint property + PCB footprint ref)
  fpPot: string;
  fpJack: string;
  fpButton: string;
  fpLed: string;
  fpResistor: string;
  // Symbol lib IDs (used in schematic lib_id)
  symPot: string;
  symJack: string;
  symButton: string;
  symLed: string;
  symResistor: string;
}

// -----------------------------------------------------------------------
// Minimal pad definitions — just enough for KiCad to recognise the pins
// and route between them. Running "Tools → Update Footprints from Library"
// in pcbnew will fetch the full silkscreen / courtyard / fab / 3D model
// from the referenced library.
// -----------------------------------------------------------------------
interface PadDef {
  name: string;
  shape: "circle" | "oval" | "rect";
  x: number;
  y: number;
  size: number;
  drill: number;
}

const POT_PADS: PadDef[] = [
  { name: "1", shape: "circle", x: -2.5, y: 7.5, size: 1.5, drill: 1.0 },
  { name: "2", shape: "circle", x: 0, y: 7.5, size: 1.5, drill: 1.0 },
  { name: "3", shape: "circle", x: 2.5, y: 7.5, size: 1.5, drill: 1.0 },
];
const JACK_PADS: PadDef[] = [
  { name: "S", shape: "oval", x: 0, y: 6.5, size: 3.1, drill: 1.0 },
  { name: "T", shape: "circle", x: 0, y: -4.92, size: 2.6, drill: 1.2 },
  { name: "TN", shape: "circle", x: 0, y: 3.38, size: 2.6, drill: 1.2 },
];
const BUTTON_PADS: PadDef[] = [
  { name: "1", shape: "rect", x: -3.25, y: -2.25, size: 1.8, drill: 1.0 },
  { name: "2", shape: "circle", x: 3.25, y: -2.25, size: 1.8, drill: 1.0 },
  { name: "3", shape: "circle", x: -3.25, y: 2.25, size: 1.8, drill: 1.0 },
  { name: "4", shape: "circle", x: 3.25, y: 2.25, size: 1.8, drill: 1.0 },
];
const LED_PADS: PadDef[] = [
  { name: "1", shape: "rect", x: -1.27, y: 0, size: 1.8, drill: 0.9 },
  { name: "2", shape: "circle", x: 1.27, y: 0, size: 1.8, drill: 0.9 },
];
const R_PADS: PadDef[] = [
  { name: "1", shape: "circle", x: 0, y: 0, size: 1.4, drill: 0.7 },
  { name: "2", shape: "circle", x: 7.62, y: 0, size: 1.4, drill: 0.7 },
];

// -----------------------------------------------------------------------
// Schematic pin positions (offset from symbol origin, rot=0).
// Used to place labels at pin endpoints so pre-wired nets appear in the
// schematic (not just in the PCB).
// -----------------------------------------------------------------------
interface PinPos {
  num: string;
  x: number;
  y: number;
  /** Side the pin enters from, so we can place the label off-symbol */
  side: "left" | "right" | "top" | "bottom";
}

const POT_SCH_PINS: PinPos[] = [
  { num: "1", x: 0, y: 3.81, side: "bottom" },
  { num: "2", x: 3.81, y: 0, side: "right" },
  { num: "3", x: 0, y: -3.81, side: "top" },
];
const JACK_SCH_PINS: PinPos[] = [
  { num: "S", x: 5.08, y: 2.54, side: "right" },
  { num: "T", x: 5.08, y: 0, side: "right" },
  { num: "TN", x: 5.08, y: -2.54, side: "right" },
];
// LED template is placed at rotation 180 — pin screen positions are
// mirrored from the lib_symbol definition.
const LED_SCH_PINS: PinPos[] = [
  { num: "1", x: 3.81, y: 0, side: "right" }, // K (cathode) → GND
  { num: "2", x: -3.81, y: 0, side: "left" }, // A (anode) → overlaps R pin 1
];
// R template is placed at rotation 90 — pin 1 (top in lib) ends up on the
// right, pin 2 (bottom in lib) ends up on the left.
const R_SCH_PINS: PinPos[] = [
  { num: "1", x: 3.81, y: 0, side: "right" }, // → overlaps LED anode
  { num: "2", x: -3.81, y: 0, side: "left" }, // → signal net label
];

// -----------------------------------------------------------------------
// Pin-to-net mapping per component kind (for pre-wired nets).
//
// SCHEMATIC pin mapping (used for label/GND placement at pin positions):
// Pot:    pin 1=GND (bottom), pin 2=wiper(signal), pin 3=+3V3 (top)
// Jack:   S=GND (sleeve), T=signal (tip), TN=unconnected (normalling)
// Button: pins 1,2=signal, pins 3,4=GND
// LED:    pin 1=K/GND, pin 2=A (wire-connected to R pin 1, no named net)
// R:      pin 1 (wire-connected to LED pin 2, no named net), pin 2=signalNet
//
// PCB pad mapping: usually matches schematic pin mapping, but the
// potentiometer footprint has pads 1 & 3 swapped vs the symbol.
// -----------------------------------------------------------------------
function potPinNet(padName: string, signalNet: string): string {
  if (padName === "1") return "GND";
  if (padName === "2") return signalNet;
  if (padName === "3") return "+3V3";
  return "";
}
/** PCB pad-to-net for pots — pads 1 & 3 are swapped vs the schematic symbol. */
function potPadNet(padName: string, signalNet: string): string {
  if (padName === "1") return "+3V3";
  if (padName === "2") return signalNet;
  if (padName === "3") return "GND";
  return "";
}
function jackPinNet(padName: string, signalNet: string): string {
  if (padName === "S") return "GND";
  if (padName === "T") return signalNet;
  return "";
}
function buttonPinNet(padName: string, signalNet: string): string {
  if (padName === "1" || padName === "2") return signalNet;
  if (padName === "3" || padName === "4") return "GND";
  return "";
}
function ledPinNet(padName: string): string {
  if (padName === "1") return "GND"; // K (cathode)
  // Anode (pin 2) is connected to R pin 1 by direct wire overlap in the
  // schematic — no named net label.  Leave unnetted in the PCB so
  // "Update PCB from Schematic" assigns the auto-generated net correctly.
  return "";
}
function rPinNet(padName: string, signalNet: string): string {
  // Pin 1 connects to LED anode by wire overlap — no named net, leave unnetted.
  if (padName === "2") return signalNet; // signal side → MCU digital pin
  return "";
}

// -----------------------------------------------------------------------
// Layout
// -----------------------------------------------------------------------
// Schematic: four rows (pots / jacks / buttons / LED+resistor pairs)
const SCH_COL_W = 30;
const SCH_START_X = 40;
const SCH_POT_Y = 40;
const SCH_JACK_Y = 130;
const SCH_BUTTON_Y = 220;
const SCH_LED_Y = 310;
const SCH_INTRA_ROW_H = 40; // spacing between wrap rows within a group
const SCH_MAX_COLS = 10; // wrap to next row within a group after this many
// Horizontal offset from LED centre to its paired resistor centre so that
// R pin 1 and LED pin 2 (anode) share the same schematic coordinate.
// R(rot 90) pin1 = centre+3.81, LED(rot 180) pin2 = centre-3.81
// => R_centre = LED_centre - 7.62
const SCH_R_LED_DX = -7.62;

// PCB: footprints are placed at the panel x/y (mm) from the module designer.
// A margin is added around the resulting bounding box for the Edge.Cuts outline.
const PCB_MARGIN = 8;

interface Assigned {
  comp: PanelComponent;
  schSymUuid: string;
  pcbFpUuid: string;
  refDes: string;
  signalNet: string;
  schX: number;
  schY: number;
  pcbX: number;
  pcbY: number;
}

/**
 * Auxiliary part derived from the panel components — LEDs (one per jack
 * `hasLed` and per button LED) and their series resistors. These aren't
 * drawn in the module designer but need a schematic symbol + PCB footprint
 * in the exported project so the user can wire them.
 */
interface Aux {
  kind: "led" | "resistor";
  schSymUuid: string;
  pcbFpUuid: string;
  refDes: string;
  /** Signal net on the resistor's free end (R pad 2 → MCU) */
  signalNet: string;
  schX: number;
  schY: number;
  pcbX: number;
  pcbY: number;
}

function sanitizeNet(s: string): string {
  return s.replace(/[^a-zA-Z0-9_+-]/g, "_");
}

function assignComponents(module: Module): { main: Assigned[]; aux: Aux[] } {
  // Split by kind so we can lay each out on its own schematic row
  const pots: PanelComponent[] = [];
  const jacks: PanelComponent[] = [];
  const buttons: PanelComponent[] = [];
  for (const comp of module.components) {
    if (comp.kind === "pot") pots.push(comp);
    else if (comp.kind === "jack") jacks.push(comp);
    else if (comp.kind === "button") buttons.push(comp);
  }

  const main: Assigned[] = [];
  const netCounters = { pot: 0, jack: 0, button: 0 };

  const layKind = (list: PanelComponent[], prefix: string, schY: number) => {
    list.forEach((comp, i) => {
      const col = i % SCH_MAX_COLS;
      const row = Math.floor(i / SCH_MAX_COLS);
      const refDes = `${prefix}${i + 1}`;
      const signalNet = comp.ref
        ? sanitizeNet(comp.ref)
        : comp.label
          ? sanitizeNet(comp.label)
          : `NET_${comp.kind.toUpperCase()}_${++netCounters[comp.kind]}`;
      const panelPos = gridToMm(comp.position);
      main.push({
        comp,
        schSymUuid: uuid(),
        pcbFpUuid: uuid(),
        refDes,
        signalNet,
        schX: SCH_START_X + col * SCH_COL_W,
        schY: schY + row * SCH_INTRA_ROW_H,
        // PCB footprint sits at the panel position — matches the module designer
        pcbX: panelPos.x,
        pcbY: panelPos.y,
      });
    });
  };

  layKind(pots, "RV", SCH_POT_Y);
  layKind(jacks, "J", SCH_JACK_Y);
  layKind(buttons, "S", SCH_BUTTON_Y);

  // -------- Auxiliaries: LEDs + series resistors --------
  // Reuse the panel exporter's LED position list so panel drill holes and
  // the project PCB footprint positions always agree.
  const leds = panelLedPositions(module);

  const aux: Aux[] = [];
  // Track label usage so duplicate labels (e.g. button with 3 LEDs) get a suffix
  const labelCount = new Map<string, number>();
  leds.forEach((led, i) => {
    const col = i % SCH_MAX_COLS;
    const row = Math.floor(i / SCH_MAX_COLS);
    // Derive net names from the parent component's label
    const safeName = led.label.replace(/[^a-zA-Z0-9_]/g, "_");
    const count = (labelCount.get(safeName) ?? 0) + 1;
    labelCount.set(safeName, count);
    const suffix = count > 1 ? `_${count}` : "";
    const signalNet = `led_${safeName}${suffix}`; // signal net (R pad 2 → MCU)
    const ledSchX = SCH_START_X + col * SCH_COL_W;
    const ledSchY = SCH_LED_Y + row * SCH_INTRA_ROW_H;
    // LED placed so its body centres on the panel hole position
    aux.push({
      kind: "led",
      schSymUuid: uuid(),
      pcbFpUuid: uuid(),
      refDes: `D${i + 1}`,
      signalNet,
      schX: ledSchX,
      schY: ledSchY,
      pcbX: led.x,
      pcbY: led.y,
    });
    // Resistor placed to the left of the LED so R pin 1 meets LED pin 2 (anode)
    aux.push({
      kind: "resistor",
      schSymUuid: uuid(),
      pcbFpUuid: uuid(),
      refDes: `R${i + 1}`,
      signalNet,
      schX: ledSchX + SCH_R_LED_DX,
      schY: ledSchY,
      pcbX: led.x,
      pcbY: led.y + 10,
    });
  });

  return { main, aux };
}

// -----------------------------------------------------------------------
// Template transformation helpers
// -----------------------------------------------------------------------
const UUID_RE =
  /"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"/g;

function regenUuids(template: string): string {
  return template.replace(UUID_RE, () => `"${uuid()}"`);
}

function setTopLevelUuid(template: string, newUuid: string): string {
  // First uuid() is the top-level footprint/symbol's own uuid
  return template.replace(/\(uuid "[0-9a-f-]{36}"\)/, `(uuid "${newUuid}")`);
}

/**
 * Replace the first top-level `(at X Y[ R])` in a template and shift
 * every other `(at ...)` by the same delta so property positions
 * (Reference, Value, Footprint, etc.) stay relative to the symbol.
 */
function setTopLevelAt(
  template: string,
  x: number,
  y: number,
  rot?: number,
): string {
  const atRe = /\(at (-?[\d.]+) (-?[\d.]+)(?: (-?[\d.]+))?\)/;
  // Extract the template's original symbol position from the first match.
  const origMatch = template.match(atRe);
  if (!origMatch) return template;
  const origX = parseFloat(origMatch[1]);
  const origY = parseFloat(origMatch[2]);
  const origRot =
    origMatch[3] !== undefined ? parseFloat(origMatch[3]) : undefined;
  const dx = x - origX;
  const dy = y - origY;

  // Shift every (at ...) in the template by the delta.
  let first = true;
  return template.replace(
    /\(at (-?[\d.]+) (-?[\d.]+)(?: (-?[\d.]+))?\)/g,
    (_match, xStr: string, yStr: string, rStr: string | undefined) => {
      const nx = parseFloat(xStr) + dx;
      const ny = parseFloat(yStr) + dy;
      // Use caller-supplied rotation for the top-level (first) at, falling
      // back to the template's original rotation to preserve it.
      // Inner property positions always keep their original rotation.
      const nr = first
        ? (rot ?? origRot ?? 0)
        : rStr !== undefined
          ? parseFloat(rStr)
          : undefined;
      first = false;
      return nr !== undefined
        ? `(at ${f(nx)} ${f(ny)} ${f(nr)})`
        : `(at ${f(nx)} ${f(ny)})`;
    },
  );
}

function setLibId(template: string, newLibId: string): string {
  return template.replace(/\(lib_id "[^"]*"\)/, `(lib_id "${newLibId}")`);
}

function setPropertyValue(
  template: string,
  propName: string,
  newValue: string,
): string {
  const re = new RegExp(`\\(property "${propName}" "[^"]*"`);
  return template.replace(re, `(property "${propName}" "${newValue}"`);
}

function setInstancesBlock(
  template: string,
  projectName: string,
  sheetUuid: string,
  refDes: string,
): string {
  let t = template;
  t = t.replace(/\(project "[^"]*"/, `(project "${projectName}"`);
  t = t.replace(/\(path "\/[0-9a-f-]{36}"/, `(path "/${sheetUuid}"`);
  t = t.replace(/\(reference "[^"]*"\)/, `(reference "${refDes}")`);
  return t;
}

// Global counter for power symbol reference designators (#PWR01, #PWR02, …)
let pwrIndex = 0;
function resetPwrIndex(): void {
  pwrIndex = 0;
}
function nextPwrRef(): string {
  return `#PWR0${++pwrIndex}`;
}

/**
 * Emit a `power:GND` symbol instance placed 1.27mm below the pin,
 * plus a short wire from the pin to the symbol.
 */
function schGndBlock(
  pinX: number,
  pinY: number,
  projectName: string,
  sheetUuid: string,
): string {
  const gndY = pinY + 1.27;
  const ref = nextPwrRef();
  let tpl = GND_INSTANCE;
  tpl = regenUuids(tpl);
  tpl = setTopLevelAt(tpl, pinX, gndY);
  tpl = setPropertyValue(tpl, "Reference", ref);
  tpl = setInstancesBlock(tpl, projectName, sheetUuid, ref);

  const wire = [
    `  (wire`,
    `    (pts`,
    `      (xy ${f(pinX)} ${f(pinY)}) (xy ${f(pinX)} ${f(gndY)})`,
    `    )`,
    `    (stroke`,
    `      (width 0)`,
    `      (type default)`,
    `    )`,
    `    (uuid "${uuid()}")`,
    `  )`,
  ].join("\n");
  return [tpl, wire].join("\n");
}

/** Emit a KiCad no-connect flag at a pin position. */
function schNoConnectBlock(x: number, y: number): string {
  return [
    `  (no_connect`,
    `    (at ${f(x)} ${f(y)})`,
    `    (uuid "${uuid()}")`,
    `  )`,
  ].join("\n");
}

/** Emit a KiCad schematic wire between two points. */
function schWireBlock(x1: number, y1: number, x2: number, y2: number): string {
  return [
    `  (wire`,
    `    (pts`,
    `      (xy ${f(x1)} ${f(y1)}) (xy ${f(x2)} ${f(y2)})`,
    `    )`,
    `    (stroke`,
    `      (width 0)`,
    `      (type default)`,
    `    )`,
    `    (uuid "${uuid()}")`,
    `  )`,
  ].join("\n");
}

/** Emit a KiCad junction dot. */
function schJunctionBlock(x: number, y: number): string {
  return [
    `  (junction`,
    `    (at ${f(x)} ${f(y)})`,
    `    (diameter 0)`,
    `    (color 0 0 0 0)`,
    `    (uuid "${uuid()}")`,
    `  )`,
  ].join("\n");
}

/**
 * Emit wiring for a button: pins 1 & 2 (left / signal) are tied together
 * with a single label; pins 3 & 4 (right / GND) are tied together with a
 * single GND power symbol.  Matches the Example project layout.
 *
 * Layout (signal side, left of symbol):
 *   label ── wire ──┬── wire ── pin1
 *                   │
 *                   └── wire ── pin2
 *
 * Layout (GND side, right of symbol):
 *   pin3 ── wire ──┬── wire (down) ── GND
 *                  │
 *   pin4 ── wire ──┘
 */
function schButtonWiring(
  symX: number,
  symY: number,
  signalNet: string,
  projectName: string,
  sheetUuid: string,
): string[] {
  const parts: string[] = [];

  // Pin screen positions (button template is rot 0).
  // In KiCad schematic coords positive-Y is down, so +2.54 is lower on screen.
  const pin1X = symX - 10.16,
    pin1Y = symY + 2.54; // left bottom
  const pin2X = symX - 10.16,
    pin2Y = symY - 2.54; // left top
  const pin3X = symX + 10.16,
    pin3Y = symY + 2.54; // right bottom
  const pin4X = symX + 10.16,
    pin4Y = symY - 2.54; // right top

  // --- Signal side (left): tie pins 1 & 2, one label at top ---
  const sigJoinX = pin1X - 2.54; // junction column left of pins
  // Horizontal wires from junction column to each pin
  parts.push(schWireBlock(sigJoinX, pin2Y, pin2X, pin2Y));
  parts.push(schWireBlock(sigJoinX, pin1Y, pin1X, pin1Y));
  // Vertical wire connecting the two horizontals
  parts.push(schWireBlock(sigJoinX, pin2Y, sigJoinX, pin1Y));
  // Junction at the top where label wire meets the vertical
  parts.push(schJunctionBlock(sigJoinX, pin2Y));
  // Label at the top junction, pointing left
  parts.push(
    schLabelBlock(
      sigJoinX,
      pin2Y,
      { num: "1", x: 0, y: 0, side: "left" },
      signalNet,
    ),
  );

  // --- GND side (right): tie pins 3 & 4, one GND symbol below ---
  const gndJoinX = pin3X + 2.54; // junction column right of pins
  // Horizontal wires from each pin to junction column
  parts.push(schWireBlock(pin4X, pin4Y, gndJoinX, pin4Y));
  parts.push(schWireBlock(pin3X, pin3Y, gndJoinX, pin3Y));
  // Vertical wire connecting the two horizontals
  parts.push(schWireBlock(gndJoinX, pin4Y, gndJoinX, pin3Y));
  // Junction at the bottom where GND wire meets the vertical
  parts.push(schJunctionBlock(gndJoinX, pin3Y));
  // GND symbol below the bottom junction
  parts.push(schGndBlock(gndJoinX, pin3Y, projectName, sheetUuid));

  return parts;
}

/**
 * Emit a `(label ...)` block at a pin position, so the pin joins the net.
 * Label is offset 1.27mm outward from the symbol on the pin's side and
 * rotated so it reads left-to-right without crossing the symbol body.
 */
function schLabelBlock(
  symX: number,
  symY: number,
  pin: PinPos,
  netName: string,
): string {
  const x = symX + pin.x;
  const y = symY + pin.y;
  let labelRot = 0;
  let justify = "left bottom";
  if (pin.side === "left") {
    labelRot = 180;
    justify = "right bottom";
  } else if (pin.side === "top") {
    labelRot = 90;
    justify = "left bottom";
  } else if (pin.side === "bottom") {
    labelRot = 270;
    justify = "left bottom";
  }
  return [
    `  (label "${netName}"`,
    `    (at ${f(x)} ${f(y)} ${f(labelRot)})`,
    `    (effects`,
    `      (font (size 1.27 1.27))`,
    `      (justify ${justify})`,
    `    )`,
    `    (uuid "${uuid()}")`,
    `  )`,
  ].join("\n");
}

// -----------------------------------------------------------------------
// Build schematic symbol block — shared setup for main and aux parts.
// -----------------------------------------------------------------------
interface SchSymArgs {
  template: string;
  symId: string;
  fpId: string;
  symUuid: string;
  refDes: string;
  value: string;
  schX: number;
  schY: number;
  projectName: string;
  sheetUuid: string;
}

function prepareSchSymbol(a: SchSymArgs): string {
  let tpl = a.template;
  tpl = regenUuids(tpl);
  tpl = setTopLevelUuid(tpl, a.symUuid);
  tpl = setLibId(tpl, a.symId);
  tpl = setInstancesBlock(tpl, a.projectName, a.sheetUuid, a.refDes);
  tpl = setTopLevelAt(tpl, a.schX, a.schY);
  tpl = setPropertyValue(tpl, "Reference", a.refDes);
  tpl = setPropertyValue(tpl, "Value", a.value);
  tpl = setPropertyValue(tpl, "Footprint", a.fpId);
  return tpl;
}

/** Emit label / GND / no-connect annotations for a list of pins. */
function schPinAnnotations(
  schX: number,
  schY: number,
  pins: PinPos[],
  pinNet: (num: string) => string,
  projectName: string,
  sheetUuid: string,
  skipPins?: Set<string>,
): string[] {
  return pins
    .map((pin) => {
      if (skipPins?.has(pin.num)) return null;
      const net = pinNet(pin.num);
      if (!net) return schNoConnectBlock(schX + pin.x, schY + pin.y);
      if (net === "GND")
        return schGndBlock(schX + pin.x, schY + pin.y, projectName, sheetUuid);
      return schLabelBlock(schX, schY, pin, net);
    })
    .filter((l): l is string => l !== null);
}

function schSymbolBlock(
  a: Assigned,
  projectName: string,
  sheetUuid: string,
  libs: KicadLibrarySettings,
): string {
  const kind = a.comp.kind;
  const tpl = prepareSchSymbol({
    template:
      kind === "pot"
        ? POT_INSTANCE
        : kind === "jack"
          ? JACK_INSTANCE
          : BUTTON_INSTANCE,
    symId:
      kind === "pot" ? libs.symPot : kind === "jack" ? libs.symJack : libs.symButton,
    fpId:
      kind === "pot" ? libs.fpPot : kind === "jack" ? libs.fpJack : libs.fpButton,
    symUuid: a.schSymUuid,
    refDes: a.refDes,
    value:
      kind === "pot" ? "10k" : kind === "jack" ? a.signalNet : a.comp.label,
    schX: a.schX,
    schY: a.schY,
    projectName,
    sheetUuid,
  });

  // Buttons get dedicated wiring (pins tied together, one label, one GND).
  if (kind === "button") {
    const wiring = schButtonWiring(
      a.schX,
      a.schY,
      a.signalNet,
      projectName,
      sheetUuid,
    );
    return [tpl, ...wiring].join("\n");
  }

  const pins = kind === "pot" ? POT_SCH_PINS : JACK_SCH_PINS;
  const pinNetFn = kind === "pot" ? potPinNet : jackPinNet;
  const extras = schPinAnnotations(
    a.schX,
    a.schY,
    pins,
    (num) => pinNetFn(num, a.signalNet),
    projectName,
    sheetUuid,
  );
  return [tpl, ...extras].join("\n");
}

function schAuxBlock(a: Aux, projectName: string, sheetUuid: string, libs: KicadLibrarySettings): string {
  const tpl = prepareSchSymbol({
    template: a.kind === "led" ? LED_INSTANCE : R_INSTANCE,
    symId: a.kind === "led" ? libs.symLed : libs.symResistor,
    fpId: a.kind === "led" ? libs.fpLed : libs.fpResistor,
    symUuid: a.schSymUuid,
    refDes: a.refDes,
    value: a.kind === "led" ? "LED" : "1kΩ",
    schX: a.schX,
    schY: a.schY,
    projectName,
    sheetUuid,
  });

  const pins = a.kind === "led" ? LED_SCH_PINS : R_SCH_PINS;
  // Skip the shared anode pin — LED pin 2 and R pin 1 overlap directly.
  const skip = new Set([a.kind === "led" ? "2" : "1"]);
  const extras = schPinAnnotations(
    a.schX,
    a.schY,
    pins,
    a.kind === "led"
      ? (num) => ledPinNet(num)
      : (num) => rPinNet(num, a.signalNet),
    projectName,
    sheetUuid,
    skip,
  );
  return [tpl, ...extras].join("\n");
}

// -----------------------------------------------------------------------
// Build PCB footprint block — minimal reference-only.
// Contains just enough to identify the footprint (library reference),
// position it, link it to its schematic symbol, and define its pads with
// nets. Full geometry (silkscreen, courtyard, fab, 3D model) is pulled
// from the library when the user runs "Update Footprints from Library".
// -----------------------------------------------------------------------
interface PcbFpArgs {
  fpId: string;
  pads: PadDef[];
  padNet: (padName: string) => string;
  refDes: string;
  value: string;
  fpUuid: string;
  schSymUuid: string;
  x: number;
  y: number;
  netMap: Map<string, number>;
}

function pcbFootprint(a: PcbFpArgs): string {
  const padBlocks = a.pads
    .map((p) => {
      const netName = a.padNet(p.name);
      const netNum = netName ? (a.netMap.get(netName) ?? 0) : 0;
      const netLine = netName ? `      (net ${netNum} "${netName}")` : null;
      const sizeLine =
        p.shape === "oval"
          ? `      (size ${f(p.size)} ${f(p.size * 0.75)})`
          : `      (size ${f(p.size)} ${f(p.size)})`;
      const drillLine =
        p.shape === "oval"
          ? `      (drill oval ${f(p.drill)} ${f(p.drill * 0.75)})`
          : `      (drill ${f(p.drill)})`;
      return [
        `    (pad "${p.name}" thru_hole ${p.shape}`,
        `      (at ${f(p.x)} ${f(p.y)})`,
        sizeLine,
        drillLine,
        `      (layers "*.Cu" "*.Mask")`,
        netLine,
        `      (uuid "${uuid()}")`,
        `    )`,
      ]
        .filter((l): l is string => l !== null)
        .join("\n");
    })
    .join("\n");

  return [
    `  (footprint "${a.fpId}"`,
    `    (layer "F.Cu")`,
    `    (uuid "${a.fpUuid}")`,
    `    (at ${f(a.x)} ${f(a.y)} 0)`,
    `    (property "Reference" "${a.refDes}"`,
    `      (at 0 -4 0)`,
    `      (layer "F.SilkS")`,
    `      (uuid "${uuid()}")`,
    `      (effects (font (size 1 1) (thickness 0.15)))`,
    `    )`,
    `    (property "Value" "${a.value}"`,
    `      (at 0 4 0)`,
    `      (layer "F.Fab")`,
    `      (hide yes)`,
    `      (uuid "${uuid()}")`,
    `      (effects (font (size 1 1) (thickness 0.15)))`,
    `    )`,
    `    (path "/${a.schSymUuid}")`,
    `    (sheetname "/")`,
    `    (attr through_hole)`,
    padBlocks,
    `  )`,
  ].join("\n");
}

function mainPcbFootprint(a: Assigned, netMap: Map<string, number>, libs: KicadLibrarySettings): string {
  const fpId =
    a.comp.kind === "pot"
      ? libs.fpPot
      : a.comp.kind === "jack"
        ? libs.fpJack
        : libs.fpButton;
  const pads =
    a.comp.kind === "pot"
      ? POT_PADS
      : a.comp.kind === "jack"
        ? JACK_PADS
        : BUTTON_PADS;
  const padNetFn =
    a.comp.kind === "pot"
      ? potPadNet
      : a.comp.kind === "jack"
        ? jackPinNet
        : buttonPinNet;

  return pcbFootprint({
    fpId,
    pads,
    padNet: (name) => padNetFn(name, a.signalNet),
    refDes: a.refDes,
    value: a.signalNet,
    fpUuid: a.pcbFpUuid,
    schSymUuid: a.schSymUuid,
    x: a.pcbX,
    y: a.pcbY,
    netMap,
  });
}

function auxPcbFootprint(a: Aux, netMap: Map<string, number>, libs: KicadLibrarySettings): string {
  const fpId = a.kind === "led" ? libs.fpLed : libs.fpResistor;
  const pads = a.kind === "led" ? LED_PADS : R_PADS;

  return pcbFootprint({
    fpId,
    pads,
    padNet:
      a.kind === "led"
        ? (name) => ledPinNet(name)
        : (name) => rPinNet(name, a.signalNet),
    refDes: a.refDes,
    value: a.kind === "led" ? "LED" : "1k",
    fpUuid: a.pcbFpUuid,
    schSymUuid: a.schSymUuid,
    x: a.pcbX,
    y: a.pcbY,
    netMap,
  });
}

// -----------------------------------------------------------------------
// Schematic file
// -----------------------------------------------------------------------
function buildSchematicFile(
  module: Module,
  main: Assigned[],
  aux: Aux[],
  projectName: string,
  sheetUuid: string,
  libs: KicadLibrarySettings,
): string {
  resetPwrIndex();
  const symbols = [
    ...main.map((a) => schSymbolBlock(a, projectName, sheetUuid, libs)),
    ...aux.map((a) => schAuxBlock(a, projectName, sheetUuid, libs)),
  ].join("\n");

  return [
    `(kicad_sch`,
    `  (version 20250114)`,
    `  (generator "eeschema")`,
    `  (generator_version "9.0")`,
    `  (uuid "${sheetUuid}")`,
    `  (paper "A4")`,
    `  (title_block`,
    `    (title "${module.name.replace(/"/g, "'")}")`,
    `  )`,
    `  (lib_symbols)`,
    symbols,
    `  (sheet_instances`,
    `    (path "/"`,
    `      (page "1")`,
    `    )`,
    `  )`,
    `)`,
  ].join("\n");
}

// -----------------------------------------------------------------------
// Project file
// -----------------------------------------------------------------------
function buildProjectFile(filename: string, sheetUuid: string): string {
  return JSON.stringify(
    {
      board: {
        design_settings: {
          defaults: {
            board_outline_line_width: 0.05,
            copper_line_width: 0.2,
            silk_line_width: 0.1,
            silk_text_size_h: 1.0,
            silk_text_size_v: 1.0,
            silk_text_thickness: 0.1,
          },
          rules: {
            min_clearance: 0.2,
            min_copper_edge_clearance: 0.15,
            min_track_width: 0.2,
            min_via_diameter: 0.6,
            min_via_annular_width: 0.1,
          },
        },
      },
      boards: [],
      meta: { filename, version: 3 },
      net_settings: {
        classes: [
          {
            name: "Default",
            clearance: 0.2,
            track_width: 0.2,
            via_diameter: 0.6,
            via_drill: 0.3,
            wire_width: 6,
          },
          {
            name: "+12V",
            clearance: 0.2,
            track_width: 0.4,
            via_diameter: 0.6,
            via_drill: 0.3,
            wire_width: 6,
          },
          {
            name: "-12V",
            clearance: 0.2,
            track_width: 0.4,
            via_diameter: 0.6,
            via_drill: 0.3,
            wire_width: 6,
          },
        ],
        netclass_patterns: [
          { netclass: "+12V", pattern: "+12V" },
          { netclass: "-12V", pattern: "-12V" },
        ],
      },
      pcbnew: { last_paths: {} },
      schematic: { legacy_lib_dir: "", legacy_lib_list: [] },
      sheets: [[sheetUuid, "Root"]],
      text_variables: {},
    },
    null,
    2,
  );
}

// -----------------------------------------------------------------------
// Top-level export
// -----------------------------------------------------------------------
export async function exportKicadProject(module: Module, libs: KicadLibrarySettings): Promise<void> {
  const sheetUuid = uuid();
  const { main, aux } = assignComponents(module);
  const projectName = module.name.replace(/[^a-zA-Z0-9-]/g, "_");

  // Collect all nets the export pre-wires. Power rails first, then one
  // per main component signal, then one per LED signal.
  const nets: string[] = ["GND"];
  const seen = new Set(nets);
  const addNet = (n: string) => {
    if (!seen.has(n)) {
      seen.add(n);
      nets.push(n);
    }
  };
  if (main.some((a) => a.comp.kind === "pot")) addNet("+3V3");
  addNet("+12V");
  addNet("-12V");
  for (const a of main) addNet(a.signalNet);
  for (const a of aux) if (a.kind === "led") addNet(a.signalNet);
  const netMap = new Map<string, number>();
  nets.forEach((n, i) => netMap.set(n, i + 1));

  // Board outline: fit all PCB footprints (main + aux) with margin
  const boardItems: string[] = [];
  const allPcb = [...main, ...aux];
  if (allPcb.length > 0) {
    const xs = allPcb.map((a) => a.pcbX);
    const ys = allPcb.map((a) => a.pcbY);
    const minX = Math.min(...xs) - PCB_MARGIN;
    const maxX = Math.max(...xs) + PCB_MARGIN;
    const minY = Math.min(...ys) - PCB_MARGIN;
    const maxY = Math.max(...ys) + 10 + PCB_MARGIN;
    boardItems.push(
      [
        `  (gr_rect`,
        `    (start ${f(minX)} ${f(minY)})`,
        `    (end ${f(maxX)} ${f(maxY)})`,
        `    (stroke (width 0.05) (type default))`,
        `    (fill none)`,
        `    (layer "Edge.Cuts")`,
        `    (uuid "${uuid()}")`,
        `  )`,
      ].join("\n"),
    );
  }
  const footprintItems = [
    ...main.map((a) => mainPcbFootprint(a, netMap, libs)),
    ...aux.map((a) => auxPcbFootprint(a, netMap, libs)),
  ];
  const pcb = buildKicadPcbFile([...boardItems, ...footprintItems], nets);

  const sch = buildSchematicFile(module, main, aux, projectName, sheetUuid, libs);
  const pro = buildProjectFile(`${projectName}.kicad_pro`, sheetUuid);

  const zip = new JSZip();
  const folder = zip.folder(projectName)!;
  folder.file(`${projectName}.kicad_pro`, pro);
  folder.file(`${projectName}.kicad_sch`, sch);
  folder.file(`${projectName}.kicad_pcb`, pcb);
  const blob = await zip.generateAsync({ type: "blob" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName}-kicad-project.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
