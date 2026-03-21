import { useState } from "react";
import { useAppStore } from "../../store";
import { gridToMm } from "../../utils/grid";
import { HP_WIDTH, PANEL_HEIGHT } from "../../constants/grid";
import { exportPanelKicad } from "../../utils/exportKicad";
import type { Module, PanelComponent } from "../../models/types";
import { SidebarButton } from "../ui/SidebarButton";

const JACK_HOLE_DIAMETER = 6.2;
const POT_HOLE_DIAMETER = 7.5;
const BUTTON_HOLE_DIAMETER = 5.2;
const LED_HOLE_DIAMETER = 3.4;

function exportPanelSvg(module: Module) {
  const width = module.widthHP * HP_WIDTH;
  const height = PANEL_HEIGHT;
  const holes: string[] = [];

  for (const comp of module.components) {
    const pos = gridToMm(comp.position);
    const labelText = comp.label
      ? `<text x="${pos.x.toFixed(3)}" y="${(pos.y - 3.5).toFixed(3)}" text-anchor="middle" font-size="2" font-family="sans-serif" fill="#555555">${comp.label}</text>`
      : "";

    if (comp.kind === "jack") {
      const r = (JACK_HOLE_DIAMETER / 2).toFixed(3);
      holes.push(
        `<circle cx="${pos.x.toFixed(3)}" cy="${pos.y.toFixed(3)}" r="${r}" fill="none" stroke="#cc0000" stroke-width="0.2"/>`,
      );
      if (labelText) holes.push(labelText);
      if (comp.hasLed) {
        holes.push(
          `<circle cx="${(pos.x - 6.35).toFixed(3)}" cy="${pos.y.toFixed(3)}" r="${(LED_HOLE_DIAMETER / 2).toFixed(3)}" fill="none" stroke="#cc0000" stroke-width="0.2"/>`,
        );
      }
    } else if (comp.kind === "pot") {
      const r = (POT_HOLE_DIAMETER / 2).toFixed(3);
      holes.push(
        `<circle cx="${pos.x.toFixed(3)}" cy="${pos.y.toFixed(3)}" r="${r}" fill="none" stroke="#cc0000" stroke-width="0.2"/>`,
      );
      if (labelText) holes.push(labelText);
    } else if (comp.kind === "button") {
      const buttonLeds = comp.buttonLedCount ?? 0;
      const hasLeds = buttonLeds > 0;
      const buttonY = hasLeds ? pos.y + 2.607 : pos.y;
      const r = (BUTTON_HOLE_DIAMETER / 2).toFixed(3);
      holes.push(
        `<circle cx="${pos.x.toFixed(3)}" cy="${buttonY.toFixed(3)}" r="${r}" fill="none" stroke="#cc0000" stroke-width="0.2"/>`,
      );
      if (comp.label) {
        holes.push(
          `<text x="${pos.x.toFixed(3)}" y="${(buttonY + 2 + 1.5 + 2).toFixed(3)}" text-anchor="middle" font-size="2" font-family="sans-serif" fill="#555555">${comp.label}</text>`,
        );
      }
      if (hasLeds) {
        const ledOffsets =
          buttonLeds === 1
            ? [0]
            : buttonLeds === 2
              ? [-2, 2]
              : [-5.08, 0, 5.08];
        for (const lx of ledOffsets) {
          holes.push(
            `<circle cx="${(pos.x + lx).toFixed(3)}" cy="${(pos.y - 5.73 + 2.607).toFixed(3)}" r="${(LED_HOLE_DIAMETER / 2).toFixed(3)}" fill="none" stroke="#cc0000" stroke-width="0.2"/>`,
          );
        }
      }
    }
  }

  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(3)} ${height}" width="${width.toFixed(3)}mm" height="${height}mm">`,
    `  <!-- Panel outline -->`,
    `  <rect x="0" y="0" width="${width.toFixed(3)}" height="${height}" fill="none" stroke="#000000" stroke-width="0.5"/>`,
    `  <!-- Drill holes (red = cut/drill) -->`,
    ...holes.map((h) => `  ${h}`),
    `</svg>`,
  ].join("\n");

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${module.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-panel.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

const inputCls =
  "w-full px-2 py-1 bg-surface-2 border border-border-light rounded text-text text-[13px] box-border";
const labelCls = "text-[11px] text-text-muted mb-0.5 block";

function TagsEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const tag = input.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput("");
  };

  return (
    <div>
      <span className={labelCls}>Tags</span>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-surface-3 rounded text-[11px] text-text-muted"
            >
              {tag}
              <button
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="bg-transparent border-none cursor-pointer p-0 text-text-dim text-[11px] leading-none hover:text-text"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className={inputCls}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag();
          }
          if (e.key === "Backspace" && !input && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        placeholder="Add tag..."
      />
    </div>
  );
}

/** Check if all items in array share the same value for a key */
function allSame<T>(items: T[], key: keyof T): boolean {
  if (items.length === 0) return true;
  const first = items[0][key];
  return items.every((item) => item[key] === first);
}

/** Get the shared value if all match, otherwise undefined */
function sharedValue<T, K extends keyof T>(
  items: T[],
  key: K,
): T[K] | undefined {
  if (items.length === 0 || !allSame(items, key)) return undefined;
  return items[0][key];
}

function SingleComponentEditor({
  component,
  editingModule,
}: {
  component: PanelComponent;
  editingModule: Module;
}) {
  const updateComponent = useAppStore((s) => s.updateComponent);
  const removeComponent = useAppStore((s) => s.removeComponent);

  return (
    <>
      <div>
        <span className={labelCls}>Type</span>
        <div className="text-[13px] text-text capitalize">{component.kind}</div>
      </div>

      <div>
        <span className={labelCls}>Label</span>
        <input
          className={inputCls}
          value={component.label}
          onChange={(e) =>
            updateComponent(component.id, { label: e.target.value })
          }
          placeholder="Enter label..."
        />
      </div>

      <div>
        <span className={labelCls}>Description</span>
        <textarea
          className={inputCls}
          value={component.description ?? ""}
          onChange={(e) =>
            updateComponent(component.id, {
              description: e.target.value || undefined,
            })
          }
          placeholder="Enter description..."
        />
      </div>

      <div>
        <span className={labelCls}>Ref (for audio code)</span>
        <input
          className={`${inputCls} ${
            component.ref &&
            editingModule.components.some(
              (c) => c.id !== component.id && c.ref && c.ref === component.ref,
            )
              ? "!border-[#f44]"
              : ""
          }`}
          value={component.ref ?? ""}
          onChange={(e) =>
            updateComponent(component.id, {
              ref: e.target.value || undefined,
            })
          }
          placeholder={component.label || "e.g. pitch"}
        />
        {component.ref &&
          editingModule.components.some(
            (c) => c.id !== component.id && c.ref && c.ref === component.ref,
          ) && (
            <div className="text-[11px] text-[#f44] mt-0.5">
              Duplicate ref — must be unique
            </div>
          )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <span className={labelCls}>Grid X</span>
          <div className="text-[13px] text-text">
            {component.position.gridX}
          </div>
        </div>
        <div className="flex-1">
          <span className={labelCls}>Grid Y</span>
          <div className="text-[13px] text-text">
            {component.position.gridY}
          </div>
        </div>
      </div>

      {component.kind === "jack" && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={component.hasLed ?? false}
            onChange={(e) =>
              updateComponent(component.id, { hasLed: e.target.checked })
            }
            id="led-toggle"
          />
          <label
            htmlFor="led-toggle"
            className="text-[13px] text-text cursor-pointer"
          >
            LED (left of jack)
          </label>
        </div>
      )}

      {component.kind === "jack" && (
        <>
          <div>
            <span className={labelCls}>Direction</span>
            <select
              className={inputCls}
              value={component.jackDirection ?? "both"}
              onChange={(e) =>
                updateComponent(component.id, {
                  jackDirection: e.target.value as
                    | "input"
                    | "output"
                    | "both"
                    | "headphones",
                })
              }
            >
              <option value="input">Input</option>
              <option value="output">Output</option>
              <option value="both">Both</option>
              <option value="headphones">Headphones</option>
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <span className={labelCls}>V Min</span>
              <input
                className={inputCls}
                type="number"
                value={component.voltageMin ?? -10}
                onChange={(e) =>
                  updateComponent(component.id, {
                    voltageMin: parseFloat(e.target.value),
                  })
                }
                step={0.5}
              />
            </div>
            <div className="flex-1">
              <span className={labelCls}>V Max</span>
              <input
                className={inputCls}
                type="number"
                value={component.voltageMax ?? 10}
                onChange={(e) =>
                  updateComponent(component.id, {
                    voltageMax: parseFloat(e.target.value),
                  })
                }
                step={0.5}
              />
            </div>
          </div>
        </>
      )}

      {component.kind === "button" && (
        <div>
          <span className={labelCls}>LEDs Above</span>
          <select
            className={inputCls}
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

      <LabelColorEditor
        components={[component]}
        onUpdate={(updates) => updateComponent(component.id, updates)}
      />

      <div>
        <span className={labelCls}>Rotation</span>
        <select
          className={inputCls}
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

      <SidebarButton
        variant="danger"
        onClick={() => removeComponent(component.id)}
        className="mt-2"
      >
        Delete Component
      </SidebarButton>
    </>
  );
}

function LabelColorEditor({
  components,
  onUpdate,
}: {
  components: PanelComponent[];
  onUpdate: (updates: Partial<PanelComponent>) => void;
}) {
  const currentColor = sharedValue(components, "labelColor");

  return (
    <div>
      <span className={labelCls}>Label Color</span>
      <div className="flex gap-1 items-center">
        {([null, "yellow", "blue", "red", "green", "custom"] as const).map(
          (color) => {
            const isActive =
              currentColor !== undefined && (currentColor ?? null) === color;
            const displayColor =
              color === null
                ? "transparent"
                : color === "custom"
                  ? components[0]?.labelColorCustom || "#fff"
                  : {
                      yellow: "#fd0",
                      blue: "#48f",
                      red: "#f44",
                      green: "#4d4",
                    }[color];
            return (
              <button
                key={color ?? "none"}
                onClick={() => onUpdate({ labelColor: color })}
                title={color ?? "None"}
                className="w-4.5 h-4.5 rounded-full cursor-pointer p-0 relative"
                style={{
                  border: isActive
                    ? "2px solid var(--color-accent)"
                    : "1px solid var(--color-border-light)",
                  background: displayColor,
                }}
              >
                {color === null && (
                  <span className="text-[10px] text-text-dim leading-4">
                    &ndash;
                  </span>
                )}
              </button>
            );
          },
        )}
      </div>
      {currentColor === "custom" && (
        <input
          className={`${inputCls} mt-1`}
          type="color"
          value={components[0]?.labelColorCustom || "#ffffff"}
          onChange={(e) => onUpdate({ labelColorCustom: e.target.value })}
        />
      )}
    </div>
  );
}

function MultiComponentEditor({
  components,
}: {
  components: PanelComponent[];
}) {
  const updateComponents = useAppStore((s) => s.updateComponents);
  const removeComponents = useAppStore((s) => s.removeComponents);
  const ids = components.map((c) => c.id);

  const kinds = new Set(components.map((c) => c.kind));
  const allJacks = kinds.size === 1 && kinds.has("jack");
  const allButtons = kinds.size === 1 && kinds.has("button");
  const allSameKind = kinds.size === 1;

  const applyUpdate = (updates: Partial<PanelComponent>) => {
    updateComponents(ids, updates);
  };

  return (
    <>
      <div>
        <span className={labelCls}>Selection</span>
        <div className="text-[13px] text-text">
          {components.length} components
          {allSameKind && (
            <span className="text-text-muted"> ({[...kinds][0]}s)</span>
          )}
        </div>
      </div>

      {/* Jack-specific bulk properties */}
      {allJacks && (
        <>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sharedValue(components, "hasLed") ?? false}
              onChange={(e) => applyUpdate({ hasLed: e.target.checked })}
              id="multi-led-toggle"
            />
            <label
              htmlFor="multi-led-toggle"
              className="text-[13px] text-text cursor-pointer"
            >
              LED (left of jack)
            </label>
          </div>

          <div>
            <span className={labelCls}>Direction</span>
            <select
              className={inputCls}
              value={sharedValue(components, "jackDirection") ?? ""}
              onChange={(e) =>
                applyUpdate({
                  jackDirection: e.target.value as
                    | "input"
                    | "output"
                    | "both"
                    | "headphones",
                })
              }
            >
              {sharedValue(components, "jackDirection") === undefined && (
                <option value="">Mixed</option>
              )}
              <option value="input">Input</option>
              <option value="output">Output</option>
              <option value="both">Both</option>
              <option value="headphones">Headphones</option>
            </select>
          </div>
        </>
      )}

      {/* Button-specific bulk properties */}
      {allButtons && (
        <div>
          <span className={labelCls}>LEDs Above</span>
          <select
            className={inputCls}
            value={sharedValue(components, "buttonLedCount") ?? ""}
            onChange={(e) =>
              applyUpdate({
                buttonLedCount: parseInt(e.target.value) as 0 | 1 | 2 | 3,
              })
            }
          >
            {sharedValue(components, "buttonLedCount") === undefined && (
              <option value="">Mixed</option>
            )}
            <option value={0}>None</option>
            <option value={1}>1 LED</option>
            <option value={2}>2 LEDs</option>
            <option value={3}>3 LEDs</option>
          </select>
        </div>
      )}

      {/* Common properties for all component types */}
      <LabelColorEditor components={components} onUpdate={applyUpdate} />

      <div>
        <span className={labelCls}>Rotation</span>
        <select
          className={inputCls}
          value={sharedValue(components, "rotation") ?? ""}
          onChange={(e) =>
            applyUpdate({
              rotation: parseInt(e.target.value) as 0 | 90 | 180 | 270,
            })
          }
        >
          {sharedValue(components, "rotation") === undefined && (
            <option value="">Mixed</option>
          )}
          <option value={0}>0°</option>
          <option value={90}>90°</option>
          <option value={180}>180°</option>
          <option value={270}>270°</option>
        </select>
      </div>

      <SidebarButton
        variant="danger"
        onClick={() => removeComponents(ids)}
        className="mt-2"
      >
        Delete {components.length} Components
      </SidebarButton>
    </>
  );
}

export function PropertyEditor() {
  const editingModule = useAppStore((s) => s.editingModule);
  const selectedId = useAppStore((s) => s.selectedComponentId);
  const selectedIds = useAppStore((s) => s.selectedComponentIds);
  const selectedConnectionId = useAppStore((s) => s.selectedConnectionId);
  const updateConnection = useAppStore((s) => s.updateConnection);
  const removeConnection = useAppStore((s) => s.removeConnection);
  const selectedRectId = useAppStore((s) => s.selectedRectId);
  const updateRect = useAppStore((s) => s.updateRect);
  const removeRect = useAppStore((s) => s.removeRect);
  const updateModuleName = useAppStore((s) => s.updateModuleName);
  const updateModuleWidth = useAppStore((s) => s.updateModuleWidth);
  const updateModuleTags = useAppStore((s) => s.updateModuleTags);

  const singleComponent = editingModule?.components.find(
    (c) => c.id === selectedId,
  );
  const multiComponents =
    selectedIds.length > 1
      ? (editingModule?.components.filter((c) => selectedIds.includes(c.id)) ??
        [])
      : [];
  const connection = editingModule?.connections?.find(
    (c) => c.id === selectedConnectionId,
  );
  const rect = editingModule?.rects?.find((r) => r.id === selectedRectId);

  return (
    <div className="w-55 bg-surface-1 border-l border-border p-3 flex flex-col gap-3 overflow-y-auto">
      <div className="text-[13px] font-semibold text-text-muted uppercase tracking-wide">
        Properties
      </div>

      {rect ? (
        <>
          <div>
            <span className={labelCls}>Type</span>
            <div className="text-[13px] text-text">Rectangle</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rect-dotted"
              checked={rect.dotted ?? false}
              onChange={(e) => updateRect(rect.id, { dotted: e.target.checked })}
            />
            <label htmlFor="rect-dotted" className="text-[13px] text-text cursor-pointer">Dotted</label>
          </div>
          <div>
            <span className={labelCls}>Drop Shadow (mm)</span>
            <input
              className={inputCls}
              type="number"
              value={rect.shadowOffset ?? 0}
              onChange={(e) => updateRect(rect.id, { shadowOffset: parseFloat(e.target.value) || 0 })}
              step={0.5}
              min={0}
            />
          </div>
          <SidebarButton variant="danger" onClick={() => removeRect(rect.id)} className="mt-2">
            Delete Rectangle
          </SidebarButton>
        </>
      ) : connection ? (
        <>
          <div>
            <span className={labelCls}>Type</span>
            <div className="text-[13px] text-text capitalize">
              {connection.kind}
            </div>
          </div>

          <div>
            <span className={labelCls}>Label</span>
            <input
              className={inputCls}
              value={connection.label ?? ""}
              onChange={(e) =>
                updateConnection(connection.id, {
                  label: e.target.value || undefined,
                })
              }
              placeholder="Enter label..."
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <span className={labelCls}>Start Offset (mm)</span>
              <input
                className={inputCls}
                type="number"
                value={connection.startOffset ?? 0}
                onChange={(e) =>
                  updateConnection(connection.id, {
                    startOffset: parseFloat(e.target.value) || 0,
                  })
                }
                step={0.5}
                min={0}
              />
            </div>
            <div className="flex-1">
              <span className={labelCls}>End Offset (mm)</span>
              <input
                className={inputCls}
                type="number"
                value={connection.endOffset ?? 0}
                onChange={(e) =>
                  updateConnection(connection.id, {
                    endOffset: parseFloat(e.target.value) || 0,
                  })
                }
                step={0.5}
                min={0}
              />
            </div>
          </div>

          <SidebarButton
            variant="danger"
            onClick={() => removeConnection(connection.id)}
            className="mt-2"
          >
            Delete Connection
          </SidebarButton>
        </>
      ) : multiComponents.length > 1 ? (
        <MultiComponentEditor components={multiComponents} />
      ) : singleComponent && editingModule ? (
        <SingleComponentEditor
          component={singleComponent}
          editingModule={editingModule}
        />
      ) : (
        <div className="text-xs text-text-faint">
          {editingModule
            ? "Select a component to edit its properties"
            : "No module open"}
        </div>
      )}

      {editingModule && (
        <div className="mt-auto border-t border-border pt-3 flex flex-col gap-2">
          <div className="text-[11px] text-text-muted">Module</div>
          <div>
            <span className={labelCls}>Name</span>
            <input
              className={inputCls}
              value={editingModule.name}
              onChange={(e) => updateModuleName(e.target.value)}
            />
          </div>
          <div>
            <span className={labelCls}>Width (HP)</span>
            <input
              className={inputCls}
              type="number"
              value={editingModule.widthHP}
              onChange={(e) => updateModuleWidth(parseInt(e.target.value) || 1)}
              min={1}
            />
          </div>
          <TagsEditor
            tags={editingModule.tags ?? []}
            onChange={(tags) => updateModuleTags(tags)}
          />
          <div className="text-[11px] text-text-dim">
            {editingModule.components.length} components
          </div>
          <SidebarButton
            onClick={() => {
              navigator.clipboard.writeText(
                JSON.stringify(editingModule, null, 2),
              );
            }}
          >
            Copy to Clipboard
          </SidebarButton>
          <SidebarButton onClick={() => exportPanelSvg(editingModule)}>
            Export Panel SVG
          </SidebarButton>
          <SidebarButton onClick={() => exportPanelKicad(editingModule)}>
            Export KiCad PCB
          </SidebarButton>
        </div>
      )}
    </div>
  );
}
