import { gridToMm } from "./grid";
import {
  HP_WIDTH,
  PANEL_HEIGHT,
  GRID_X,
  GRID_Y,
  GRID_Y_OFFSET,
} from "../constants/grid";
import { computeButtonLayout, resolveLabelLayout } from "./buttonLayout";
import type { Connection, Module, PanelComponent } from "../models/types";

const ARROW_HEIGHT = 1.5;
const ARROW_WIDTH = 0.75;
const ARROW_GAP = 0.8;
const PANEL_EDGE_INSET = 2; // matches PanelBackground EDGE_INSET

const JACK_HOLE_DIAMETER = 6.2;
const POT_HOLE_DIAMETER = 7.5;
const BUTTON_HOLE_DIAMETER = 5.2;
const LED_HOLE_DIAMETER = 3.4;
const MOUNTING_HOLE_DIAMETER = 3.2;

const LABEL_FONT_SIZE = 2.5;
const MODULE_NAME_FONT_SIZE = 3.2;

export function f(n: number): string {
  return n.toFixed(4);
}

/**
 * Compute every LED position (mm) on the panel for a module. Used by both
 * the panel export (to drill NPTH holes) and the project export (to place
 * LED footprints) so the two always agree on where LEDs go.
 *
 * Sources of LEDs:
 *   • Jack `hasLed` → single LED 6.35mm to the left of the jack
 *   • Button `buttonLedCount` → one or more LEDs from computeButtonLayout
 */
export function panelLedPositions(module: Module): { x: number; y: number; label: string }[] {
  const out: { x: number; y: number; label: string }[] = [];
  for (const comp of module.components) {
    const pos = gridToMm(comp.position);
    if (comp.kind === "jack" && comp.hasLed) {
      out.push({ x: pos.x - 6.35, y: pos.y, label: comp.label });
    } else if (comp.kind === "button") {
      const count = comp.buttonLedCount ?? 0;
      if (!count) continue;
      const layout = computeButtonLayout(count, comp.buttonLedPosition ?? "above");
      for (const led of layout.ledPositions) {
        out.push({ x: pos.x + led.x, y: pos.y + led.y, label: comp.label });
      }
    }
  }
  return out;
}

export function uuid(): string {
  return crypto.randomUUID();
}

function npthPad(x: number, y: number, diameter: number): string {
  const d = f(diameter);
  return [
    `  (footprint ""`,
    `    (layer "F.Cu")`,
    `    (at ${f(x)} ${f(y)})`,
    `    (uuid "${uuid()}")`,
    `    (pad "" np_thru_hole circle`,
    `      (at 0 0)`,
    `      (size ${d} ${d})`,
    `      (drill ${d})`,
    `      (layers "F.Cu" "B.Cu")`,
    `      (uuid "${uuid()}")`,
    `    )`,
    `  )`,
  ].join("\n");
}

function npthSlot(x: number, y: number, width: number, height: number): string {
  const w = f(width);
  const h = f(height);
  return [
    `  (footprint ""`,
    `    (layer "F.Cu")`,
    `    (at ${f(x)} ${f(y)})`,
    `    (uuid "${uuid()}")`,
    `    (pad "" np_thru_hole oval`,
    `      (at 0 0)`,
    `      (size ${w} ${h})`,
    `      (drill oval ${w} ${h})`,
    `      (layers "F.Cu" "B.Cu")`,
    `      (uuid "${uuid()}")`,
    `    )`,
    `  )`,
  ].join("\n");
}

function silkLine(x1: number, y1: number, x2: number, y2: number): string {
  return [
    `  (gr_line`,
    `    (start ${f(x1)} ${f(y1)})`,
    `    (end ${f(x2)} ${f(y2)})`,
    `    (stroke (width 0.2) (type default))`,
    `    (layer "F.SilkS")`,
    `    (uuid "${uuid()}")`,
    `  )`,
  ].join("\n");
}

function silkPoly(points: [number, number][]): string {
  const pts = points.map(([x, y]) => `      (xy ${f(x)} ${f(y)})`).join("\n");
  return [
    `  (gr_poly`,
    `    (pts`,
    pts,
    `    )`,
    `    (stroke (width 0) (type solid))`,
    `    (fill solid)`,
    `    (layer "F.SilkS")`,
    `    (uuid "${uuid()}")`,
    `  )`,
  ].join("\n");
}

function connectionItems(conn: Connection): string[] {
  const dx = conn.to.x - conn.from.x;
  const dy = conn.to.y - conn.from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [];
  const ux = dx / len;
  const uy = dy / len;

  const x1 = conn.from.x + ux * (conn.startOffset ?? 0);
  const y1 = conn.from.y + uy * (conn.startOffset ?? 0);
  const x2 = conn.to.x - ux * (conn.endOffset ?? 0);
  const y2 = conn.to.y - uy * (conn.endOffset ?? 0);

  const isArrow = conn.kind === "arrow";
  const lineEndX = isArrow ? x2 - ux * (ARROW_HEIGHT + ARROW_GAP) : x2;
  const lineEndY = isArrow ? y2 - uy * (ARROW_HEIGHT + ARROW_GAP) : y2;

  const items: string[] = [silkLine(x1, y1, lineEndX, lineEndY)];

  if (isArrow) {
    const baseX = x2 - ux * ARROW_HEIGHT;
    const baseY = y2 - uy * ARROW_HEIGHT;
    const perpX = -uy * ARROW_WIDTH;
    const perpY = ux * ARROW_WIDTH;
    items.push(
      silkPoly([
        [x2, y2],
        [baseX + perpX, baseY + perpY],
        [baseX - perpX, baseY - perpY],
      ]),
    );
  }

  if (conn.label) {
    const midX = (x1 + lineEndX) / 2 + -uy * 2;
    const midY = (y1 + lineEndY) / 2 + ux * 2;
    items.push(silkText(conn.label, midX, midY, LABEL_FONT_SIZE));
  }

  return items;
}

/**
 * Push a label silkscreen for a component, honoring labelPosition / labelAngle.
 * If labelPosition is unset, the label is placed at fallbackY (centered, no rotation).
 */
function pushLabel(
  out: string[],
  comp: PanelComponent,
  cx: number,
  cy: number,
  fallbackY: number,
) {
  if (!comp.label) return;
  // KiCad rotates CCW for positive angles; SVG/our model rotates CW. Negate.
  if (!comp.labelPosition) {
    out.push(
      silkText(
        comp.label,
        cx,
        fallbackY,
        LABEL_FONT_SIZE,
        -(comp.labelAngle ?? 0),
      ),
    );
    return;
  }
  const layout = resolveLabelLayout(comp, 5);
  const justify =
    layout.textAnchor === "start"
      ? "left"
      : layout.textAnchor === "end"
        ? "right"
        : null;
  out.push(
    silkText(
      comp.label,
      cx + layout.x,
      cy + layout.y,
      LABEL_FONT_SIZE,
      -layout.rotation,
      justify,
    ),
  );
}

function silkText(
  text: string,
  x: number,
  y: number,
  size: number,
  angle: number = 0,
  justify: "left" | "right" | null = null,
): string {
  const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const justifyLine = justify ? `      (justify ${justify})\n` : "";
  return [
    `  (gr_text "${escaped}"`,
    `    (at ${f(x)} ${f(y)} ${f(angle)})`,
    `    (layer "F.SilkS")`,
    `    (uuid "${uuid()}")`,
    `    (effects`,
    `      (font`,
    `	       (face "PP NeueBit")`,
    `        (size ${f(size)} ${f(size)})`,
    `        (thickness 0.15)`,
    `      )`,
    justifyLine.length > 0 ? justifyLine.trimEnd() : null,
    `    )`,
    `  )`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

const LAYERS = `  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (32 "B.Adhes" user "B.Adhesive")
    (33 "F.Adhes" user "F.Adhesive")
    (34 "B.Paste" user)
    (35 "F.Paste" user)
    (36 "B.SilkS" user "B.Silkscreen")
    (37 "F.SilkS" user "F.Silkscreen")
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (40 "Dwgs.User" user "User.Drawings")
    (41 "Cmts.User" user "User.Comments")
    (42 "Eco1.User" user "User.Eco1")
    (43 "Eco2.User" user "User.Eco2")
    (44 "Edge.Cuts" user)
    (45 "Margin" user)
    (46 "B.CrtYd" user "B.Courtyard")
    (47 "F.CrtYd" user "F.Courtyard")
    (48 "B.Fab" user)
    (49 "F.Fab" user)
    (50 "User.1" user)
    (51 "User.2" user)
    (52 "User.3" user)
    (53 "User.4" user)
    (54 "User.5" user)
    (55 "User.6" user)
    (56 "User.7" user)
    (57 "User.8" user)
    (58 "User.9" user)
  )`;

const GRID_ORIGIN_X = GRID_X / 2;
const GRID_ORIGIN_Y = GRID_Y_OFFSET + GRID_Y / 2;

const SETUP = `  (setup
    (grid_origin ${f(GRID_ORIGIN_X)} ${f(GRID_ORIGIN_Y)})
    (pad_to_mask_clearance 0)
    (allow_soldermask_bridges_in_footprints no)
    (pcbplotparams
      (layerselection 0x00010fc_ffffffff)
      (plot_on_all_layers_selection 0x0000000_00000000)
      (disableapertmacros no)
      (usegerberextensions no)
      (usegerberattributes yes)
      (usegerberadvancedattributes yes)
      (creategerberjobfile yes)
      (dashed_line_dash_ratio 12.000000)
      (dashed_line_gap_ratio 3.000000)
      (svgprecision 4)
      (plotframeref no)
      (viasonmask no)
      (mode 1)
      (useauxorigin no)
      (hpglpennumber 1)
      (hpglpenspeed 20)
      (hpglpendiameter 15.000000)
      (pdf_front_fp_property_popups yes)
      (pdf_back_fp_property_popups yes)
      (dxfpolygonmode yes)
      (dxfimperialunits yes)
      (dxfusepcbnewfont yes)
      (psnegative no)
      (psa4output no)
      (plotreference yes)
      (plotvalue yes)
      (plotfptext yes)
      (plotinvisibletext no)
      (sketchpadsonfab no)
      (subtractmaskfromsilk no)
      (outputformat 1)
      (mirror no)
      (drillshape 1)
      (scaleselection 1)
      (outputdirectory "")
    )
  )`;

/**
 * Build the list of items (silkscreen, edge cuts, NPTH pads) that make up
 * the panel portion of a .kicad_pcb. Used both by the panel-only export
 * and the full-project export (which appends component footprints).
 */
export function buildPanelItems(module: Module): string[] {
  const panelWidth = module.widthHP * HP_WIDTH;
  const panelHeight = PANEL_HEIGHT;

  const items: string[] = [];

  // Panel outline on Edge.Cuts — inset 0.15mm each side for inter-module clearance
  const inset = 0.15;
  items.push(
    [
      `  (gr_rect`,
      `    (start ${f(inset)} 0)`,
      `    (end ${f(panelWidth - inset)} ${f(panelHeight)})`,
      `    (stroke (width 0.05) (type default))`,
      `    (fill none)`,
      `    (layer "Edge.Cuts")`,
      `    (uuid "${uuid()}")`,
      `  )`,
    ].join("\n"),
  );

  // Mounting holes — left side always, right side if panel wide enough
  const mountY1 = 3.0;
  const mountY2 = panelHeight - 3.0;
  const mountXL = 7.5;
  const mountXR = panelWidth - 7.5;
  items.push(npthSlot(mountXL, mountY1, 5.0, MOUNTING_HOLE_DIAMETER));
  items.push(npthSlot(mountXL, mountY2, 5.0, MOUNTING_HOLE_DIAMETER));
  if (mountXR - mountXL > 5) {
    items.push(npthSlot(mountXR, mountY1, 5.0, MOUNTING_HOLE_DIAMETER));
    items.push(npthSlot(mountXR, mountY2, 5.0, MOUNTING_HOLE_DIAMETER));
  }

  // Module name (centred at top, matching PanelCanvas)
  const capitalized = module.name
    .split(/[-_ ]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  items.push(
    silkText(capitalized, panelWidth / 2, 4.35, MODULE_NAME_FONT_SIZE),
  );

  // Top and bottom panel lines (matching PanelBackground)
  const topLineY = GRID_Y_OFFSET + GRID_Y * 0.75;
  const bottomRowCount = Math.floor((PANEL_HEIGHT - GRID_Y_OFFSET) / GRID_Y);
  const bottomLineY = GRID_Y_OFFSET + bottomRowCount * GRID_Y - GRID_Y * 0.75;
  items.push(
    silkLine(
      PANEL_EDGE_INSET,
      topLineY,
      panelWidth - PANEL_EDGE_INSET,
      topLineY,
    ),
  );
  items.push(
    silkLine(
      PANEL_EDGE_INSET,
      bottomLineY,
      panelWidth - PANEL_EDGE_INSET,
      bottomLineY,
    ),
  );

  // Connection lines and arrows
  for (const conn of module.connections) {
    items.push(...connectionItems(conn));
  }

  // Rectangles
  for (const rect of module.rects ?? []) {
    const x1 = Math.min(rect.from.x, rect.to.x);
    const y1 = Math.min(rect.from.y, rect.to.y);
    const x2 = Math.max(rect.from.x, rect.to.x);
    const y2 = Math.max(rect.from.y, rect.to.y);
    const so = rect.shadowOffset ?? 0;
    const strokeType = rect.dotted ? "dot" : "default";

    if (so > 0) {
      // Right bar
      items.push(
        [
          `  (gr_rect (start ${f(x2)} ${f(y1 + so)}) (end ${f(x2 + so)} ${f(y2 + so)})`,
          `    (stroke (width 0) (type solid)) (fill solid) (layer "F.SilkS") (uuid "${uuid()}"))`,
        ].join("\n"),
      );
      // Bottom bar
      items.push(
        [
          `  (gr_rect (start ${f(x1 + so)} ${f(y2)}) (end ${f(x2 + so)} ${f(y2 + so)})`,
          `    (stroke (width 0) (type solid)) (fill solid) (layer "F.SilkS") (uuid "${uuid()}"))`,
        ].join("\n"),
      );
    }

    items.push(
      [
        `  (gr_rect (start ${f(x1)} ${f(y1)}) (end ${f(x2)} ${f(y2)})`,
        `    (stroke (width 0.2) (type ${strokeType})) (fill none) (layer "F.SilkS") (uuid "${uuid()}"))`,
      ].join("\n"),
    );
  }

  // Components
  for (const comp of module.components) {
    const pos = gridToMm(comp.position);

    if (comp.kind === "jack") {
      items.push(npthPad(pos.x, pos.y, JACK_HOLE_DIAMETER));
      pushLabel(items, comp, pos.x, pos.y, pos.y - 5 - 0.8);
    } else if (comp.kind === "pot") {
      items.push(npthPad(pos.x, pos.y, POT_HOLE_DIAMETER));
      pushLabel(items, comp, pos.x, pos.y, pos.y - 8 - 0.8);
    } else if (comp.kind === "button") {
      const buttonLeds = comp.buttonLedCount ?? 0;
      const ledPos = comp.buttonLedPosition ?? "above";
      const layout = computeButtonLayout(buttonLeds, ledPos);
      const buttonCx = pos.x + layout.buttonOffset.x;
      const buttonCy = pos.y + layout.buttonOffset.y;
      items.push(npthPad(buttonCx, buttonCy, BUTTON_HOLE_DIAMETER));
      // Default label fallback Y depends on whether the button is shifted down for LEDs above
      const fallbackY = layout.buttonOffset.y > 0 ? buttonCy + 5 : buttonCy - 5;
      pushLabel(items, comp, buttonCx, buttonCy, fallbackY);
    }
  }

  // LED holes — use the shared panel LED position list so panel and project
  // exports always agree on where LEDs go.
  for (const { x, y } of panelLedPositions(module)) {
    items.push(npthPad(x, y, LED_HOLE_DIAMETER));
  }

  return items;
}

/**
 * Wrap a list of PCB body items into a full .kicad_pcb file. Accepts
 * optional extra nets (the panel-only export has none; the project
 * export lists the nets inferred from component refs).
 */
export function buildKicadPcbFile(
  items: string[],
  nets: string[] = [],
): string {
  const netLines = [
    `  (net 0 "")`,
    ...nets.map((name, i) => `  (net ${i + 1} "${name}")`),
  ];
  return [
    `(kicad_pcb`,
    `  (version 20241229)`,
    `  (generator "pcbnew")`,
    `  (generator_version "9.0")`,
    `  (general`,
    `    (thickness 1.6)`,
    `    (legacy_teardrops no)`,
    `  )`,
    `  (paper "A4")`,
    LAYERS,
    SETUP,
    ...netLines,
    ``,
    ...items,
    `)`,
  ].join("\n");
}

export function exportPanelKicad(module: Module): void {
  const kicad = buildKicadPcbFile(buildPanelItems(module));
  const blob = new Blob([kicad], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${module.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-panel.kicad_pcb`;
  a.click();
  URL.revokeObjectURL(url);
}
