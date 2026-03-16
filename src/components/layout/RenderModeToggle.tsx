import { useAppStore } from "../../store";
import { Circle } from "lucide-react";

export function RenderModeToggle() {
  const renderMode = useAppStore((s) => s.renderMode);
  const setRenderMode = useAppStore((s) => s.setRenderMode);
  const isRendered = renderMode === "rendered";

  return (
    <button
      onClick={() => setRenderMode(isRendered ? "wireframe" : "rendered")}
      className={`absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 bg-surface-1/85 border border-border-light rounded-md text-[11px] cursor-pointer z-10 ${
        isRendered ? "text-[#9f68c4]" : "text-text-muted"
      }`}
      title={`Switch to ${isRendered ? "wireframe" : "rendered"} mode`}
    >
      {isRendered ? <img src="/globe.png" alt="Rendered" className="size-3.5" /> : <Circle size={14} />}
      {isRendered ? "Rendered" : "Wireframe"}
    </button>
  );
}
