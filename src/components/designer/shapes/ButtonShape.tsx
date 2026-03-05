import { useAppStore } from "../../../store";

interface Props {
  stroke?: string;
}

export function ButtonShape({ stroke = "#aaa" }: Props) {
  const renderMode = useAppStore((s) => s.renderMode);

  if (renderMode === "rendered") {
    return (
      <>
        <defs>
          <linearGradient id="btn-housing-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#444" />
            <stop offset="100%" stopColor="#222" />
          </linearGradient>
          <linearGradient id="btn-cap-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#777" />
            <stop offset="50%" stopColor="#555" />
            <stop offset="100%" stopColor="#444" />
          </linearGradient>
        </defs>
        {/* Shadow */}
        <rect x={-2.3} y={-2.1} width={5} height={5} rx={0.5} fill="rgba(0,0,0,0.3)" />
        {/* Housing */}
        <rect x={-2.5} y={-2.5} width={5} height={5} rx={0.5} fill="url(#btn-housing-grad)" stroke={stroke} strokeWidth={0.2} />
        {/* Cap with 3D feel */}
        <rect x={-1.5} y={-1.5} width={3} height={3} rx={0.4} fill="url(#btn-cap-grad)" />
        {/* Top highlight */}
        <rect x={-1.2} y={-1.3} width={2.4} height={0.5} rx={0.2} fill="rgba(255,255,255,0.15)" />
      </>
    );
  }

  return (
    <>
      <rect x={-2.5} y={-2.5} width={5} height={5} rx={0.5} fill="#2a2a2a" stroke={stroke} strokeWidth={0.3} />
      <rect x={-1.5} y={-1.5} width={3} height={3} rx={0.3} fill="#444" stroke="#666" strokeWidth={0.15} />
    </>
  );
}
