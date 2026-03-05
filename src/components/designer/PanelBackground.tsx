import {
  GRID_X,
  GRID_Y,
  PANEL_HEIGHT,
  GRID_Y_OFFSET,
} from "../../constants/grid";
import { hpToMm } from "../../utils/grid";
import { useAppStore } from "../../store";

interface Props {
  widthHP: number;
}

const EDGE_INSET = 2; // mm from panel edge for top/bottom lines

export function PanelBackground({ widthHP }: Props) {
  const widthMm = hpToMm(widthHP);
  const renderMode = useAppStore((s) => s.renderMode);
  const isRendered = renderMode === "rendered";
  const panelBg = isRendered ? "#E7E0D8" : "#1a1a1a";
  const panelStroke = isRendered ? "#231F20" : "#444";
  const gridDotColor = isRendered ? "#bbb" : "#555";
  const lineColor = isRendered ? "#231F20" : "#444";

  // First grid row Y
  const topLineY = GRID_Y_OFFSET + GRID_Y * 0.75;
  // Last grid row Y that fits within the panel
  const bottomRowCount = Math.floor((PANEL_HEIGHT - GRID_Y_OFFSET) / GRID_Y);
  const bottomLineY = GRID_Y_OFFSET + bottomRowCount * GRID_Y - GRID_Y * 0.75;

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
        y1={topLineY}
        x2={widthMm - EDGE_INSET}
        y2={topLineY}
        stroke={lineColor}
        strokeWidth={0.2}
        strokeLinecap="round"
      />
      {/* Bottom grid line */}
      <line
        x1={EDGE_INSET}
        y1={bottomLineY}
        x2={widthMm - EDGE_INSET}
        y2={bottomLineY}
        stroke={lineColor}
        strokeWidth={0.2}
        strokeLinecap="round"
      />
    </>
  );
}
