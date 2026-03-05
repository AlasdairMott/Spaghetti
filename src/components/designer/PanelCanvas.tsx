import { useRef, useState } from "react";
import { PANEL_HEIGHT } from "../../constants/grid";
import { hpToMm, snapToGrid } from "../../utils/grid";
import { screenToSvg } from "../../utils/svg";
import { gridToMm } from "../../utils/grid";
import { useAppStore } from "../../store";
import { usePanZoom } from "../../hooks/usePanZoom";
import { useToolAction } from "../../hooks/useToolAction";
import { PanelBackground } from "./PanelBackground";
import { ComponentLayer } from "./ComponentLayer";
import { ConnectionLayer } from "./ConnectionLayer";
import { SelectionOverlay } from "./SelectionOverlay";
import { PlacementPreview } from "./PlacementPreview";
import type { GridPosition } from "../../models/types";

interface MarqueeRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function PanelCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const editingModule = useAppStore((s) => s.editingModule);
  const activeTool = useAppStore((s) => s.activeTool);
  const renderMode = useAppStore((s) => s.renderMode);
  const selectComponents = useAppStore((s) => s.selectComponents);
  const [previewPos, setPreviewPos] = useState<GridPosition | null>(null);
  const [cursorMm, setCursorMm] = useState<{ x: number; y: number } | null>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const isMarqueeing = useRef(false);
  const {
    zoom,
    panOffset,
    handleWheel,
    handlePointerDown: panPointerDown,
    handlePointerMove: panPointerMove,
    handlePointerUp: panPointerUp,
  } = usePanZoom();
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
  const isComponentTool = isPlacing && !isLineTool;

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    panPointerDown(e);
    if (e.button === 0 && svgRef.current) {
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      if (activeTool === "select") {
        // Start marquee
        isMarqueeing.current = true;
        setMarquee({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
        selectComponents([]);
      } else {
        handleCanvasClick(pt.x, pt.y);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    panPointerMove(e);
    if (isMarqueeing.current && svgRef.current) {
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      setMarquee((prev) => prev ? { ...prev, x2: pt.x, y2: pt.y } : null);
    }
    if (isPlacing && svgRef.current) {
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      if (isComponentTool) {
        setPreviewPos(snapToGrid(pt.x, pt.y));
      }
      if (isLineTool) {
        setCursorMm({ x: pt.x, y: pt.y });
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
        handleCanvasClick(marquee.x1, marquee.y1);
      } else {
        // Select all components within marquee bounds
        const ids = editingModule.components
          .filter((comp) => {
            const mm = gridToMm(comp.position);
            return mm.x >= minX && mm.x <= maxX && mm.y >= minY && mm.y <= maxY;
          })
          .map((c) => c.id);
        selectComponents(ids);
      }
      setMarquee(null);
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
    <svg
      ref={svgRef}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      style={{
        flex: 1,
        background: "#111",
        cursor,
        display: "block",
      }}
      onWheel={handleWheel}
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
        fill={renderMode === "rendered" ? "#231F20" : "#777"}
        fontSize={3}
        style={{ userSelect: "none", fontFamily: "Pomegranate Grotesque" }}
      >
        {editingModule.name}
      </text>
      <ConnectionLayer />
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
          kind={activeTool === "addJack" ? "jack" : activeTool === "addPot" ? "pot" : "button"}
        />
      )}
      {/* Line/arrow preview while drawing */}
      {isLineTool && lineStart && cursorMm && (() => {
        const pdx = cursorMm.x - lineStart.x;
        const pdy = cursorMm.y - lineStart.y;
        const plen = Math.hypot(pdx, pdy);
        const pux = plen > 0 ? pdx / plen : 0;
        const puy = plen > 0 ? pdy / plen : 0;
        const isArr = activeTool === "addArrow";
        const aH = 1.5, aW = 0.75, aG = 0.8;
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
          {isArr && plen > aH + aG && (() => {
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
          <circle cx={lineStart.x} cy={lineStart.y} r={0.6} fill="#4af" opacity={0.7} />
        </g>
        );
      })()}
    </svg>
  );
}
