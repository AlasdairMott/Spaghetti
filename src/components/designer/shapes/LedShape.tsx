import { useAppStore } from "../../../store";
import ledSvgUrl from "../../../assets/led.svg";

interface Props {
  color?: string;
}

export function LedShape({ color = "#f44" }: Props) {
  const renderMode = useAppStore((s) => s.renderMode);

  if (renderMode === "rendered") {
    const size = 2.5;
    return (
      <>
        <defs>
          <filter id="led-shadow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow
              dx={0.1}
              dy={0.1}
              stdDeviation={0.4}
              floodOpacity={0.3}
            />
          </filter>
        </defs>
        <image
          href={ledSvgUrl}
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          filter="url(#led-shadow)"
        />
      </>
    );
  }

  return (
    <>
      <circle r={1} fill={color} opacity={0.8} />
      <circle r={0.5} fill="#fff" opacity={0.3} />
    </>
  );
}
