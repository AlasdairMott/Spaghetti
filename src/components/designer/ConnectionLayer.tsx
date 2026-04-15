import { useRef, useCallback } from "react";
import { useAppStore } from "../../store";
import { screenToSvg } from "../../utils/svg";
import { snapToQuarterGrid } from "../../utils/grid";
import { GRID_X, GRID_Y } from "../../constants/grid";
import type { Connection } from "../../models/types";

const ARROW_HEIGHT = 1.5; // mm, length of arrowhead triangle
const ARROW_WIDTH = 0.75; // mm, half-width of arrowhead base
const ARROW_GAP = 0.8; // mm, gap between line end and arrowhead base

function ConnectionLine({
  conn,
  isSelected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  conn: Connection;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent<SVGElement>, connId: string) => void;
  onPointerMove: (e: React.PointerEvent<SVGElement>) => void;
  onPointerUp: () => void;
}) {
  const renderMode = useAppStore((s) => s.renderMode);
  const stroke = isSelected
    ? "#4af"
    : renderMode === "rendered"
      ? "#231F20"
      : "#aaa";
  const strokeWidth = isSelected ? 0.5 : 0.2;

  const dx = conn.to.x - conn.from.x;
  const dy = conn.to.y - conn.from.y;
  const len = Math.hypot(dx, dy);
  const ux = len > 0 ? dx / len : 0;
  const uy = len > 0 ? dy / len : 0;

  // Apply start/end offsets along the line direction
  const so = conn.startOffset ?? 0;
  const eo = conn.endOffset ?? 0;
  const x1 = conn.from.x + ux * so;
  const y1 = conn.from.y + uy * so;
  const x2 = conn.to.x - ux * eo;
  const y2 = conn.to.y - uy * eo;

  const isArrow = conn.kind === "arrow";

  // For arrows: line stops short, arrowhead drawn separately with a gap
  const lineEndX = isArrow ? x2 - ux * (ARROW_HEIGHT + ARROW_GAP) : x2;
  const lineEndY = isArrow ? y2 - uy * (ARROW_HEIGHT + ARROW_GAP) : y2;

  // Arrowhead triangle points (tip at end, base perpendicular)
  const tipX = x2;
  const tipY = y2;
  const baseX = x2 - ux * ARROW_HEIGHT;
  const baseY = y2 - uy * ARROW_HEIGHT;
  // Perpendicular for base corners
  const perpX = -uy * ARROW_WIDTH;
  const perpY = ux * ARROW_WIDTH;

  // Label positioning: midpoint of visible line, offset perpendicular
  const midX = (x1 + lineEndX) / 2;
  const midY = (y1 + lineEndY) / 2;
  const labelPerpX = len > 0 ? -uy * 2 : 2;
  const labelPerpY = len > 0 ? ux * 2 : 0;

  return (
    <g>
      {/* Fat invisible hit area for click/drag */}
      <line
        x1={x1}
        y1={y1}
        x2={lineEndX}
        y2={lineEndY}
        stroke="transparent"
        strokeWidth={3}
        strokeLinecap="round"
        style={{ cursor: "pointer" }}
        pointerEvents="stroke"
        onPointerDown={(e) => onPointerDown(e, conn.id)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <line
        x1={x1}
        y1={y1}
        x2={lineEndX}
        y2={lineEndY}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pointerEvents="none"
      />
      {isArrow && (
        <polygon
          points={`${tipX},${tipY} ${baseX + perpX},${baseY + perpY} ${baseX - perpX},${baseY - perpY}`}
          fill={stroke}
        />
      )}
      {conn.label && (
        <text
          x={midX + labelPerpX}
          y={midY + labelPerpY}
          textAnchor="middle"
          dominantBaseline="central"
          fill={stroke}
          fontSize={2.5}
          style={{ userSelect: "none", fontFamily: "Plus Jakarta Sans" }}
        >
          {conn.label}
        </text>
      )}
    </g>
  );
}

export function ConnectionLayer({ svgRef }: { svgRef: React.RefObject<SVGSVGElement | null> }) {
  const connections = useAppStore((s) => s.editingModule?.connections ?? []);
  const selectedConnectionId = useAppStore((s) => s.selectedConnectionId);
  const selectedConnectionIds = useAppStore((s) => s.selectedConnectionIds);
  const selectConnection = useAppStore((s) => s.selectConnection);
  const selectItems = useAppStore((s) => s.selectItems);
  const moveConnectionsByDelta = useAppStore((s) => s.moveConnectionsByDelta);
  const moveComponentsByDelta = useAppStore((s) => s.moveComponentsByDelta);
  const moveRectsByDelta = useAppStore((s) => s.moveRectsByDelta);
  const pushSnapshot = useAppStore((s) => s.pushSnapshot);
  const activeTool = useAppStore((s) => s.activeTool);

  const dragging = useRef(false);
  const lastMm = useRef({ x: 0, y: 0 });
  const didMove = useRef(false);
  const downId = useRef<string | null>(null);
  const downShift = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGElement>, connId: string) => {
    if (activeTool !== "select" || e.button !== 0 || !svgRef.current) return;
    e.stopPropagation();

    const s = useAppStore.getState();
    const isInSelection = s.selectedConnectionIds.includes(connId);
    const totalSelected = s.selectedComponentIds.length + s.selectedConnectionIds.length + s.selectedRectIds.length;

    downId.current = connId;
    downShift.current = e.shiftKey;
    didMove.current = false;

    if (e.shiftKey) {
      const connIds = isInSelection
        ? s.selectedConnectionIds.filter((id) => id !== connId)
        : [...s.selectedConnectionIds, connId];
      selectItems(s.selectedComponentIds, connIds, s.selectedRectIds);
    } else if (!isInSelection || totalSelected <= 1) {
      selectConnection(connId);
    }
    // If already in multi-selection, don't change selection — just start drag

    pushSnapshot();
    dragging.current = true;
    const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
    lastMm.current = snapToQuarterGrid(pt.x, pt.y);
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }, [activeTool, svgRef, selectConnection, selectItems, pushSnapshot]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGElement>) => {
    if (!dragging.current || !svgRef.current) return;
    const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
    const snapped = snapToQuarterGrid(pt.x, pt.y);
    const dxMm = snapped.x - lastMm.current.x;
    const dyMm = snapped.y - lastMm.current.y;
    if (dxMm === 0 && dyMm === 0) return;
    didMove.current = true;
    lastMm.current = snapped;

    const s = useAppStore.getState();
    if (s.selectedConnectionIds.length > 0) moveConnectionsByDelta(s.selectedConnectionIds, dxMm, dyMm);
    if (s.selectedComponentIds.length > 0) {
      moveComponentsByDelta(s.selectedComponentIds, Math.round(dxMm / GRID_X), Math.round(dyMm / GRID_Y));
    }
    if (s.selectedRectIds.length > 0) moveRectsByDelta(s.selectedRectIds, dxMm, dyMm);
  }, [svgRef, moveConnectionsByDelta, moveComponentsByDelta, moveRectsByDelta]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    downId.current = null;
  }, []);

  return (
    <g>
      {connections.map((conn) => (
        <ConnectionLine
          key={conn.id}
          conn={conn}
          isSelected={conn.id === selectedConnectionId || selectedConnectionIds.includes(conn.id)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      ))}
    </g>
  );
}
