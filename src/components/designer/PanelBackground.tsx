import {
  GRID_X,
  GRID_Y,
  PANEL_HEIGHT,
  GRID_Y_OFFSET,
  EDGE_INSET,
  TOP_LINE_Y,
  BOTTOM_LINE_Y,
} from "../../constants/grid";
import { hpToMm } from "../../utils/grid";
import { useAppStore } from "../../store";

interface Props {
  widthHP: number;
}

export function PanelBackground({ widthHP }: Props) {
  const widthMm = hpToMm(widthHP);
  const renderMode = useAppStore((s) => s.renderMode);
  const theme = useAppStore((s) => s.theme);
  const isRendered = renderMode === "rendered";
  const isLight = theme === "light";
  const panelBg = isRendered ? "#E7E0D8" : isLight ? "#e8e4e0" : "#1a1a1a";
  const panelStroke = isRendered ? "#231F20" : isLight ? "#999" : "#444";
  const gridDotColor = isRendered ? "#bbb" : isLight ? "#aaa" : "#555";
  const lineColor = isRendered ? "#231F20" : isLight ? "#555" : "#444";

  return (
    <>
      <defs>
        <pattern
          id="grid-pattern"
          x="0"
          y={GRID_Y_OFFSET}
          width={GRID_X}
          height={GRID_Y}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={GRID_X / 2}
            cy={GRID_Y / 2}
            r={0.15}
            fill={gridDotColor}
          />
        </pattern>
      </defs>
      {/* Panel background */}
      <rect
        x={0}
        y={0}
        width={widthMm}
        height={PANEL_HEIGHT}
        fill={panelBg}
        stroke={panelStroke}
        strokeWidth={0.3}
      />
      {/* Grid dots */}
      <rect
        x={0}
        y={0}
        width={widthMm}
        height={PANEL_HEIGHT}
        fill="url(#grid-pattern)"
      />
      {/* Top grid line */}
      <line
        x1={EDGE_INSET}
        y1={TOP_LINE_Y}
        x2={widthMm - EDGE_INSET}
        y2={TOP_LINE_Y}
        stroke={lineColor}
        strokeWidth={0.2}
        strokeLinecap="round"
      />
      {/* Bottom grid line */}
      <line
        x1={EDGE_INSET}
        y1={BOTTOM_LINE_Y}
        x2={widthMm - EDGE_INSET}
        y2={BOTTOM_LINE_Y}
        stroke={lineColor}
        strokeWidth={0.2}
        strokeLinecap="round"
      />
    </>
  );
}
