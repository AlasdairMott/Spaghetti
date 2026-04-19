import { useAppStore } from "../../store";
import {
  PANEL_HEIGHT,
  HP_WIDTH,
  EDGE_INSET,
  TOP_LINE_Y,
  BOTTOM_LINE_Y,
} from "../../constants/grid";
import { gridToMm } from "../../utils/grid";
import { JackShape } from "../designer/shapes/JackShape";
import { PotShape } from "../designer/shapes/PotShape";
import { ButtonShape } from "../designer/shapes/ButtonShape";
import { LedShape } from "../designer/shapes/LedShape";
import { ComponentLabel } from "../designer/ComponentLabel";
import { computeButtonLayout, resolveLabelLayout } from "../../utils/buttonLayout";
import type { Module, PanelRect } from "../../models/types";

interface ModulePanelProps {
  module: Module;
  placementId: string;
  panelBg: string;
  panelStroke: string;
  lineColor: string;
  textColor: string;
  compStroke: string;
  borderStroke?: string;
  borderWidth?: number;
  getKnobAngle: (pid: string, cid: string) => number;
  isButtonPressed: (pid: string, cid: string) => boolean;
  handlePotPointerDown: (e: React.PointerEvent<SVGElement>, pid: string, cid: string) => void;
  onPotDoubleClick: (pid: string, cid: string) => void;
  onButtonClick: (pid: string, cid: string) => void;
}

function RectDisplay({ rect }: { rect: PanelRect }) {
  const renderMode = useAppStore((s) => s.renderMode);
  const theme = useAppStore((s) => s.theme);

  const x1 = Math.min(rect.from.x, rect.to.x);
  const y1 = Math.min(rect.from.y, rect.to.y);
  const x2 = Math.max(rect.from.x, rect.to.x);
  const y2 = Math.max(rect.from.y, rect.to.y);
  const w = x2 - x1;
  const h = y2 - y1;

  const stroke =
    renderMode === "rendered"
      ? "#231F20"
      : theme === "light"
        ? "#555"
        : "#aaa";

  const shadowFill =
    renderMode === "rendered" ? "#231F20" : theme === "light" ? "#555" : "#aaa";

  const so = rect.shadowOffset ?? 0;

  return (
    <g pointerEvents="none">
      {so > 0 && (
        <g fill={shadowFill}>
          <rect x={x2} y={y1 + so} width={so} height={h} />
          <rect x={x1 + so} y={y2} width={w} height={so} />
        </g>
      )}
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
      />
    </g>
  );
}

export function ModulePanel({
  module: mod,
  placementId,
  panelBg,
  panelStroke,
  lineColor,
  textColor,
  compStroke,
  borderStroke,
  borderWidth,
  getKnobAngle,
  isButtonPressed,
  handlePotPointerDown,
  onPotDoubleClick,
  onButtonClick,
}: ModulePanelProps) {
  const modWidth = mod.widthHP * HP_WIDTH;

  return (
    <>
      {/* Panel background */}
      <rect
        x={0}
        y={0}
        width={modWidth}
        height={PANEL_HEIGHT}
        fill={panelBg}
        stroke={borderStroke ?? panelStroke}
        strokeWidth={borderWidth ?? 0.2}
        rx={0.5}
      />
      {/* Top line */}
      <line
        x1={EDGE_INSET}
        y1={TOP_LINE_Y}
        x2={modWidth - EDGE_INSET}
        y2={TOP_LINE_Y}
        stroke={lineColor}
        strokeWidth={0.2}
        strokeLinecap="round"
      />
      {/* Bottom line */}
      <line
        x1={EDGE_INSET}
        y1={BOTTOM_LINE_Y}
        x2={modWidth - EDGE_INSET}
        y2={BOTTOM_LINE_Y}
        stroke={lineColor}
        strokeWidth={0.2}
        strokeLinecap="round"
      />

      {/* Rectangles */}
      {(mod.rects ?? []).map((rect) => (
        <RectDisplay key={rect.id} rect={rect} />
      ))}

      {/* Components */}
      {mod.components.map((comp) => {
        const pos = gridToMm(comp.position);
        const buttonLeds = comp.buttonLedCount ?? 0;
        const hasButtonLeds = comp.kind === "button" && buttonLeds > 0;
        const buttonLayout =
          comp.kind === "button"
            ? computeButtonLayout(buttonLeds, comp.buttonLedPosition ?? "above")
            : null;
        const defaultDist =
          comp.kind === "jack" ? 5 : comp.kind === "pot" ? 8 : 5;
        const labelLayout =
          comp.kind === "button"
            ? resolveLabelLayout(comp, 5)
            : {
                x: 0,
                y: -defaultDist,
                textAnchor: "middle" as const,
                rotation: comp.labelAngle ?? 0,
              };
        return (
          <g key={comp.id} transform={`translate(${pos.x}, ${pos.y})`}>
            {comp.kind === "jack" ? (
              <g pointerEvents="none">
                <JackShape stroke={compStroke} />
              </g>
            ) : comp.kind === "pot" ? (
              <g
                style={{ cursor: "ns-resize" }}
                onPointerDown={(e) =>
                  handlePotPointerDown(e, placementId, comp.id)
                }
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onPotDoubleClick(placementId, comp.id);
                }}
              >
                <PotShape
                  stroke={compStroke}
                  knobAngle={getKnobAngle(placementId, comp.id)}
                />
                <circle r={7} fill="transparent" pointerEvents="all" />
              </g>
            ) : (
              <g
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onButtonClick(placementId, comp.id);
                }}
              >
                {buttonLayout?.ledPositions.map((p, i) => (
                  <g key={i} transform={`translate(${p.x}, ${p.y})`}>
                    <LedShape
                      lit={isButtonPressed(placementId, comp.id)}
                    />
                  </g>
                ))}
                <g
                  transform={`translate(${buttonLayout?.buttonOffset.x ?? 0}, ${buttonLayout?.buttonOffset.y ?? 0})`}
                >
                  <ButtonShape
                    stroke={
                      !hasButtonLeds &&
                      isButtonPressed(placementId, comp.id)
                        ? "#aaf"
                        : compStroke
                    }
                  />
                </g>
                <rect
                  x={(buttonLayout?.buttonOffset.x ?? 0) - 3}
                  y={(buttonLayout?.buttonOffset.y ?? 0) - 3}
                  width={6}
                  height={6}
                  fill="transparent"
                  pointerEvents="all"
                />
              </g>
            )}
            {comp.kind === "jack" && comp.hasLed && (
              <g transform="translate(-5.5, 0)">
                <LedShape />
              </g>
            )}
            <ComponentLabel
              component={comp}
              x={labelLayout.x}
              y={labelLayout.y}
              textAnchor={labelLayout.textAnchor}
              rotation={labelLayout.rotation}
            />
          </g>
        );
      })}

      {/* Connections */}
      {(mod.connections ?? []).map((conn) => {
        const cdx = conn.to.x - conn.from.x;
        const cdy = conn.to.y - conn.from.y;
        const clen = Math.hypot(cdx, cdy);
        const cux = clen > 0 ? cdx / clen : 0;
        const cuy = clen > 0 ? cdy / clen : 0;
        const so = conn.startOffset ?? 0;
        const eo = conn.endOffset ?? 0;
        const cx1 = conn.from.x + cux * so;
        const cy1 = conn.from.y + cuy * so;
        const cx2 = conn.to.x - cux * eo;
        const cy2 = conn.to.y - cuy * eo;
        const isArr = conn.kind === "arrow";
        const aH = 1.5,
          aW = 0.75,
          aG = 0.8;
        const leX = isArr ? cx2 - cux * (aH + aG) : cx2;
        const leY = isArr ? cy2 - cuy * (aH + aG) : cy2;
        const bX = cx2 - cux * aH;
        const bY = cy2 - cuy * aH;
        const pX = -cuy * aW;
        const pY = cux * aW;
        return (
          <g key={conn.id}>
            <line
              x1={cx1}
              y1={cy1}
              x2={leX}
              y2={leY}
              stroke={lineColor}
              strokeWidth={0.2}
            />
            {isArr && (
              <polygon
                points={`${cx2},${cy2} ${bX + pX},${bY + pY} ${bX - pX},${bY - pY}`}
                fill={lineColor}
              />
            )}
            {conn.label && (
              <text
                x={(cx1 + leX) / 2 + (clen > 0 ? -cuy * 2 : 2)}
                y={(cy1 + leY) / 2 + (clen > 0 ? cux * 2 : 0)}
                textAnchor="middle"
                dominantBaseline="central"
                fill={textColor}
                fontSize={2.5}
                style={{
                  userSelect: "none",
                  fontFamily: "Plus Jakarta Sans",
                }}
              >
                {conn.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Module name */}
      <text
        x={modWidth / 2}
        y={6}
        textAnchor="middle"
        fill={textColor}
        fontSize={3}
        style={{
          userSelect: "none",
          fontFamily: "Plus Jakarta Sans",
        }}
      >
        {mod.name}
      </text>
    </>
  );
}
