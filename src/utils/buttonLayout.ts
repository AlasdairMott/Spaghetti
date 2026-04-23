import type { PanelComponent } from "../models/types";

export type ButtonLedPosition = "above" | "left" | "right";
export type LabelPosition = "above" | "below" | "left" | "right";

export interface ButtonLayout {
  /** Where to translate the button shape (relative to component origin) */
  buttonOffset: { x: number; y: number };
  /** LED centers (relative to component origin) */
  ledPositions: Array<{ x: number; y: number }>;
}

/**
 * Compute LED positions and button offset for a given LED count + position.
 * Single source of truth used by designer, rack/canvas rendering, SVG export, KiCad export.
 */
export function computeButtonLayout(
  ledCount: number,
  ledPosition: ButtonLedPosition = "above",
): ButtonLayout {
  if (ledCount === 0) {
    return { buttonOffset: { x: 0, y: 0 }, ledPositions: [] };
  }

  if (ledPosition === "above") {
    // Button shifts down to make room for LEDs above
    const buttonY = 2.607;
    const ledY = -3.123;
    const xs =
      ledCount === 1 ? [0] : ledCount === 2 ? [-2, 2] : [-5.08, 0, 5.08];
    return {
      buttonOffset: { x: 0, y: buttonY },
      ledPositions: xs.map((x) => ({ x, y: ledY })),
    };
  }

  // "left" or "right": LEDs stacked vertically beside the button,
  // at the same distance a jack's LED sits from the jack center (half HP = 6.35mm)
  const sign = ledPosition === "right" ? 1 : -1;
  const ledX = 6.35 * sign;
  const ys =
    ledCount === 1 ? [0] : ledCount === 2 ? [-2, 2] : [-3.5, 0, 3.5];
  return {
    buttonOffset: { x: 0, y: 0 },
    ledPositions: ys.map((y) => ({ x: ledX, y })),
  };
}

export interface LabelLayout {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
  rotation: number;
}

/**
 * Default label position for a component when labelPosition isn't explicitly set.
 * Buttons with LEDs above place label below; everything else places label above.
 */
export function defaultLabelPosition(component: PanelComponent): LabelPosition {
  if (component.kind === "button") {
    const ledCount = component.buttonLedCount ?? 0;
    const ledPos = component.buttonLedPosition ?? "above";
    if (ledCount > 0 && ledPos === "above") return "below";
  }
  return "above";
}

/**
 * Compute label layout given position, angle, and the perpendicular distance
 * from the component origin to where the label baseline should sit.
 */
export function computeLabelLayout(
  position: LabelPosition,
  angle: number = 0,
  distance: number = 5,
): LabelLayout {
  switch (position) {
    case "above":
      return { x: 0, y: -distance, textAnchor: "middle", rotation: angle };
    case "below":
      return { x: 0, y: distance, textAnchor: "middle", rotation: angle };
    case "left":
      return { x: -distance, y: 0, textAnchor: "end", rotation: angle };
    case "right":
      return { x: distance, y: 0, textAnchor: "start", rotation: angle };
  }
}

/**
 * Resolve the final label layout for a component, applying defaults from
 * the component itself (labelPosition / labelAngle / button-specific defaults).
 */
export function resolveLabelLayout(
  component: PanelComponent,
  distance: number = 5,
): LabelLayout {
  const pos = component.labelPosition ?? defaultLabelPosition(component);
  const angle = component.labelAngle ?? 0;
  // When LEDs are above the button, the button body shifts down by buttonOffset.y.
  // A "below" label needs extra clearance to sit below the shifted button body.
  let effectiveDist = distance;
  if (
    component.kind === "button" &&
    pos === "below" &&
    (component.buttonLedCount ?? 0) > 0 &&
    (component.buttonLedPosition ?? "above") === "above"
  ) {
    const layout = computeButtonLayout(component.buttonLedCount!, "above");
    effectiveDist = layout.buttonOffset.y + distance;
  }
  return computeLabelLayout(pos, angle, effectiveDist);
}
