import { useState, useEffect, useRef } from "react";
import type { Module } from "../../models/types";
import {
  exportKicadProject,
  type KicadLibrarySettings,
} from "../../utils/exportKicadProject";
import { SidebarButton } from "./SidebarButton";

const STORAGE_KEY = "spaghetti-kicad-libs";

const EMPTY_SETTINGS: KicadLibrarySettings = {
  fpPot: "",
  fpJack: "",
  fpButton: "",
  fpLed: "",
  fpResistor: "",
  symPot: "",
  symJack: "",
  symButton: "",
  symLed: "",
  symResistor: "",
};

function loadSettings(): KicadLibrarySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...EMPTY_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return { ...EMPTY_SETTINGS };
}

const inputCls =
  "w-full px-2 py-1 bg-transparent border-none text-text text-[13px] outline-none placeholder:text-text-faint";
const thCls = "text-[11px] text-text-muted font-semibold text-left px-2 py-1.5 border-b border-border-light";
const tdLabelCls = "text-[12px] text-text-muted px-2 py-0 whitespace-nowrap border-b border-border-light";
const tdCls = "border-b border-border-light p-0";

const ROWS: { fp: keyof KicadLibrarySettings; sym: keyof KicadLibrarySettings; label: string; symEx: string; fpEx: string }[] = [
  { fp: "fpPot", sym: "symPot", label: "Pot", symEx: "e.g. Device:R_Potentiometer", fpEx: "e.g. mylib:Alpha_9mm" },
  { fp: "fpJack", sym: "symJack", label: "Jack", symEx: "e.g. Connector_Audio:AudioJack2_SwitchT", fpEx: "e.g. mylib:PJ398SM" },
  { fp: "fpButton", sym: "symButton", label: "Button", symEx: "e.g. Switch:SW_Push", fpEx: "e.g. mylib:SW_Tactile" },
  { fp: "fpLed", sym: "symLed", label: "LED", symEx: "e.g. Device:LED", fpEx: "e.g. LED_THT:LED_D3.0mm" },
  { fp: "fpResistor", sym: "symResistor", label: "Resistor", symEx: "e.g. Device:R", fpEx: "e.g. Resistor_THT:R_Axial_DIN0204" },
];

interface Props {
  module: Module;
  onClose: () => void;
}

export function KicadExportModal({ module, onClose }: Props) {
  const [settings, setSettings] = useState<KicadLibrarySettings>(loadSettings);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleExport = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    exportKicadProject(module, settings);
    onClose();
  };

  const allFilled = Object.values(settings).every((v) => v.trim() !== "");

  const set = (key: keyof KicadLibrarySettings, value: string) =>
    setSettings((s) => ({ ...s, [key]: value }));

  return (
    <div
      ref={backdropRef}
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40"
    >
      <div className="bg-surface-2 border border-border-light rounded-lg shadow-lg w-[480px] max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="px-4 pt-4 pb-2">
          <div className="text-[13px] font-semibold text-text">
            KiCad Export Settings
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            Library IDs must match your KiCad symbol and footprint library
            tables.
          </div>
        </div>

        <table className="mx-4 my-2 border-collapse bg-surface-3 rounded overflow-hidden">
          <thead>
            <tr>
              <th className={thCls} />
              <th className={thCls}>Symbol</th>
              <th className={thCls}>Footprint</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ fp, sym, label, symEx, fpEx }) => (
              <tr key={fp}>
                <td className={tdLabelCls}>{label}</td>
                <td className={`${tdCls} border-l border-border-light`}>
                  <input
                    className={inputCls}
                    value={settings[sym]}
                    onChange={(e) => set(sym, e.target.value)}
                    placeholder={symEx}
                    spellCheck={false}
                  />
                </td>
                <td className={`${tdCls} border-l border-border-light`}>
                  <input
                    className={inputCls}
                    value={settings[fp]}
                    onChange={(e) => set(fp, e.target.value)}
                    placeholder={fpEx}
                    spellCheck={false}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-4 py-3 flex gap-2 justify-end border-t border-border mt-1">
          <SidebarButton onClick={onClose}>Cancel</SidebarButton>
          <SidebarButton variant="accent" onClick={handleExport} disabled={!allFilled}>
            Export
          </SidebarButton>
        </div>
      </div>
    </div>
  );
}
