import { useAppStore } from "../../store";

export function PropertyEditor() {
  const editingModule = useAppStore((s) => s.editingModule);
  const selectedId = useAppStore((s) => s.selectedComponentId);
  const updateComponent = useAppStore((s) => s.updateComponent);
  const removeComponent = useAppStore((s) => s.removeComponent);
  const updateModuleName = useAppStore((s) => s.updateModuleName);
  const updateModuleWidth = useAppStore((s) => s.updateModuleWidth);

  const component = editingModule?.components.find((c) => c.id === selectedId);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "4px 8px",
    background: "#2a2a2a",
    border: "1px solid #444",
    borderRadius: 3,
    color: "#ddd",
    fontSize: 13,
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: "#888",
    marginBottom: 2,
    display: "block",
  };

  return (
    <div style={{
      width: 220,
      background: "#1a1a1a",
      borderLeft: "1px solid #333",
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      overflowY: "auto",
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>
        Properties
      </div>

      {!component ? (
        <div style={{ fontSize: 12, color: "#555" }}>
          {editingModule ? "Select a component to edit its properties" : "No module open"}
        </div>
      ) : (
        <>
          <div>
            <span style={labelStyle}>Type</span>
            <div style={{ fontSize: 13, color: "#ddd", textTransform: "capitalize" }}>
              {component.kind}
            </div>
          </div>

          <div>
            <span style={labelStyle}>Label</span>
            <input
              style={inputStyle}
              value={component.label}
              onChange={(e) => updateComponent(component.id, { label: e.target.value })}
              placeholder="Enter label..."
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Grid X</span>
              <div style={{ fontSize: 13, color: "#ddd" }}>{component.position.gridX}</div>
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Grid Y</span>
              <div style={{ fontSize: 13, color: "#ddd" }}>{component.position.gridY}</div>
            </div>
          </div>

          {/* LED option (jacks only) */}
          {component.kind === "jack" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={component.hasLed ?? false}
                onChange={(e) => updateComponent(component.id, { hasLed: e.target.checked })}
                id="led-toggle"
              />
              <label htmlFor="led-toggle" style={{ fontSize: 13, color: "#ddd", cursor: "pointer" }}>
                LED (left of jack)
              </label>
            </div>
          )}

          {/* LED count (buttons only) */}
          {component.kind === "button" && (
            <div>
              <span style={labelStyle}>LEDs Above</span>
              <select
                style={inputStyle}
                value={component.buttonLedCount ?? 0}
                onChange={(e) =>
                  updateComponent(component.id, {
                    buttonLedCount: parseInt(e.target.value) as 0 | 1 | 2 | 3,
                  })
                }
              >
                <option value={0}>None</option>
                <option value={1}>1 LED</option>
                <option value={2}>2 LEDs</option>
                <option value={3}>3 LEDs</option>
              </select>
            </div>
          )}

          {/* Label color dot */}
          <div>
            <span style={labelStyle}>Label Color</span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {([null, "yellow", "blue", "red", "green", "custom"] as const).map((color) => {
                const isActive = (component.labelColor ?? null) === color;
                const displayColor = color === null
                  ? "transparent"
                  : color === "custom"
                    ? component.labelColorCustom || "#fff"
                    : { yellow: "#fd0", blue: "#48f", red: "#f44", green: "#4d4" }[color];
                return (
                  <button
                    key={color ?? "none"}
                    onClick={() => updateComponent(component.id, { labelColor: color })}
                    title={color ?? "None"}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: isActive ? "2px solid #4af" : "1px solid #555",
                      background: displayColor,
                      cursor: "pointer",
                      padding: 0,
                      position: "relative",
                    }}
                  >
                    {color === null && (
                      <span style={{ fontSize: 10, color: "#666", lineHeight: "16px" }}>&ndash;</span>
                    )}
                  </button>
                );
              })}
            </div>
            {component.labelColor === "custom" && (
              <input
                style={{ ...inputStyle, marginTop: 4 }}
                type="color"
                value={component.labelColorCustom || "#ffffff"}
                onChange={(e) => updateComponent(component.id, { labelColorCustom: e.target.value })}
              />
            )}
          </div>

          <div>
            <span style={labelStyle}>Rotation</span>
            <select
              style={inputStyle}
              value={component.rotation}
              onChange={(e) =>
                updateComponent(component.id, {
                  rotation: parseInt(e.target.value) as 0 | 90 | 180 | 270,
                })
              }
            >
              <option value={0}>0°</option>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </div>

          <button
            onClick={() => removeComponent(component.id)}
            style={{
              padding: "6px 12px",
              background: "#522",
              color: "#faa",
              border: "1px solid #733",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              marginTop: 8,
            }}
          >
            Delete Component
          </button>
        </>
      )}

      {editingModule && (
        <div style={{ marginTop: "auto", borderTop: "1px solid #333", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#888" }}>Module</div>
          <div>
            <span style={labelStyle}>Name</span>
            <input
              style={inputStyle}
              value={editingModule.name}
              onChange={(e) => updateModuleName(e.target.value)}
            />
          </div>
          <div>
            <span style={labelStyle}>Width (HP)</span>
            <input
              style={inputStyle}
              type="number"
              value={editingModule.widthHP}
              onChange={(e) => updateModuleWidth(parseInt(e.target.value) || 1)}
              min={1}
            />
          </div>
          <div style={{ fontSize: 11, color: "#666" }}>
            {editingModule.components.length} components
          </div>
        </div>
      )}
    </div>
  );
}
