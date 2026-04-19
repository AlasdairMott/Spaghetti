// Loudest Warning format grid constants (all dimensions in mm)

/** Horizontal grid pitch in mm */
export const GRID_X = 12.7;

/** Vertical grid pitch in mm */
export const GRID_Y = 9.5;

/** Panel height in mm (4U) */
export const PANEL_HEIGHT = 175;

/** Width of 1 HP in mm (standard Eurorack) */
export const HP_WIDTH = 5.08;

/** Number of grid columns per HP (5.08 / 1.27 = 4) */
export const GRID_COLS_PER_HP = 4;

/** Tolerance on each side of the panel in mm */
export const PANEL_SIDE_TOLERANCE = 0.1;

/** Vertical offset of the grid origin from the top of the panel in mm */
export const GRID_Y_OFFSET = 2.0;

/** Inset from panel edge for top/bottom decorative lines (mm) */
export const EDGE_INSET = 2;

/** Y position of top decorative line (mm) */
export const TOP_LINE_Y = GRID_Y_OFFSET + GRID_Y * 0.75;

/** Y position of bottom decorative line (mm) */
const bottomRowCount = Math.floor((PANEL_HEIGHT - GRID_Y_OFFSET) / GRID_Y);
export const BOTTOM_LINE_Y = GRID_Y_OFFSET + bottomRowCount * GRID_Y - GRID_Y * 0.75;

/** Component hit-test radius in mm (for selection) */
export const HIT_RADIUS = 2.5;
