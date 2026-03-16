/** Position in grid units (integers). Multiply by GRID_X/GRID_Y for mm. */
export interface GridPosition {
  gridX: number;
  gridY: number;
}

export type ComponentKind = "jack" | "pot" | "button";

export type LabelColor = "yellow" | "blue" | "red" | "green" | "custom";

export interface PanelComponent {
  id: string;
  kind: ComponentKind;
  position: GridPosition;
  label: string;
  /** Unique reference for audio code params (e.g. "pitch", "cutoff") */
  ref?: string;
  description?: string;
  rotation: 0 | 90 | 180 | 270;
  /** Show an LED to the left of a jack */
  hasLed?: boolean;
  /** Color dot next to the label */
  labelColor?: LabelColor | null;
  /** Hex color when labelColor is "custom" */
  labelColorCustom?: string;
  /** Number of LEDs above a button (only for kind="button") */
  buttonLedCount?: 0 | 1 | 2 | 3;
  /** Jack direction: input, output, both, or headphones (only for kind="jack") */
  jackDirection?: "input" | "output" | "both" | "headphones";
  /** Minimum voltage in volts (only for kind="jack", default -10) */
  voltageMin?: number;
  /** Maximum voltage in volts (only for kind="jack", default 10) */
  voltageMax?: number;
}

export type ConnectionKind = "line" | "arrow";

export interface MmPoint {
  x: number;
  y: number;
}

export interface Connection {
  id: string;
  kind: ConnectionKind;
  from: MmPoint;
  to: MmPoint;
  label?: string;
  /** Inset from the start point along the line direction (mm) */
  startOffset?: number;
  /** Inset from the end point along the line direction (mm) */
  endOffset?: number;
}

export interface Module {
  id: string;
  name: string;
  widthHP: number;
  components: PanelComponent[];
  connections: Connection[];
  /** User-written audio processing code (JavaScript) */
  code?: string;
}

export interface RackPlacement {
  id: string;
  moduleId: string;
  positionHP: number;
  row: number;
}

export interface RackWireEndpoint {
  placementId: string;
  componentId: string;
}

export interface RackWire {
  id: string;
  color: string;
  from: RackWireEndpoint;
  to: RackWireEndpoint;
}

export interface KnobState {
  placementId: string;
  componentId: string;
  angle: number; // 0-300 degrees
}

export interface ButtonState {
  placementId: string;
  componentId: string;
  pressed: boolean;
}

export interface Rack {
  id: string;
  name: string;
  widthHP: number;
  rows: number;
  placements: RackPlacement[];
  wires: RackWire[];
  knobStates: KnobState[];
  buttonStates: ButtonState[];
}

export type Tool =
  | "select"
  | "addJack"
  | "addPot"
  | "addButton"
  | "addLine"
  | "addArrow";
export interface CanvasPlacement {
  id: string;
  moduleId: string;
  /** X position in mm (free-form, not grid-locked) */
  x: number;
  /** Y position in mm (free-form, not grid-locked) */
  y: number;
}

export interface Canvas {
  id: string;
  name: string;
  placements: CanvasPlacement[];
  wires: RackWire[];
  knobStates: KnobState[];
  buttonStates: ButtonState[];
}

export type AppMode = "designer" | "canvas" | "rack";
export type RenderMode = "wireframe" | "rendered";
