import { memo } from "react";
import { useAppStore } from "../../store";
import { gridToMm } from "../../utils/grid";
import { HP_WIDTH, PANEL_HEIGHT } from "../../constants/grid";
import type { RackWire, RackWireEndpoint, RackPlacement, Module } from "../../models/types";

const EMPTY_WIRES: RackWire[] = [];
const RAIL_HEIGHT = 3;
const ROW_GAP = 5;
const ROW_HEIGHT = PANEL_HEIGHT + RAIL_HEIGHT * 2 + ROW_GAP;

/** Resolve a wire endpoint to absolute SVG mm coordinates */
function resolveEndpoint(
  endpoint: RackWireEndpoint,
  placements: RackPlacement[],
  modules: Module[],
  dragOverride?: RackDragOverride | null,
): { x: number; y: number } | null {
  const placement = placements.find((p) => p.id === endpoint.placementId);
  if (!placement) return null;
  const mod = modules.find((m) => m.id === placement.moduleId);
  if (!mod) return null;
  const comp = mod.components.find((c) => c.id === endpoint.componentId);
  if (!comp) return null;
  const mm = gridToMm(comp.position);
  const posHP = (dragOverride?.placementId === endpoint.placementId)
    ? dragOverride.positionHP
    : placement.positionHP;
  const row = (dragOverride?.placementId === endpoint.placementId)
    ? dragOverride.row
    : placement.row;
  const modX = posHP * HP_WIDTH;
  const rowY = row * ROW_HEIGHT + RAIL_HEIGHT;
  return { x: modX + mm.x, y: rowY + mm.y };
}

/** Generate a catenary-like quadratic bezier path between two points */
function catenaryPath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const dist = Math.hypot(Math.abs(x2 - x1), Math.abs(y2 - y1));
  const sag = Math.max(15, dist * 0.3);
  const midX = (x1 + x2) / 2;
  const midY = Math.max(y1, y2) + sag;
  return `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
}

/** Sample points along a quadratic bezier for hit testing */
function sampleQuadBezier(
  x1: number, y1: number,
  cx: number, cy: number,
  x2: number, y2: number,
  n: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
      y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
    });
  }
  return pts;
}

/** Check if a point is near the wire curve (for hit testing in event handlers) */
export function hitTestWire(
  wire: RackWire,
  clickX: number,
  clickY: number,
  threshold: number,
  state: { rack: { placements: RackPlacement[] }; modules: Module[] },
): boolean {
  const from = resolveEndpoint(wire.from, state.rack.placements, state.modules);
  const to = resolveEndpoint(wire.to, state.rack.placements, state.modules);
  if (!from || !to) return false;

  const dist = Math.hypot(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  const sag = Math.max(15, dist * 0.3);
  const midX = (from.x + to.x) / 2;
  const midY = Math.max(from.y, to.y) + sag;

  const pts = sampleQuadBezier(from.x, from.y, midX, midY, to.x, to.y, 20);
  for (const pt of pts) {
    if (Math.hypot(clickX - pt.x, clickY - pt.y) < threshold) return true;
  }
  return false;
}

interface WireLineProps {
  wire: RackWire;
  isSelected: boolean;
  placements: RackPlacement[];
  modules: Module[];
  onClick: (wireId: string, shiftKey: boolean) => void;
  dragOverride?: RackDragOverride | null;
}

const WireLine = memo(function WireLine({ wire, isSelected, placements, modules, onClick, dragOverride }: WireLineProps) {
  const from = resolveEndpoint(wire.from, placements, modules, dragOverride);
  const to = resolveEndpoint(wire.to, placements, modules, dragOverride);
  if (!from || !to) return null;

  const path = catenaryPath(from.x, from.y, to.x, to.y);

  return (
    <g>
      {isSelected && (
        <path
          d={path}
          fill="none"
          stroke="#fff"
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.3}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={wire.color}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.85}
      />
      {/* Invisible fat hit area */}
      <path
        d={path}
        fill="none"
        stroke="rgba(0,0,0,0)"
        strokeWidth={8}
        strokeLinecap="round"
        pointerEvents="stroke"
        style={{ cursor: "pointer" }}
        onClick={(e) => { e.stopPropagation(); onClick(wire.id, e.shiftKey); }}
      />
      <circle cx={from.x} cy={from.y} r={1.8} fill={wire.color} opacity={0.9} />
      <circle cx={to.x} cy={to.y} r={1.8} fill={wire.color} opacity={0.9} />
    </g>
  );
});

interface PreviewWireProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
}

export function PreviewWire({ fromX, fromY, toX, toY, color }: PreviewWireProps) {
  const path = catenaryPath(fromX, fromY, toX, toY);
  return (
    <g pointerEvents="none">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeDasharray="3 2"
        opacity={0.6}
      />
      <circle cx={fromX} cy={fromY} r={1.8} fill={color} opacity={0.6} />
    </g>
  );
}

export interface RackDragOverride {
  placementId: string;
  positionHP: number;
  row: number;
}

export function WireLayer({ dragOverride }: { dragOverride?: RackDragOverride | null }) {
  const wires = useAppStore((s) => s.rack.wires ?? EMPTY_WIRES);
  const placements = useAppStore((s) => s.rack.placements);
  const modules = useAppStore((s) => s.modules);
  const selectedWireIds = useAppStore((s) => s.selectedWireIds);
  const selectWires = useAppStore((s) => s.selectWires);
  const selectPlacements = useAppStore((s) => s.selectPlacements);

  const handleWireClick = (wireId: string, shiftKey: boolean) => {
    // selectPlacements clears selectedWireIds in the store, so call it first
    selectPlacements([]);
    if (shiftKey) {
      if (selectedWireIds.includes(wireId)) {
        selectWires(selectedWireIds.filter((id) => id !== wireId));
      } else {
        selectWires([...selectedWireIds, wireId]);
      }
    } else {
      selectWires([wireId]);
    }
  };

  return (
    <g>
      {wires.map((wire) => {
        // Only pass dragOverride to wires that actually touch the dragged module;
        // other WireLines keep stable props and stay memoised.
        const wireOverride = dragOverride && (
          wire.from.placementId === dragOverride.placementId ||
          wire.to.placementId === dragOverride.placementId
        ) ? dragOverride : null;
        return (
          <WireLine
            key={wire.id}
            wire={wire}
            isSelected={selectedWireIds.includes(wire.id)}
            placements={placements}
            modules={modules}
            onClick={handleWireClick}
            dragOverride={wireOverride}
          />
        );
      })}
    </g>
  );
}
