import { memo } from "react";
import { useAppStore } from "../../store";
import { gridToMm } from "../../utils/grid";
import type { RackWire, RackWireEndpoint, CanvasPlacement, Module } from "../../models/types";

const EMPTY_WIRES: RackWire[] = [];

/** Resolve a wire endpoint to absolute SVG mm coordinates on the canvas */
function resolveEndpoint(
  endpoint: RackWireEndpoint,
  placements: CanvasPlacement[],
  modules: Module[],
  dragOverrides?: CanvasDragOverride[] | null,
): { x: number; y: number } | null {
  const placement = placements.find((p) => p.id === endpoint.placementId);
  if (!placement) return null;
  const mod = modules.find((m) => m.id === placement.moduleId);
  if (!mod) return null;
  const comp = mod.components.find((c) => c.id === endpoint.componentId);
  if (!comp) return null;
  const mm = gridToMm(comp.position);
  const override = dragOverrides?.find((o) => o.placementId === endpoint.placementId);
  const x = override ? override.x : placement.x;
  const y = override ? override.y : placement.y;
  return { x: x + mm.x, y: y + mm.y };
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

interface WireLineProps {
  wire: RackWire;
  isSelected: boolean;
  placements: CanvasPlacement[];
  modules: Module[];
  onClick: (wireId: string, shiftKey: boolean) => void;
  dragOverrides?: CanvasDragOverride[] | null;
}

const WireLine = memo(function WireLine({ wire, isSelected, placements, modules, onClick, dragOverrides }: WireLineProps) {
  const from = resolveEndpoint(wire.from, placements, modules, dragOverrides);
  const to = resolveEndpoint(wire.to, placements, modules, dragOverrides);
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

export function PreviewWire({ fromX, fromY, toX, toY, color }: {
  fromX: number; fromY: number; toX: number; toY: number; color: string;
}) {
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

export { resolveEndpoint as resolveCanvasEndpoint };

export interface CanvasDragOverride {
  placementId: string;
  x: number;
  y: number;
}

export function CanvasWireLayer({ dragOverrides }: { dragOverrides?: CanvasDragOverride[] | null }) {
  const wires = useAppStore((s) => s.canvas.wires ?? EMPTY_WIRES);
  const placements = useAppStore((s) => s.canvas.placements);
  const modules = useAppStore((s) => s.modules);
  const selectedWireIds = useAppStore((s) => s.canvasSelectedWireIds);
  const selectWires = useAppStore((s) => s.canvasSelectWires);
  const selectPlacements = useAppStore((s) => s.canvasSelectPlacements);

  const handleWireClick = (wireId: string, shiftKey: boolean) => {
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

  const draggedIds = dragOverrides ? new Set(dragOverrides.map((o) => o.placementId)) : null;

  return (
    <g>
      {wires.map((wire) => {
        const wireOverrides = draggedIds && (
          draggedIds.has(wire.from.placementId) ||
          draggedIds.has(wire.to.placementId)
        ) ? dragOverrides : null;
        return (
          <WireLine
            key={wire.id}
            wire={wire}
            isSelected={selectedWireIds.includes(wire.id)}
            placements={placements}
            modules={modules}
            onClick={handleWireClick}
            dragOverrides={wireOverrides}
          />
        );
      })}
    </g>
  );
}
