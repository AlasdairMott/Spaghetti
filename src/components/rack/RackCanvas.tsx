import { useRef, useState, useCallback } from "react";
import { useAppStore } from "../../store";
import {
  PANEL_HEIGHT,
  HP_WIDTH,
  GRID_Y,
  GRID_Y_OFFSET,
} from "../../constants/grid";
import { screenToSvg } from "../../utils/svg";
import { gridToMm } from "../../utils/grid";
import { JackShape } from "../designer/shapes/JackShape";
import { PotShape } from "../designer/shapes/PotShape";
import { ButtonShape } from "../designer/shapes/ButtonShape";
import { LedShape } from "../designer/shapes/LedShape";
import { ComponentLabel } from "../designer/ComponentLabel";

const ROW_GAP = 5; // mm gap between rows for rail visualization
const RAIL_HEIGHT = 3; // mm

interface DragState {
  placementId: string;
  moduleId: string;
  offsetHP: number;
}

const EDGE_INSET = 2;

export function RackCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const rack = useAppStore((s) => s.rack);
  const modules = useAppStore((s) => s.modules);
  const placeModule = useAppStore((s) => s.placeModule);
  const removeFromRack = useAppStore((s) => s.removeFromRack);
  const moveInRack = useAppStore((s) => s.moveInRack);
  const renderMode = useAppStore((s) => s.renderMode);
  const isRendered = renderMode === "rendered";
  const panelBg = isRendered ? "#E7E0D8" : "#222";
  const lineColor = isRendered ? "#231F20" : "#444";
  const textColor = isRendered ? "#231F20" : "#777";
  const topLineY = GRID_Y_OFFSET + GRID_Y * 0.75;
  const bottomRowCount = Math.floor((PANEL_HEIGHT - GRID_Y_OFFSET) / GRID_Y);
  const bottomLineY = GRID_Y_OFFSET + bottomRowCount * GRID_Y - GRID_Y * 0.75;

  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragPreviewHP, setDragPreviewHP] = useState<number>(0);

  const rackWidthMm = rack.widthHP * HP_WIDTH;
  const rowHeight = PANEL_HEIGHT + RAIL_HEIGHT * 2 + ROW_GAP;
  const totalHeight = rack.rows * rowHeight;
  const padding = 10;

  const handleDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const moduleId = e.dataTransfer.getData("moduleId");
    if (!moduleId || !svgRef.current) return;

    const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
    const row = Math.floor(pt.y / rowHeight);
    if (row < 0 || row >= rack.rows) return;

    const hpPos = Math.round(pt.x / HP_WIDTH);
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const clampedHP = Math.max(0, Math.min(hpPos, rack.widthHP - mod.widthHP));
    placeModule(moduleId, clampedHP, row);
  };

  const handleModulePointerDown = useCallback(
    (
      e: React.PointerEvent<SVGElement>,
      placementId: string,
      moduleId: string,
      positionHP: number,
    ) => {
      if (e.button !== 0 || !svgRef.current) return;
      e.stopPropagation();
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      const grabHP = pt.x / HP_WIDTH;
      const offsetHP = grabHP - positionHP;
      setDrag({ placementId, moduleId, offsetHP });
      setDragPreviewHP(positionHP);
      (e.target as SVGElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drag || !svgRef.current) return;
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      const mod = modules.find((m) => m.id === drag.moduleId);
      if (!mod) return;
      const rawHP = Math.round(pt.x / HP_WIDTH - drag.offsetHP);
      const clampedHP = Math.max(
        0,
        Math.min(rawHP, rack.widthHP - mod.widthHP),
      );
      setDragPreviewHP(clampedHP);
    },
    [drag, modules, rack.widthHP],
  );

  const handlePointerUp = useCallback(() => {
    if (!drag) return;
    moveInRack(drag.placementId, dragPreviewHP);
    setDrag(null);
  }, [drag, dragPreviewHP, moveInRack]);

  return (
    <svg
      ref={svgRef}
      viewBox={`${-padding} ${-padding} ${rackWidthMm + padding * 2} ${totalHeight + padding * 2}`}
      style={{ flex: 1, background: "#0a0a0a", display: "block" }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {Array.from({ length: rack.rows }, (_, row) => {
        const rowY = row * rowHeight;
        return (
          <g key={row} transform={`translate(0, ${rowY})`}>
            {/* Top rail */}
            <rect
              x={0}
              y={0}
              width={rackWidthMm}
              height={RAIL_HEIGHT}
              fill="#555"
              rx={0.5}
            />
            {/* Module area */}
            <rect
              x={0}
              y={RAIL_HEIGHT}
              width={rackWidthMm}
              height={PANEL_HEIGHT}
              fill="#1a1a1a"
              stroke="#333"
              strokeWidth={0.3}
            />
            {/* Bottom rail */}
            <rect
              x={0}
              y={RAIL_HEIGHT + PANEL_HEIGHT}
              width={rackWidthMm}
              height={RAIL_HEIGHT}
              fill="#555"
              rx={0.5}
            />

            {/* HP tick marks on top rail */}
            {Array.from({ length: rack.widthHP + 1 }, (_, hp) => (
              <line
                key={hp}
                x1={hp * HP_WIDTH}
                y1={0}
                x2={hp * HP_WIDTH}
                y2={RAIL_HEIGHT}
                stroke="#777"
                strokeWidth={0.2}
              />
            ))}

            {/* Placed modules in this row */}
            {rack.placements
              .filter((p) => p.row === row)
              .map((placement) => {
                const mod = modules.find((m) => m.id === placement.moduleId);
                if (!mod) return null;
                const isDragging = drag?.placementId === placement.id;
                const displayHP = isDragging
                  ? dragPreviewHP
                  : placement.positionHP;
                const modX = displayHP * HP_WIDTH;
                const modWidth = mod.widthHP * HP_WIDTH;
                return (
                  <g
                    key={placement.id}
                    transform={`translate(${modX}, ${RAIL_HEIGHT})`}
                    opacity={isDragging ? 0.7 : 1}
                  >
                    {/* Panel background */}
                    <rect
                      x={0}
                      y={0}
                      width={modWidth}
                      height={PANEL_HEIGHT}
                      fill={panelBg}
                      stroke={isDragging ? "#fa4" : "#959495"}
                      strokeWidth={0.2}
                      rx={0.5}
                    />
                    {/* Top line */}
                    <line
                      x1={EDGE_INSET}
                      y1={topLineY}
                      x2={modWidth - EDGE_INSET}
                      y2={topLineY}
                      stroke={lineColor}
                      strokeWidth={0.2}
                    />
                    {/* Bottom line */}
                    <line
                      x1={EDGE_INSET}
                      y1={bottomLineY}
                      x2={modWidth - EDGE_INSET}
                      y2={bottomLineY}
                      stroke={lineColor}
                      strokeWidth={0.2}
                    />
                    {/* Render components with labels */}
                    {mod.components.map((comp) => {
                      const pos = gridToMm(comp.position);
                      const labelY =
                        comp.kind === "jack"
                          ? -8
                          : comp.kind === "pot"
                            ? -9
                            : -5;
                      return (
                        <g
                          key={comp.id}
                          transform={`translate(${pos.x}, ${pos.y})`}
                        >
                          {comp.kind === "jack" ? (
                            <JackShape stroke="#888" />
                          ) : comp.kind === "pot" ? (
                            <PotShape stroke="#888" />
                          ) : (
                            <ButtonShape stroke="#888" />
                          )}
                          {comp.kind === "jack" && comp.hasLed && (
                            <g transform="translate(-5.5, 0)">
                              <LedShape />
                            </g>
                          )}
                          <ComponentLabel component={comp} y={labelY} />
                        </g>
                      );
                    })}
                    {/* Module name label */}
                    <text
                      x={modWidth / 2}
                      y={PANEL_HEIGHT - 4}
                      textAnchor="middle"
                      fill={textColor}
                      fontSize={3}
                      style={{ userSelect: "none" }}
                    >
                      {mod.name}
                    </text>
                    {/* Interaction layer */}
                    <rect
                      x={0}
                      y={0}
                      width={modWidth}
                      height={PANEL_HEIGHT}
                      fill="transparent"
                      style={{ cursor: "grab" }}
                      onPointerDown={(e) =>
                        handleModulePointerDown(
                          e,
                          placement.id,
                          placement.moduleId,
                          placement.positionHP,
                        )
                      }
                      onDoubleClick={() => removeFromRack(placement.id)}
                    />
                  </g>
                );
              })}
          </g>
        );
      })}
    </svg>
  );
}
