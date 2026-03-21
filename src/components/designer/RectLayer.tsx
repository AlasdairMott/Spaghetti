import { useRef, useState } from "react";
import { useAppStore } from "../../store";
import { snapToQuarterGrid } from "../../utils/grid";
import { screenToSvg } from "../../utils/svg";
import type { MmPoint, PanelRect } from "../../models/types";

const EMPTY_RECTS: PanelRect[] = [];
const HANDLE_SIZE = 0.8;

type EdgeKind = "top" | "bottom" | "left" | "right";

interface ResizeHandleProps {
  cx: number;
  cy: number;
  edge: EdgeKind;
  svgRef: React.RefObject<SVGSVGElement | null>;
  rect: PanelRect;
  onDragMove: (from: MmPoint, to: MmPoint) => void;
  onCommit: (from: MmPoint, to: MmPoint) => void;
}

function ResizeHandle({
  cx,
  cy,
  edge,
  svgRef,
  rect,
  onDragMove,
  onCommit,
}: ResizeHandleProps) {
  const dragging = useRef(false);
  const isH = edge === "left" || edge === "right";
  const cursor = isH ? "ew-resize" : "ns-resize";

  const compute = (pt: {
    x: number;
    y: number;
  }): { from: MmPoint; to: MmPoint } => {
    const snapped = snapToQuarterGrid(pt.x, pt.y);
    const x1 = Math.min(rect.from.x, rect.to.x);
    const y1 = Math.min(rect.from.y, rect.to.y);
    const x2 = Math.max(rect.from.x, rect.to.x);
    const y2 = Math.max(rect.from.y, rect.to.y);
    if (edge === "top") {
      return {
        from: { x: x1, y: Math.min(snapped.y, y2 - 0.5) },
        to: { x: x2, y: y2 },
      };
    } else if (edge === "bottom") {
      return {
        from: { x: x1, y: y1 },
        to: { x: x2, y: Math.max(snapped.y, y1 + 0.5) },
      };
    } else if (edge === "left") {
      return {
        from: { x: Math.min(snapped.x, x2 - 0.5), y: y1 },
        to: { x: x2, y: y2 },
      };
    } else {
      return {
        from: { x: x1, y: y1 },
        to: { x: Math.max(snapped.x, x1 + 0.5), y: y2 },
      };
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
  };

  const handlePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (!dragging.current || !svgRef.current) return;
    const { from, to } = compute(
      screenToSvg(svgRef.current, e.clientX, e.clientY),
    );
    onDragMove(from, to);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGRectElement>) => {
    if (!dragging.current || !svgRef.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const { from, to } = compute(
      screenToSvg(svgRef.current, e.clientX, e.clientY),
    );
    onCommit(from, to);
  };

  return (
    <rect
      x={cx - HANDLE_SIZE / 2}
      y={cy - HANDLE_SIZE / 2}
      width={HANDLE_SIZE}
      height={HANDLE_SIZE}
      fill="#4af"
      stroke="none"
      style={{ cursor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}

interface RectItemProps {
  rect: PanelRect;
  isSelected: boolean;
  onClick: (id: string) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

function RectItem({ rect, isSelected, onClick, svgRef }: RectItemProps) {
  const renderMode = useAppStore((s) => s.renderMode);
  const theme = useAppStore((s) => s.theme);
  const updateRect = useAppStore((s) => s.updateRect);

  // Live preview for both resize and move
  const [liveFrom, setLiveFrom] = useState<MmPoint | null>(null);
  const [liveTo, setLiveTo] = useState<MmPoint | null>(null);

  // Move drag tracking
  const moveDrag = useRef<{
    startX: number;
    startY: number;
    origFrom: MmPoint;
    origTo: MmPoint;
  } | null>(null);
  const hasMoved = useRef(false);

  const displayFrom = liveFrom ?? rect.from;
  const displayTo = liveTo ?? rect.to;
  const x1 = Math.min(displayFrom.x, displayTo.x);
  const y1 = Math.min(displayFrom.y, displayTo.y);
  const x2 = Math.max(displayFrom.x, displayTo.x);
  const y2 = Math.max(displayFrom.y, displayTo.y);
  const w = x2 - x1;
  const h = y2 - y1;

  const stroke = isSelected
    ? "#4af"
    : renderMode === "rendered"
      ? "#231F20"
      : theme === "light"
        ? "#555"
        : "#aaa";

  const shadowFill =
    renderMode === "rendered" ? "#231F20" : theme === "light" ? "#555" : "#aaa";

  const so = rect.shadowOffset ?? 0;

  // Callbacks for resize handles
  const handleResizeDragMove = (from: MmPoint, to: MmPoint) => {
    setLiveFrom(from);
    setLiveTo(to);
  };

  const handleResizeCommit = (from: MmPoint, to: MmPoint) => {
    updateRect(rect.id, { from, to });
    setLiveFrom(null);
    setLiveTo(null);
  };

  // Move the whole rect via transparent hit area
  const handleMovePointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!svgRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
    moveDrag.current = {
      startX: pt.x,
      startY: pt.y,
      origFrom: rect.from,
      origTo: rect.to,
    };
    hasMoved.current = false;
  };

  const handleMovePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (!moveDrag.current || !svgRef.current) return;
    const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
    const dx = pt.x - moveDrag.current.startX;
    const dy = pt.y - moveDrag.current.startY;
    if (!hasMoved.current && Math.hypot(dx, dy) < 0.5) return;
    hasMoved.current = true;
    const snapped = snapToQuarterGrid(
      moveDrag.current.origFrom.x + dx,
      moveDrag.current.origFrom.y + dy,
    );
    const snapDx = snapped.x - moveDrag.current.origFrom.x;
    const snapDy = snapped.y - moveDrag.current.origFrom.y;
    setLiveFrom({
      x: moveDrag.current.origFrom.x + snapDx,
      y: moveDrag.current.origFrom.y + snapDy,
    });
    setLiveTo({
      x: moveDrag.current.origTo.x + snapDx,
      y: moveDrag.current.origTo.y + snapDy,
    });
  };

  const handleMovePointerUp = (e: React.PointerEvent<SVGRectElement>) => {
    if (!moveDrag.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!hasMoved.current) {
      onClick(rect.id);
    } else if (liveFrom && liveTo) {
      updateRect(rect.id, { from: liveFrom, to: liveTo });
    }
    setLiveFrom(null);
    setLiveTo(null);
    moveDrag.current = null;
    hasMoved.current = false;
  };

  return (
    <g>
      {/* Shadow */}
      {so > 0 && (
        <g fill={shadowFill} pointerEvents="none">
          <rect x={x2} y={y1 + so} width={so} height={h} />
          <rect x={x1 + so} y={y2} width={w} height={so} />
        </g>
      )}
      {/* Outline */}
      <rect
        x={x1}
        y={y1}
        width={w}
        height={h}
        fill="none"
        stroke={stroke}
        strokeWidth={rect.dotted ? 0.3 : 0.2}
        strokeDasharray={rect.dotted ? "0.0 1.0" : undefined}
        strokeLinecap={rect.dotted ? "round" : "butt"}
        pointerEvents="none"
      />
      {/* Transparent hit area for click-to-select and drag-to-move */}
      <rect
        x={x1}
        y={y1}
        width={w}
        height={h}
        fill="transparent"
        stroke="transparent"
        strokeWidth={1}
        style={{ cursor: isSelected ? "move" : "pointer" }}
        onPointerDown={handleMovePointerDown}
        onPointerMove={handleMovePointerMove}
        onPointerUp={handleMovePointerUp}
      />
      {/* Resize handles (on top so they capture events before the hit area) */}
      {isSelected && (
        <g>
          <ResizeHandle
            cx={x1 + w / 2}
            cy={y1}
            edge="top"
            svgRef={svgRef}
            rect={rect}
            onDragMove={handleResizeDragMove}
            onCommit={handleResizeCommit}
          />
          <ResizeHandle
            cx={x1 + w / 2}
            cy={y2}
            edge="bottom"
            svgRef={svgRef}
            rect={rect}
            onDragMove={handleResizeDragMove}
            onCommit={handleResizeCommit}
          />
          <ResizeHandle
            cx={x1}
            cy={y1 + h / 2}
            edge="left"
            svgRef={svgRef}
            rect={rect}
            onDragMove={handleResizeDragMove}
            onCommit={handleResizeCommit}
          />
          <ResizeHandle
            cx={x2}
            cy={y1 + h / 2}
            edge="right"
            svgRef={svgRef}
            rect={rect}
            onDragMove={handleResizeDragMove}
            onCommit={handleResizeCommit}
          />
        </g>
      )}
    </g>
  );
}

export function RectLayer({
  svgRef,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const rects = useAppStore((s) => s.editingModule?.rects ?? EMPTY_RECTS);
  const selectedRectId = useAppStore((s) => s.selectedRectId);
  const selectRect = useAppStore((s) => s.selectRect);

  return (
    <g>
      {rects.map((rect) => (
        <RectItem
          key={rect.id}
          rect={rect}
          isSelected={rect.id === selectedRectId}
          onClick={selectRect}
          svgRef={svgRef}
        />
      ))}
    </g>
  );
}
