import { useAppStore } from "../../store";
import { Toolbar } from "./Toolbar";
import { DesignerView } from "../designer/DesignerView";
import { RackView } from "../rack/RackView";

export function AppShell() {
  const mode = useAppStore((s) => s.mode);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      color: "#ddd",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      <Toolbar />
      {mode === "designer" ? <DesignerView /> : <RackView />}
    </div>
  );
}
