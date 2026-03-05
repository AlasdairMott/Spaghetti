import { useAppStore } from "../../../store";
import jackPngUrl from "../../../assets/jack.png";

interface Props {
  stroke?: string;
}

export function JackShape({ stroke = "#aaa" }: Props) {
  const renderMode = useAppStore((s) => s.renderMode);

  if (renderMode === "rendered") {
    const size = 8;
    return (
      <>
        <defs>
          <filter id="jack-shadow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow
              dx={0.3}
              dy={0.3}
              stdDeviation={0.6}
              floodOpacity={0.4}
            />
          </filter>
        </defs>
        <image
          href={jackPngUrl}
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          filter="url(#jack-shadow)"
        />
      </>
    );
  }

  return (
    <>
      <circle r={3.7} fill="none" stroke={stroke} strokeWidth={0.3} />
      <circle r={2} fill="#333" stroke="#888" strokeWidth={0.2} />
    </>
  );
}
