import { useEffect } from "react";
import { useAppStore } from "../../store";
import { Toolbar } from "./Toolbar";
import { DesignerView } from "../designer/DesignerView";
import { CanvasView } from "../canvas/CanvasView";
import { RackView } from "../rack/RackView";
import { LibraryView } from "../library/LibraryView";

export function AppShell() {
  const mode = useAppStore((s) => s.mode);
  const theme = useAppStore((s) => s.theme);
  const viewTabs = useAppStore((s) => s.viewTabs);
  const activeViewTabId = useAppStore((s) => s.activeViewTabId);

  const activeTab = viewTabs.find((t) => t.id === activeViewTabId);

  // Sync theme class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-text font-sans">
      <Toolbar />
      {mode === "designer" && <DesignerView />}
      {mode === "library" && <LibraryView />}
      {mode === "view" && activeTab?.kind === "rack" && (
        <RackView key={activeTab.dataId} />
      )}
      {mode === "view" && activeTab?.kind === "canvas" && (
        <CanvasView key={activeTab.dataId} />
      )}
    </div>
  );
}
