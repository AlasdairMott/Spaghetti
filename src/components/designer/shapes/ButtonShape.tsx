import { useAppStore } from "../../../store";
import buttonSvgUrl from "../../../assets/button.svg";

interface Props {
  stroke?: string;
}

export function ButtonShape({ stroke = "#aaa" }: Props) {
  const renderMode = useAppStore((s) => s.renderMode);

  if (renderMode === "rendered") {
    const size = 5;
    return (
      <>
        <defs>
          <filter id="btn-shadow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow
              dx={0.1}
              dy={0.1}
              stdDeviation={0.5}
              floodOpacity={0.35}
            />
          </filter>
        </defs>
        <image
          href={buttonSvgUrl}
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          filter="url(#btn-shadow)"
        />
      </>
    );
  }

  return (
    <>
      <rect
        x={-2.5}
        y={-2.5}
        width={5}
        height={5}
        rx={0.5}
        fill="#2a2a2a"
        stroke={stroke}
        strokeWidth={0.3}
      />
      <rect
        x={-1.5}
        y={-1.5}
        width={3}
        height={3}
        rx={0.3}
        fill="#444"
        stroke="#666"
        strokeWidth={0.15}
      />
    </>
  );
}
