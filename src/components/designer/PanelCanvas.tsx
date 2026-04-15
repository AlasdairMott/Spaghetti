import { useCallback, useRef, useState } from "react";
import { PANEL_HEIGHT } from "../../constants/grid";
import { hpToMm, snapToGrid, snapToQuarterGrid } from "../../utils/grid";
import { screenToSvg } from "../../utils/svg";
import { gridToMm } from "../../utils/grid";
import { useAppStore } from "../../store";
import { usePanZoom } from "../../hooks/usePanZoom";
import { useToolAction } from "../../hooks/useToolAction";
import { PanelBackground } from "./PanelBackground";
import { ComponentLayer } from "./ComponentLayer";
import { ConnectionLayer } from "./ConnectionLayer";
import { RectLayer } from "./RectLayer";
import { SelectionOverlay } from "./SelectionOverlay";
import { PlacementPreview } from "./PlacementPreview";
import type { GridPosition } from "../../models/types";
import { RenderModeToggle } from "../layout/RenderModeToggle";

interface MarqueeRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function PanelCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const svgCallbackRef = useCallback((el: SVGSVGElement | null) => {
    svgRef.current = el;
    setSvgEl(el);
  }, []);
  const editingModule = useAppStore((s) => s.editingModule);
  const activeTool = useAppStore((s) => s.activeTool);
  const renderMode = useAppStore((s) => s.renderMode);
  const theme = useAppStore((s) => s.theme);
  const isLight = theme === "light";
  const selectComponents = useAppStore((s) => s.selectComponents);
  const selectItems = useAppStore((s) => s.selectItems);
  const addRect = useAppStore((s) => s.addRect);
  const [previewPos, setPreviewPos] = useState<GridPosition | null>(null);
  const [cursorMm, setCursorMm] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const isMarqueeing = useRef(false);
  const {
    zoom,
    panOffset,
    handlePointerDown: panPointerDown,
    handlePointerMove: panPointerMove,
    handlePointerUp: panPointerUp,
  } = usePanZoom(svgEl);
  const { handleCanvasClick, lineStart } = useToolAction();

  if (!editingModule) return null;

  const widthMm = hpToMm(editingModule.widthHP);
  const padding = 10;
  const vbW = (widthMm + padding * 2) / zoom;
  const vbH = (PANEL_HEIGHT + padding * 2) / zoom;
  const vbX = panOffset.x - padding / zoom;
  const vbY = panOffset.y - padding / zoom;

  const isPlacing = activeTool !== "select";
  const isLineTool = activeTool === "addLine" || activeTool === "addArrow";
  const isRectTool = activeTool === "addRect";
  const isComponentTool = isPlacing && !isLineTool && !isRectTool;

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    panPointerDown(e);
    if (e.button === 0 && svgRef.current) {
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      if (activeTool === "select") {
        // Start marquee (don't clear selection if shift is held)
        isMarqueeing.current = true;
        setMarquee({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
        if (!e.shiftKey) selectComponents([]);
      } else if (isRectTool) {
        setRectStart(snapToQuarterGrid(pt.x, pt.y));
      } else {
        handleCanvasClick(pt.x, pt.y);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    panPointerMove(e);
    if (isMarqueeing.current && svgRef.current) {
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      setMarquee((prev) => (prev ? { ...prev, x2: pt.x, y2: pt.y } : null));
    }
    if (isPlacing && svgRef.current) {
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      if (isComponentTool) {
        setPreviewPos(snapToGrid(pt.x, pt.y));
      }
      if (isLineTool || isRectTool) {
        const snapped = isRectTool ? snapToQuarterGrid(pt.x, pt.y) : pt;
        setCursorMm(snapped);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    panPointerUp(e);
    if (isMarqueeing.current && marquee && editingModule) {
      isMarqueeing.current = false;
      const minX = Math.min(marquee.x1, marquee.x2);
      const maxX = Math.max(marquee.x1, marquee.x2);
      const minY = Math.min(marquee.y1, marquee.y2);
      const maxY = Math.max(marquee.y1, marquee.y2);

      // If it was basically a click (tiny rect), do hit-test single select
      const dx = maxX - minX;
      const dy = maxY - minY;
      if (dx < 1 && dy < 1) {
        handleCanvasClick(marquee.x1, marquee.y1, e.shiftKey);
      } else {
        // Select all items within marquee bounds
        const compIds = editingModule.components
          .filter((comp) => {
            const mm = gridToMm(comp.position);
            return mm.x >= minX && mm.x <= maxX && mm.y >= minY && mm.y <= maxY;
          })
          .map((c) => c.id);
        const connIds = (editingModule.connections ?? [])
          .filter((c) =>
            c.from.x >= minX && c.from.x <= maxX && c.from.y >= minY && c.from.y <= maxY &&
            c.to.x >= minX && c.to.x <= maxX && c.to.y >= minY && c.to.y <= maxY
          )
          .map((c) => c.id);
        const rIds = (editingModule.rects ?? [])
          .filter((r) => {
            const rx1 = Math.min(r.from.x, r.to.x);
            const rx2 = Math.max(r.from.x, r.to.x);
            const ry1 = Math.min(r.from.y, r.to.y);
            const ry2 = Math.max(r.from.y, r.to.y);
            return rx1 >= minX && rx2 <= maxX && ry1 >= minY && ry2 <= maxY;
          })
          .map((r) => r.id);
        if (e.shiftKey) {
          const s = useAppStore.getState();
          selectItems(
            [...new Set([...s.selectedComponentIds, ...compIds])],
            [...new Set([...s.selectedConnectionIds, ...connIds])],
            [...new Set([...s.selectedRectIds, ...rIds])],
          );
        } else {
          selectItems(compIds, connIds, rIds);
        }
      }
      setMarquee(null);
    }
    // Commit rect on pointer up
    if (isRectTool && rectStart && svgRef.current) {
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      const end = snapToQuarterGrid(pt.x, pt.y);
      const dx = Math.abs(end.x - rectStart.x);
      const dy = Math.abs(end.y - rectStart.y);
      if (dx > 0.5 && dy > 0.5) {
        addRect(rectStart, end);
      }
      setRectStart(null);
    }
  };

  const handlePointerLeave = () => {
    setPreviewPos(null);
    setCursorMm(null);
  };

  const cursor = activeTool === "select" ? "default" : "crosshair";

  // Compute marquee rect for rendering
  const marqueeRect = marquee
    ? {
        x: Math.min(marquee.x1, marquee.x2),
        y: Math.min(marquee.y1, marquee.y2),
        width: Math.abs(marquee.x2 - marquee.x1),
        height: Math.abs(marquee.y2 - marquee.y1),
      }
    : null;

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        display: "flex",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <RenderModeToggle />
      <svg
        ref={svgCallbackRef}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        style={{
          flex: 1,
          background: "var(--color-surface-0)",
          cursor,
          display: "block",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <PanelBackground widthHP={editingModule.widthHP} />
        {/* Module name */}
        <text
          x={widthMm / 2}
          y={6}
          textAnchor="middle"
          fill={
            renderMode === "rendered" ? "#231F20" : isLight ? "#444" : "#777"
          }
          fontSize={3}
          style={{ userSelect: "none", fontFamily: "Plus Jakarta Sans" }}
        >
          {editingModule.name}
        </text>
        <RectLayer svgRef={svgRef} />
        <ConnectionLayer svgRef={svgRef} />
        <ComponentLayer svgRef={svgRef} />
        <SelectionOverlay />
        {marqueeRect && marqueeRect.width > 1 && (
          <rect
            x={marqueeRect.x}
            y={marqueeRect.y}
            width={marqueeRect.width}
            height={marqueeRect.height}
            fill="rgba(68, 170, 255, 0.1)"
            stroke="#4af"
            strokeWidth={0.2}
            strokeDasharray="1 0.5"
            pointerEvents="none"
          />
        )}
        {isComponentTool && previewPos && (
          <PlacementPreview
            position={previewPos}
            kind={
              activeTool === "addJack"
                ? "jack"
                : activeTool === "addPot"
                  ? "pot"
                  : "button"
            }
          />
        )}
        {/* Rect preview while drawing */}
        {isRectTool &&
          rectStart &&
          cursorMm &&
          (() => {
            const x = Math.min(rectStart.x, cursorMm.x);
            const y = Math.min(rectStart.y, cursorMm.y);
            const w = Math.abs(cursorMm.x - rectStart.x);
            const h = Math.abs(cursorMm.y - rectStart.y);
            return (
              <g pointerEvents="none">
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(68,170,255,0.05)"
                  stroke="#4af"
                  strokeWidth={0.3}
                  strokeDasharray="1 0.5"
                  opacity={0.8}
                />
              </g>
            );
          })()}
        {/* Line/arrow preview while drawing */}
        {isLineTool &&
          lineStart &&
          cursorMm &&
          (() => {
            const pdx = cursorMm.x - lineStart.x;
            const pdy = cursorMm.y - lineStart.y;
            const plen = Math.hypot(pdx, pdy);
            const pux = plen > 0 ? pdx / plen : 0;
            const puy = plen > 0 ? pdy / plen : 0;
            const isArr = activeTool === "addArrow";
            const aH = 1.5,
              aW = 0.75,
              aG = 0.8;
            const leX = isArr ? cursorMm.x - pux * (aH + aG) : cursorMm.x;
            const leY = isArr ? cursorMm.y - puy * (aH + aG) : cursorMm.y;
            return (
              <g pointerEvents="none">
                <line
                  x1={lineStart.x}
                  y1={lineStart.y}
                  x2={leX}
                  y2={leY}
                  stroke="#4af"
                  strokeWidth={0.4}
                  strokeDasharray="1 0.5"
                  opacity={0.7}
                />
                {isArr &&
                  plen > aH + aG &&
                  (() => {
                    const bX = cursorMm.x - pux * aH;
                    const bY = cursorMm.y - puy * aH;
                    const ppX = -puy * aW;
                    const ppY = pux * aW;
                    return (
                      <polygon
                        points={`${cursorMm.x},${cursorMm.y} ${bX + ppX},${bY + ppY} ${bX - ppX},${bY - ppY}`}
                        fill="#4af"
                        opacity={0.7}
                      />
                    );
                  })()}
                {/* Start point indicator */}
                <circle
                  cx={lineStart.x}
                  cy={lineStart.y}
                  r={0.6}
                  fill="#4af"
                  opacity={0.7}
                />
              </g>
            );
          })()}
      </svg>
    </div>
  );
}
