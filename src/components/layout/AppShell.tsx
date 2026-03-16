import { useEffect } from "react";
import { useAppStore } from "../../store";
import { Toolbar } from "./Toolbar";
import { DesignerView } from "../designer/DesignerView";
import { CanvasView } from "../canvas/CanvasView";
import { RackView } from "../rack/RackView";

export function AppShell() {
  const mode = useAppStore((s) => s.mode);
  const theme = useAppStore((s) => s.theme);

  // Sync theme class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-text font-sans">
      <Toolbar />
      {mode === "designer" && <DesignerView />}
      {mode === "canvas" && <CanvasView />}
      {mode === "rack" && <RackView />}
    </div>
  );
}
