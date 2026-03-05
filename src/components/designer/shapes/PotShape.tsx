import { useAppStore } from "../../../store";
import potSvgUrl from "../../../assets/pot.svg";

interface Props {
  stroke?: string;
}

export function PotShape({ stroke = "#aaa" }: Props) {
  const renderMode = useAppStore((s) => s.renderMode);

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
        <image
          href={potSvgUrl}
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          filter="url(#pot-shadow)"
        />
      </>
    );
  }

  return (
    <>
      <circle r={6.5} fill="#2a2a2a" stroke={stroke} strokeWidth={0.3} />
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={-6.5}
        stroke="#ddd"
        strokeWidth={0.3}
        strokeLinecap="round"
      />
    </>
  );
}
