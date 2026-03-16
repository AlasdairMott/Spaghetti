import { useAppStore } from "../../../store";
import potSvgUrl from "../../../assets/pot.svg";

interface Props {
  stroke?: string;
  knobAngle?: number; // 0-300 degrees, undefined = default center (150)
}

export function PotShape({ stroke = "#aaa", knobAngle }: Props) {
  const renderMode = useAppStore((s) => s.renderMode);
  // Convert knob angle to visual rotation: 0° = -150° (7 o'clock), 300° = +150° (5 o'clock)
  const visualRotation = knobAngle != null ? knobAngle - 150 : 0;

  if (renderMode === "rendered") {
    const size = 14;
    return (
      <>
        <defs>
          <filter id="pot-shadow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow
              dx={0.3}
              dy={0.3}
              stdDeviation={0.6}
              floodOpacity={0.4}
            />
          </filter>
        </defs>
        <g transform={`rotate(${visualRotation})`}>
          <image
            href={potSvgUrl}
            x={-size / 2}
            y={-size / 2}
            width={size}
            height={size}
            filter="url(#pot-shadow)"
          />
        </g>
      </>
    );
  }

  // Wireframe: rotate the indicator line
  const rad = (visualRotation * Math.PI) / 180;
  const lineX = Math.sin(rad) * 6.5;
  const lineY = -Math.cos(rad) * 6.5;

  return (
    <>
      <circle r={6.5} fill="#2a2a2a" stroke={stroke} strokeWidth={0.3} />
      <line
        x1={0}
        y1={0}
        x2={lineX}
        y2={lineY}
        stroke="#ddd"
        strokeWidth={0.3}
        strokeLinecap="round"
      />
    </>
  );
}
