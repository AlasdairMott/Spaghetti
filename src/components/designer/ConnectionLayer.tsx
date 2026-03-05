import { useAppStore } from "../../store";
import type { Connection } from "../../models/types";

const ARROW_HEIGHT = 1.5; // mm, length of arrowhead triangle
const ARROW_WIDTH = 0.75; // mm, half-width of arrowhead base
const ARROW_GAP = 0.8; // mm, gap between line end and arrowhead base

function ConnectionLine({
  conn,
  isSelected,
}: {
  conn: Connection;
  isSelected: boolean;
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
      <line
        x1={x1}
        y1={y1}
        x2={lineEndX}
        y2={lineEndY}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
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
          style={{ userSelect: "none", fontFamily: "Pomegranate Grotesque" }}
        >
          {conn.label}
        </text>
      )}
    </g>
  );
}

export function ConnectionLayer() {
  const connections = useAppStore((s) => s.editingModule?.connections ?? []);
  const selectedConnectionId = useAppStore((s) => s.selectedConnectionId);

  return (
    <g>
      {connections.map((conn) => (
        <ConnectionLine
          key={conn.id}
          conn={conn}
          isSelected={conn.id === selectedConnectionId}
        />
      ))}
    </g>
  );
}
