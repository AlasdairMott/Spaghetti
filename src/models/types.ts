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
  rotation: 0 | 90 | 180 | 270;
  /** Show an LED to the left of a jack */
  hasLed?: boolean;
  /** Color dot next to the label */
  labelColor?: LabelColor | null;
  /** Hex color when labelColor is "custom" */
  labelColorCustom?: string;
  /** Number of LEDs above a button (only for kind="button") */
  buttonLedCount?: 0 | 1 | 2 | 3;
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
}

export interface RackPlacement {
  id: string;
  moduleId: string;
  positionHP: number;
  row: number;
}

export interface Rack {
  id: string;
  name: string;
  widthHP: number;
  rows: number;
  placements: RackPlacement[];
}

export type Tool = "select" | "addJack" | "addPot" | "addButton" | "addLine" | "addArrow";
export type AppMode = "designer" | "rack";
export type RenderMode = "wireframe" | "rendered";
