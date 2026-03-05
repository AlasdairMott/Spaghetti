import { GRID_X, GRID_Y, GRID_COLS_PER_HP, GRID_Y_OFFSET } from "../constants/grid";
import type { GridPosition } from "../models/types";

/** Snap mm coordinates to the nearest grid position (accounting for vertical offset) */
export function snapToGrid(mmX: number, mmY: number): GridPosition {
  return {
    gridX: Math.round(mmX / GRID_X),
    gridY: Math.round((mmY - GRID_Y_OFFSET) / GRID_Y),
  };
}

/** Convert grid position to mm coordinates (accounting for vertical offset) */
export function gridToMm(pos: GridPosition): { x: number; y: number } {
  return {
    x: pos.gridX * GRID_X,
    y: pos.gridY * GRID_Y + GRID_Y_OFFSET,
  };
}

/** Convert mm coordinates to fractional grid position */
export function mmToGrid(mmX: number, mmY: number): { gridX: number; gridY: number } {
  return {
    gridX: mmX / GRID_X,
    gridY: (mmY - GRID_Y_OFFSET) / GRID_Y,
  };
}

/** Get grid column count for a given HP width */
export function hpToGridColumns(hp: number): number {
  return hp * GRID_COLS_PER_HP;
}

/** Get mm width for a given HP width */
export function hpToMm(hp: number): number {
  return hp * 5.08;
}

/** Clamp a grid position within panel bounds */
export function clampGridPosition(
  pos: GridPosition,
  maxGridX: number,
  maxGridY: number
): GridPosition {
  return {
    gridX: Math.max(0, Math.min(pos.gridX, maxGridX)),
    gridY: Math.max(0, Math.min(pos.gridY, maxGridY)),
  };
}
