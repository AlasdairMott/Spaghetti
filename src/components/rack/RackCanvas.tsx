import { useRef, useState, useCallback, useEffect } from "react";
import { useAppStore } from "../../store";
import {
  PANEL_HEIGHT,
  HP_WIDTH,
  GRID_Y,
  GRID_Y_OFFSET,
} from "../../constants/grid";
import { screenToSvg } from "../../utils/svg";
import { gridToMm } from "../../utils/grid";
import { detectIsTrackpad } from "../../utils/wheelDetect";
import { JackShape } from "../designer/shapes/JackShape";
import { PotShape } from "../designer/shapes/PotShape";
import { ButtonShape } from "../designer/shapes/ButtonShape";
import { LedShape } from "../designer/shapes/LedShape";
import { ComponentLabel } from "../designer/ComponentLabel";
import { RenderModeToggle } from "../layout/RenderModeToggle";
import { WireLayer, PreviewWire } from "./WireLayer";
import { ModuleSearchPopup } from "../ui/ModuleSearchPopup";
import type { RackWireEndpoint } from "../../models/types";

const ROW_GAP = 5;
const RAIL_HEIGHT = 3;
const EDGE_INSET = 2;
const JACK_HIT_RADIUS = 4;

interface DragState {
  placementId: string;
  moduleId: string;
  offsetHP: number;
  startHP: number;
  startRow: number;
  isMulti: boolean;
}

interface KnobDragState {
  placementId: string;
  componentId: string;
  startY: number;
  startAngle: number;
}

interface WireDragState {
  wireId: string;
  /** Which end is being dragged */
  dragEnd: "from" | "to";
  /** The fixed (non-dragged) endpoint position */
  anchorPos: { x: number; y: number };
  /** The fixed endpoint */
  anchorEndpoint: RackWireEndpoint;
  /** Wire color */
  color: string;
}

interface RackCanvasProps {
  onKnobChange?: (
    placementId: string,
    componentId: string,
    angle: number,
  ) => void;
  onButtonToggle?: (
    placementId: string,
    componentId: string,
    pressed: boolean,
  ) => void;
}

export function RackCanvas({ onKnobChange, onButtonToggle }: RackCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rack = useAppStore((s) => s.rack);
  const modules = useAppStore((s) => s.modules);
  const placeModule = useAppStore((s) => s.placeModule);
  const removeFromRack = useAppStore((s) => s.removeFromRack);
  const moveInRack = useAppStore((s) => s.moveInRack);
  const batchMoveInRack = useAppStore((s) => s.batchMoveInRack);
  const addWire = useAppStore((s) => s.addWire);
  const removeWire = useAppStore((s) => s.removeWire);
  const selectWires = useAppStore((s) => s.selectWires);
  const selectedWireIds = useAppStore((s) => s.selectedWireIds);
  const selectedPlacementIds = useAppStore((s) => s.selectedPlacementIds);
  const selectPlacements = useAppStore((s) => s.selectPlacements);
  const setKnobAngle = useAppStore((s) => s.setKnobAngle);
  const toggleButton = useAppStore((s) => s.toggleButton);
  const updateWireEndpoint = useAppStore((s) => s.updateWireEndpoint);
  const openModuleForEditing = useAppStore((s) => s.openModuleForEditing);
  const setMode = useAppStore((s) => s.setMode);
  const renderMode = useAppStore((s) => s.renderMode);
  const theme = useAppStore((s) => s.theme);
  const isLight = theme === "light";
  const isRendered = renderMode === "rendered";
  const panelBg = isRendered ? "#E7E0D8" : isLight ? "#e8e4e0" : "#222";
  const lineColor = isRendered ? "#231F20" : isLight ? "#555" : "#444";
  const textColor = isRendered ? "#231F20" : isLight ? "#444" : "#777";
  const rackBg = isLight ? "#d0ccc8" : "#252525";
  const railColor = isLight ? "#aaa" : "#555";
  const railTickColor = isLight ? "#999" : "#777";
  const emptyRowBg = isLight ? "#ddd8d4" : "#1a1a1a";
  const emptyRowStroke = isLight ? "#c0bcb8" : "#333";
  const panelStroke = isLight ? "#b0acaa" : "#959495";
  const compStroke = isLight ? "#555" : "#888";
  const topLineY = GRID_Y_OFFSET + GRID_Y * 0.75;
  const bottomRowCount = Math.floor((PANEL_HEIGHT - GRID_Y_OFFSET) / GRID_Y);
  const bottomLineY = GRID_Y_OFFSET + bottomRowCount * GRID_Y - GRID_Y * 0.75;

  // Pan / zoom — use refs as source of truth, sync to state once per frame
  const savedRackView = useAppStore((s) => s.rackView);
  const setRackView = useAppStore((s) => s.setRackView);
  const [view, setView] = useState(
    () => savedRackView ?? { zoom: 1, panX: 0, panY: 0 },
  );
  const viewRef = useRef(view);

  // Save rack view on unmount
  useEffect(() => {
    return () => {
      setRackView(viewRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rafId = useRef(0);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffsetStart = useRef({ x: 0, y: 0 });

  const scheduleViewUpdate = useCallback(
    (next: { zoom: number; panX: number; panY: number }) => {
      viewRef.current = next;
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = 0;
          setView(viewRef.current);
        });
      }
    },
    [],
  );

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;

      if (e.ctrlKey) {
        // Trackpad pinch-to-zoom (macOS fires wheel + ctrlKey for pinch gestures)
        const pt = screenToSvg(el, e.clientX, e.clientY);
        const factor = Math.pow(2, -e.deltaY * 0.01);
        const newZoom = Math.max(0.2, Math.min(10, v.zoom * factor));
        scheduleViewUpdate({
          zoom: newZoom,
          panX: pt.x - (pt.x - v.panX) * (v.zoom / newZoom),
          panY: pt.y - (pt.y - v.panY) * (v.zoom / newZoom),
        });
      } else if (detectIsTrackpad(e)) {
        // Trackpad two-finger scroll → pan
        const ctm = el.getScreenCTM();
        if (!ctm) return;
        scheduleViewUpdate({
          zoom: v.zoom,
          panX: v.panX + e.deltaX / ctm.a,
          panY: v.panY + e.deltaY / ctm.d,
        });
      } else {
        // Mouse scroll wheel → zoom
        const pt = screenToSvg(el, e.clientX, e.clientY);
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newZoom = Math.max(0.2, Math.min(10, v.zoom * factor));
        scheduleViewUpdate({
          zoom: newZoom,
          panX: pt.x - (pt.x - v.panX) * (v.zoom / newZoom),
          panY: pt.y - (pt.y - v.panY) * (v.zoom / newZoom),
        });
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [scheduleViewUpdate]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragPreviewHP, setDragPreviewHP] = useState<number>(0);
  const [dragPreviewRow, setDragPreviewRow] = useState<number>(0);

  // Library drag preview (dragging from sidebar into rack)
  const [libDrag, setLibDrag] = useState<{
    moduleId: string;
    hp: number;
    row: number;
  } | null>(null);
  const [wireStart, setWireStart] = useState<RackWireEndpoint | null>(null);
  const [wirePreviewEnd, setWirePreviewEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [knobDrag, setKnobDrag] = useState<KnobDragState | null>(null);
  const knobDragAngleRef = useRef<number>(150);

  const didDragRef = useRef(false);
  const pointerDownShiftRef = useRef(false);
  const [hoveredJack, setHoveredJack] = useState<{
    placementId: string;
    componentId: string;
  } | null>(null);
  const [wireDrag, setWireDrag] = useState<WireDragState | null>(null);
  const [wireDragEnd, setWireDragEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Marquee selection
  const isMarqueeing = useRef(false);
  const marqueeStartRef = useRef({ x: 0, y: 0 });
  const marqueeBoundsRef = useRef<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [marqueeBounds, setMarqueeBounds] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  // Module search popup (double-click to add)
  const [searchPopup, setSearchPopup] = useState<{
    screenX: number;
    screenY: number;
    svgX: number;
    svgY: number;
  } | null>(null);

  const rackWidthMm = rack.widthHP * HP_WIDTH;
  const rowHeight = PANEL_HEIGHT + RAIL_HEIGHT * 2 + ROW_GAP;
  const totalHeight = rack.rows * rowHeight;
  const padding = 10;

  const resolveEndpointPos = useCallback(
    (ep: RackWireEndpoint): { x: number; y: number } | null => {
      const placement = rack.placements.find((p) => p.id === ep.placementId);
      if (!placement) return null;
      const mod = modules.find((m) => m.id === placement.moduleId);
      if (!mod) return null;
      const comp = mod.components.find((c) => c.id === ep.componentId);
      if (!comp) return null;
      const mm = gridToMm(comp.position);
      const modX = placement.positionHP * HP_WIDTH;
      const rowY = placement.row * rowHeight + RAIL_HEIGHT;
      return { x: modX + mm.x, y: rowY + mm.y };
    },
    [rack.placements, modules, rowHeight],
  );

  const wireStartPos = wireStart ? resolveEndpointPos(wireStart) : null;

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") {
        if (wireDrag) {
          setWireDrag(null);
          setWireDragEnd(null);
          return;
        }
        setWireStart(null);
        setWirePreviewEnd(null);
        selectWires([]);
        selectPlacements([]);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedWireIds.length > 0) {
          for (const id of selectedWireIds) removeWire(id);
          selectWires([]);
        }
        if (selectedPlacementIds.length > 0) {
          for (const id of selectedPlacementIds) removeFromRack(id);
          selectPlacements([]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedWireIds,
    removeWire,
    selectWires,
    selectPlacements,
    selectedPlacementIds,
    removeFromRack,
    wireDrag,
  ]);

  const findNearestJack = useCallback(
    (svgX: number, svgY: number): RackWireEndpoint | null => {
      let closest: RackWireEndpoint | null = null;
      let closestDist = JACK_HIT_RADIUS;
      for (const placement of rack.placements) {
        const mod = modules.find((m) => m.id === placement.moduleId);
        if (!mod) continue;
        const modX = placement.positionHP * HP_WIDTH;
        const rowY = placement.row * rowHeight + RAIL_HEIGHT;
        for (const comp of mod.components) {
          if (comp.kind !== "jack") continue;
          const mm = gridToMm(comp.position);
          const dist = Math.hypot(svgX - (modX + mm.x), svgY - (rowY + mm.y));
          if (dist < closestDist) {
            closestDist = dist;
            closest = { placementId: placement.id, componentId: comp.id };
          }
        }
      }
      return closest;
    },
    [rack.placements, modules, rowHeight],
  );

  const getModuleIdFromTypes = (types: readonly string[]) => {
    const t = types.find((s) => s.startsWith("moduleid/"));
    return t ? t.slice("moduleid/".length) : null;
  };

  const handleDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;
    let moduleId = libDrag?.moduleId ?? null;
    if (!moduleId) {
      moduleId = getModuleIdFromTypes(e.dataTransfer.types);
      if (!moduleId) return;
    }
    const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
    const row = Math.max(
      0,
      Math.min(rack.rows - 1, Math.floor(pt.y / rowHeight)),
    );
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const hp = Math.max(
      0,
      Math.min(Math.round(pt.x / HP_WIDTH), rack.widthHP - mod.widthHP),
    );
    if (!libDrag || hp !== libDrag.hp || row !== libDrag.row) {
      setLibDrag({ moduleId, hp, row });
    }
  };

  const handleDragLeave = (e: React.DragEvent<SVGSVGElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setLibDrag(null);
    }
  };

  const handleDrop = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    setLibDrag(null);
    const moduleId = e.dataTransfer.getData("moduleId");
    if (!moduleId || !svgRef.current) return;
    const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
    const row = Math.floor(pt.y / rowHeight);
    if (row < 0 || row >= rack.rows) return;
    const hpPos = Math.round(pt.x / HP_WIDTH);
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    placeModule(
      moduleId,
      Math.max(0, Math.min(hpPos, rack.widthHP - mod.widthHP)),
      row,
    );
  };

  // Check if a library drag preview would overlap existing modules
  const libDragOverlaps = (() => {
    if (!libDrag) return false;
    const mod = modules.find((m) => m.id === libDrag.moduleId);
    if (!mod) return false;
    const newLeft = libDrag.hp;
    const newRight = newLeft + mod.widthHP;
    if (newLeft < 0 || newRight > rack.widthHP) return true;
    for (const p of rack.placements) {
      if (p.row !== libDrag.row) continue;
      const pMod = modules.find((m) => m.id === p.moduleId);
      if (!pMod) continue;
      const left = p.positionHP;
      const right = left + pMod.widthHP;
      if (newLeft < right && newRight > left) return true;
    }
    return false;
  })();

  const handleModulePointerDown = useCallback(
    (
      e: React.PointerEvent<SVGElement>,
      placementId: string,
      moduleId: string,
      positionHP: number,
      row: number,
    ) => {
      if (e.button !== 0 || !svgRef.current) return;
      e.stopPropagation();
      didDragRef.current = false;
      pointerDownShiftRef.current = e.shiftKey;
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      const curSelected = useAppStore.getState().selectedPlacementIds;
      const isAlreadySelected = curSelected.includes(placementId);
      const isMulti = isAlreadySelected && curSelected.length > 1 && !e.shiftKey;
      setDrag({
        placementId,
        moduleId,
        offsetHP: pt.x / HP_WIDTH - positionHP,
        startHP: positionHP,
        startRow: row,
        isMulti,
      });
      setDragPreviewHP(positionHP);
      setDragPreviewRow(row);
      (e.target as SVGElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handleJackPointerDown = useCallback(
    (
      e: React.PointerEvent<SVGElement>,
      placementId: string,
      componentId: string,
    ) => {
      if (e.button !== 0 || !svgRef.current) return;
      e.stopPropagation();

      const endpoint: RackWireEndpoint = { placementId, componentId };
      const pt = screenToSvg(svgRef.current!, e.clientX, e.clientY);

      // Check if this jack already has a wire — if so, start endpoint drag
      const state = useAppStore.getState();
      const wires = state.rack.wires ?? [];
      for (const wire of wires) {
        for (const end of ["from", "to"] as const) {
          const ep = wire[end];
          if (
            ep.placementId === placementId &&
            ep.componentId === componentId
          ) {
            const otherEnd = end === "from" ? "to" : "from";
            const anchorPos = resolveEndpointPos(wire[otherEnd]);
            if (anchorPos) {
              setWireDrag({
                wireId: wire.id,
                dragEnd: end,
                anchorPos,
                anchorEndpoint: wire[otherEnd],
                color: wire.color,
              });
              setWireDragEnd({ x: pt.x, y: pt.y });
              (e.target as SVGElement).setPointerCapture(e.pointerId);
              return;
            }
          }
        }
      }

      // Start a new wire — drag to destination jack and release
      setWireStart(endpoint);
      setWirePreviewEnd({ x: pt.x, y: pt.y });
      (e.target as SVGElement).setPointerCapture(e.pointerId);
    },
    [resolveEndpointPos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (drag && svgRef.current) {
        const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
        const mod = modules.find((m) => m.id === drag.moduleId);
        if (!mod) return;
        const newHP = Math.max(
          0,
          Math.min(
            Math.round(pt.x / HP_WIDTH - drag.offsetHP),
            rack.widthHP - mod.widthHP,
          ),
        );
        // Compute target row from Y position
        const newRow = Math.max(
          0,
          Math.min(rack.rows - 1, Math.floor(pt.y / rowHeight)),
        );
        if (newHP !== dragPreviewHP || newRow !== dragPreviewRow)
          didDragRef.current = true;
        setDragPreviewHP(newHP);
        setDragPreviewRow(newRow);
      }
      if (wireStart && svgRef.current) {
        const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
        setWirePreviewEnd({ x: pt.x, y: pt.y });
        const nearest = findNearestJack(pt.x, pt.y);
        setHoveredJack(nearest);
      }
      if (wireDrag && svgRef.current) {
        const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
        setWireDragEnd({ x: pt.x, y: pt.y });
        const nearest = findNearestJack(pt.x, pt.y);
        setHoveredJack(nearest);
      }
      if (knobDrag) {
        const deltaY = knobDrag.startY - e.clientY;
        const newAngle = Math.max(
          0,
          Math.min(300, knobDrag.startAngle + deltaY * 1.5),
        );
        knobDragAngleRef.current = newAngle;
        onKnobChange?.(knobDrag.placementId, knobDrag.componentId, newAngle);
        setKnobAngle(knobDrag.placementId, knobDrag.componentId, newAngle);
      }
      // Update hover when not dragging anything
      if (!drag && !wireStart && !wireDrag && !knobDrag && svgRef.current) {
        const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
        const nearest = findNearestJack(pt.x, pt.y);
        setHoveredJack(nearest);
      }
    },
    [
      drag,
      dragPreviewHP,
      dragPreviewRow,
      modules,
      rack.widthHP,
      rack.rows,
      rowHeight,
      wireStart,
      knobDrag,
      onKnobChange,
      setKnobAngle,
      wireDrag,
      findNearestJack,
    ],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (drag) {
        if (didDragRef.current) {
          if (drag.isMulti) {
            const deltaHP = dragPreviewHP - drag.startHP;
            const deltaRow = dragPreviewRow - drag.startRow;
            const state = useAppStore.getState();
            const moves = state.selectedPlacementIds
              .map((id) => {
                const p = state.rack.placements.find((pl) => pl.id === id);
                if (!p) return null;
                return { placementId: id, positionHP: p.positionHP + deltaHP, row: p.row + deltaRow };
              })
              .filter((m): m is NonNullable<typeof m> => m !== null);
            batchMoveInRack(moves);
          } else {
            moveInRack(drag.placementId, dragPreviewHP, dragPreviewRow);
          }
        } else {
          // Click without drag — select/deselect the module, cancel any wire in progress
          const pid = drag.placementId;
          setWireStart(null);
          setWirePreviewEnd(null);
          if (pointerDownShiftRef.current) {
            const cur = useAppStore.getState().selectedPlacementIds;
            if (cur.includes(pid)) {
              selectPlacements(cur.filter((id) => id !== pid));
            } else {
              selectPlacements([...cur, pid]);
            }
          } else {
            selectPlacements([pid]);
          }
        }
        setDrag(null);
        return;
      }
      if (knobDrag) {
        setKnobDrag(null);
        return;
      }
      if (wireDrag && svgRef.current) {
        const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
        const jack = findNearestJack(pt.x, pt.y);
        if (jack) {
          const anchor = wireDrag.anchorEndpoint;
          if (
            jack.placementId !== anchor.placementId ||
            jack.componentId !== anchor.componentId
          ) {
            updateWireEndpoint(wireDrag.wireId, wireDrag.dragEnd, jack);
          }
        }
        setWireDrag(null);
        setWireDragEnd(null);
        setHoveredJack(null);
        return;
      }
      // Wire drag released — complete or cancel
      if (wireStart && svgRef.current) {
        const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
        const jack = findNearestJack(pt.x, pt.y);
        if (
          jack &&
          !(
            jack.placementId === wireStart.placementId &&
            jack.componentId === wireStart.componentId
          )
        ) {
          addWire(wireStart, jack);
        }
        setWireStart(null);
        setWirePreviewEnd(null);
        setHoveredJack(null);
        return;
      }
      // Background click — clear all selection
      selectWires([]);
      selectPlacements([]);
    },
    [
      drag,
      dragPreviewHP,
      dragPreviewRow,
      moveInRack,
      batchMoveInRack,
      knobDrag,
      selectWires,
      selectPlacements,
      wireDrag,
      updateWireEndpoint,
      findNearestJack,
      wireStart,
      addWire,
    ],
  );

  const handlePotPointerDown = useCallback(
    (
      e: React.PointerEvent<SVGElement>,
      placementId: string,
      componentId: string,
    ) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const knobStates = rack.knobStates ?? [];
      const existing = knobStates.find(
        (k) => k.placementId === placementId && k.componentId === componentId,
      );
      const startAngle = existing?.angle ?? 150;
      knobDragAngleRef.current = startAngle;

      setKnobDrag({ placementId, componentId, startY: e.clientY, startAngle });
      (e.target as SVGElement).setPointerCapture(e.pointerId);
    },
    [rack.knobStates],
  );

  const getKnobAngle = useCallback(
    (placementId: string, componentId: string): number => {
      const knobStates = rack.knobStates ?? [];
      return (
        knobStates.find(
          (k) => k.placementId === placementId && k.componentId === componentId,
        )?.angle ?? 150
      );
    },
    [rack.knobStates],
  );

  const isButtonPressed = useCallback(
    (placementId: string, componentId: string): boolean => {
      const buttonStates = rack.buttonStates ?? [];
      return (
        buttonStates.find(
          (b) => b.placementId === placementId && b.componentId === componentId,
        )?.pressed ?? false
      );
    },
    [rack.buttonStates],
  );

  const cursor =
    wireStart || wireDrag ? "crosshair" : knobDrag ? "ns-resize" : "default";

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ position: "relative", flex: 1, display: "flex" }}>
        <RenderModeToggle />
        <svg
          ref={svgRef}
          viewBox={`${view.panX - padding / view.zoom} ${view.panY - padding / view.zoom} ${(rackWidthMm + padding * 2) / view.zoom} ${(totalHeight + padding * 2) / view.zoom}`}
          style={{ flex: 1, background: rackBg, display: "block", cursor }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDoubleClick={(e) => {
            if (!svgRef.current) return;
            const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
            setSearchPopup({
              screenX: e.clientX,
              screenY: e.clientY,
              svgX: pt.x,
              svgY: pt.y,
            });
          }}
          onPointerDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              isPanning.current = true;
              panStart.current = { x: e.clientX, y: e.clientY };
              panOffsetStart.current = {
                x: viewRef.current.panX,
                y: viewRef.current.panY,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            } else if (
              e.button === 0 &&
              svgRef.current &&
              (e.target === e.currentTarget ||
                (e.target as Element).getAttribute("data-bg") === "true")
            ) {
              const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
              isMarqueeing.current = true;
              marqueeStartRef.current = pt;
              const bounds = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
              marqueeBoundsRef.current = bounds;
              setMarqueeBounds(bounds);
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }}
          onPointerMove={(e) => {
            if (isPanning.current) {
              const ctm = e.currentTarget.getScreenCTM();
              if (ctm) {
                const v = viewRef.current;
                scheduleViewUpdate({
                  zoom: v.zoom,
                  panX:
                    panOffsetStart.current.x -
                    (e.clientX - panStart.current.x) / ctm.a,
                  panY:
                    panOffsetStart.current.y -
                    (e.clientY - panStart.current.y) / ctm.d,
                });
              }
              return;
            }
            if (isMarqueeing.current && svgRef.current) {
              const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
              const { x: sx, y: sy } = marqueeStartRef.current;
              const bounds = {
                x1: Math.min(sx, pt.x),
                y1: Math.min(sy, pt.y),
                x2: Math.max(sx, pt.x),
                y2: Math.max(sy, pt.y),
              };
              marqueeBoundsRef.current = bounds;
              setMarqueeBounds(bounds);
              return;
            }
            handlePointerMove(e);
          }}
          onPointerUp={(e) => {
            if (e.button === 1) {
              isPanning.current = false;
              e.currentTarget.releasePointerCapture(e.pointerId);
              return;
            }
            if (isMarqueeing.current) {
              isMarqueeing.current = false;
              const mb = marqueeBoundsRef.current;
              marqueeBoundsRef.current = null;
              setMarqueeBounds(null);
              if (mb && (mb.x2 - mb.x1 > 2 || mb.y2 - mb.y1 > 2)) {
                const ids = rack.placements
                  .filter((p) => {
                    const mod = modules.find((m) => m.id === p.moduleId);
                    if (!mod) return false;
                    const px = p.positionHP * HP_WIDTH;
                    const py = p.row * rowHeight + RAIL_HEIGHT;
                    const pw = mod.widthHP * HP_WIDTH;
                    return (
                      px < mb.x2 &&
                      px + pw > mb.x1 &&
                      py < mb.y2 &&
                      py + PANEL_HEIGHT > mb.y1
                    );
                  })
                  .map((p) => p.id);
                selectPlacements(ids);
                if (ids.length > 0) selectWires([]);
              } else {
                selectWires([]);
                selectPlacements([]);
              }
              return;
            }
            handlePointerUp(e);
          }}
        >
          {Array.from({ length: rack.rows }, (_, row) => {
            const rowY = row * rowHeight;
            return (
              <g key={row} transform={`translate(0, ${rowY})`}>
                <rect
                  x={0}
                  y={0}
                  width={rackWidthMm}
                  height={RAIL_HEIGHT}
                  fill={railColor}
                  rx={0.5}
                  data-bg="true"
                />
                <rect
                  x={0}
                  y={RAIL_HEIGHT}
                  width={rackWidthMm}
                  height={PANEL_HEIGHT}
                  fill={emptyRowBg}
                  stroke={emptyRowStroke}
                  strokeWidth={0.3}
                  data-bg="true"
                />
                <rect
                  x={0}
                  y={RAIL_HEIGHT + PANEL_HEIGHT}
                  width={rackWidthMm}
                  height={RAIL_HEIGHT}
                  fill={railColor}
                  rx={0.5}
                  data-bg="true"
                />
                {Array.from({ length: rack.widthHP + 1 }, (_, hp) => (
                  <line
                    key={hp}
                    x1={hp * HP_WIDTH}
                    y1={0}
                    x2={hp * HP_WIDTH}
                    y2={RAIL_HEIGHT}
                    stroke={railTickColor}
                    strokeWidth={0.2}
                  />
                ))}

                {rack.placements
                  .filter((p) => {
                    const isDraggingThis = drag?.placementId === p.id;
                    const isMultiDragging = drag?.isMulti && selectedPlacementIds.includes(p.id) && p.id !== drag.placementId;
                    if (isDraggingThis) return dragPreviewRow === row;
                    if (isMultiDragging) return p.row + (dragPreviewRow - drag!.startRow) === row;
                    return p.row === row;
                  })
                  .map((placement) => {
                    const mod = modules.find(
                      (m) => m.id === placement.moduleId,
                    );
                    if (!mod) return null;
                    const isDragging = drag?.placementId === placement.id;
                    const isMultiDragging = drag?.isMulti && selectedPlacementIds.includes(placement.id) && !isDragging;
                    const isSelected = selectedPlacementIds.includes(
                      placement.id,
                    );
                    const displayHP = isDragging
                      ? dragPreviewHP
                      : isMultiDragging
                        ? placement.positionHP + (dragPreviewHP - drag!.startHP)
                        : placement.positionHP;
                    const modX = displayHP * HP_WIDTH;
                    const modWidth = mod.widthHP * HP_WIDTH;
                    return (
                      <g
                        key={placement.id}
                        transform={`translate(${modX}, ${RAIL_HEIGHT})`}
                        opacity={isDragging || isMultiDragging ? 0.7 : 1}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          openModuleForEditing(mod);
                          setMode("designer");
                        }}
                        onPointerDown={(e) =>
                          handleModulePointerDown(
                            e,
                            placement.id,
                            placement.moduleId,
                            placement.positionHP,
                            placement.row,
                          )
                        }
                        style={{
                          cursor: isDragging || isMultiDragging
                            ? "grabbing"
                            : isSelected
                              ? "grab"
                              : "pointer",
                        }}
                      >
                        <rect
                          x={0}
                          y={0}
                          width={modWidth}
                          height={PANEL_HEIGHT}
                          fill={panelBg}
                          stroke={
                            isDragging || isMultiDragging
                              ? "#fa4"
                              : isSelected
                                ? "#4af"
                                : panelStroke
                          }
                          strokeWidth={isSelected ? 0.6 : 0.2}
                          rx={0.5}
                        />
                        <line
                          x1={EDGE_INSET}
                          y1={topLineY}
                          x2={modWidth - EDGE_INSET}
                          y2={topLineY}
                          stroke={lineColor}
                          strokeWidth={0.2}
                          strokeLinecap="round"
                        />
                        <line
                          x1={EDGE_INSET}
                          y1={bottomLineY}
                          x2={modWidth - EDGE_INSET}
                          y2={bottomLineY}
                          stroke={lineColor}
                          strokeWidth={0.2}
                          strokeLinecap="round"
                        />

                        {mod.components.map((comp) => {
                          const pos = gridToMm(comp.position);
                          const buttonLeds = comp.buttonLedCount ?? 0;
                          const hasButtonLeds =
                            comp.kind === "button" && buttonLeds > 0;
                          const labelY =
                            comp.kind === "jack"
                              ? -5
                              : comp.kind === "pot"
                                ? -8
                                : hasButtonLeds
                                  ? 8
                                  : -5;
                          return (
                            <g
                              key={comp.id}
                              transform={`translate(${pos.x}, ${pos.y})`}
                            >
                              {comp.kind === "jack" ? (
                                <g pointerEvents="none">
                                  <JackShape stroke={compStroke} />
                                </g>
                              ) : comp.kind === "pot" ? (
                                <g
                                  style={{ cursor: "ns-resize" }}
                                  onPointerDown={(e) =>
                                    handlePotPointerDown(
                                      e,
                                      placement.id,
                                      comp.id,
                                    )
                                  }
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setKnobAngle(placement.id, comp.id, 150);
                                    onKnobChange?.(placement.id, comp.id, 150);
                                  }}
                                >
                                  <PotShape
                                    stroke={compStroke}
                                    knobAngle={getKnobAngle(
                                      placement.id,
                                      comp.id,
                                    )}
                                  />
                                  <circle
                                    r={7}
                                    fill="transparent"
                                    pointerEvents="all"
                                  />
                                </g>
                              ) : hasButtonLeds ? (
                                <g
                                  style={{ cursor: "pointer" }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newPressed = !isButtonPressed(
                                      placement.id,
                                      comp.id,
                                    );
                                    toggleButton(placement.id, comp.id);
                                    onButtonToggle?.(
                                      placement.id,
                                      comp.id,
                                      newPressed,
                                    );
                                  }}
                                >
                                  {(buttonLeds === 1
                                    ? [0]
                                    : buttonLeds === 2
                                      ? [-2, 2]
                                      : [-2.5, 0, 2.5]
                                  ).map((lx, i) => (
                                    <g
                                      key={i}
                                      transform={`translate(${lx}, -2)`}
                                    >
                                      <LedShape
                                        lit={isButtonPressed(
                                          placement.id,
                                          comp.id,
                                        )}
                                      />
                                    </g>
                                  ))}
                                  <g transform="translate(0, 2)">
                                    <ButtonShape stroke={compStroke} />
                                  </g>
                                  <rect
                                    x={-4}
                                    y={-5}
                                    width={8}
                                    height={10}
                                    fill="transparent"
                                    pointerEvents="all"
                                  />
                                </g>
                              ) : (
                                <g
                                  style={{ cursor: "pointer" }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newPressed = !isButtonPressed(
                                      placement.id,
                                      comp.id,
                                    );
                                    toggleButton(placement.id, comp.id);
                                    onButtonToggle?.(
                                      placement.id,
                                      comp.id,
                                      newPressed,
                                    );
                                  }}
                                >
                                  <ButtonShape
                                    stroke={
                                      isButtonPressed(placement.id, comp.id)
                                        ? "#aaf"
                                        : compStroke
                                    }
                                  />
                                  <rect
                                    x={-3}
                                    y={-3}
                                    width={6}
                                    height={6}
                                    fill="transparent"
                                    pointerEvents="all"
                                  />
                                </g>
                              )}
                              {comp.kind === "jack" && comp.hasLed && (
                                <g transform="translate(-5.5, 0)">
                                  <LedShape />
                                </g>
                              )}
                              <ComponentLabel component={comp} y={labelY} />
                            </g>
                          );
                        })}

                        {(mod.connections ?? []).map((conn) => {
                          const cdx = conn.to.x - conn.from.x;
                          const cdy = conn.to.y - conn.from.y;
                          const clen = Math.hypot(cdx, cdy);
                          const cux = clen > 0 ? cdx / clen : 0;
                          const cuy = clen > 0 ? cdy / clen : 0;
                          const so = conn.startOffset ?? 0;
                          const eo = conn.endOffset ?? 0;
                          const cx1 = conn.from.x + cux * so;
                          const cy1 = conn.from.y + cuy * so;
                          const cx2 = conn.to.x - cux * eo;
                          const cy2 = conn.to.y - cuy * eo;
                          const isArr = conn.kind === "arrow";
                          const aH = 1.5,
                            aW = 0.75,
                            aG = 0.8;
                          const leX = isArr ? cx2 - cux * (aH + aG) : cx2;
                          const leY = isArr ? cy2 - cuy * (aH + aG) : cy2;
                          const bX = cx2 - cux * aH;
                          const bY = cy2 - cuy * aH;
                          const pX = -cuy * aW;
                          const pY = cux * aW;
                          return (
                            <g key={conn.id}>
                              <line
                                x1={cx1}
                                y1={cy1}
                                x2={leX}
                                y2={leY}
                                stroke={lineColor}
                                strokeWidth={0.2}
                              />
                              {isArr && (
                                <polygon
                                  points={`${cx2},${cy2} ${bX + pX},${bY + pY} ${bX - pX},${bY - pY}`}
                                  fill={lineColor}
                                />
                              )}
                              {conn.label && (
                                <text
                                  x={
                                    (cx1 + leX) / 2 + (clen > 0 ? -cuy * 2 : 2)
                                  }
                                  y={(cy1 + leY) / 2 + (clen > 0 ? cux * 2 : 0)}
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  fill={textColor}
                                  fontSize={2.5}
                                  style={{
                                    userSelect: "none",
                                    fontFamily: "Plus Jakarta Sans",
                                  }}
                                >
                                  {conn.label}
                                </text>
                              )}
                            </g>
                          );
                        })}

                        <text
                          x={modWidth / 2}
                          y={6}
                          textAnchor="middle"
                          fill={textColor}
                          fontSize={3}
                          style={{
                            userSelect: "none",
                            fontFamily: "Plus Jakarta Sans",
                          }}
                        >
                          {mod.name}
                        </text>
                      </g>
                    );
                  })}
              </g>
            );
          })}

          <WireLayer
            dragOverrides={
              drag
                ? drag.isMulti
                  ? (() => {
                      const deltaHP = dragPreviewHP - drag.startHP;
                      const deltaRow = dragPreviewRow - drag.startRow;
                      return selectedPlacementIds
                        .map((id) => {
                          const p = rack.placements.find((pl) => pl.id === id);
                          if (!p) return null;
                          return { placementId: id, positionHP: p.positionHP + deltaHP, row: p.row + deltaRow };
                        })
                        .filter((o): o is NonNullable<typeof o> => o !== null);
                    })()
                  : [{ placementId: drag.placementId, positionHP: dragPreviewHP, row: dragPreviewRow }]
                : null
            }
          />

          {/* Jack hit targets rendered above wires so they're always clickable */}
          {rack.placements.map((placement) => {
            const mod = modules.find((m) => m.id === placement.moduleId);
            if (!mod) return null;
            const isDragging = drag?.placementId === placement.id;
            const displayHP = isDragging ? dragPreviewHP : placement.positionHP;
            const displayRow = isDragging ? dragPreviewRow : placement.row;
            const modX = displayHP * HP_WIDTH;
            const rowY = displayRow * rowHeight + RAIL_HEIGHT;
            return mod.components
              .filter((c) => c.kind === "jack")
              .map((comp) => {
                const pos = gridToMm(comp.position);
                const isHovered =
                  hoveredJack?.placementId === placement.id &&
                  hoveredJack?.componentId === comp.id;
                return (
                  <g
                    key={`jhit-${placement.id}-${comp.id}`}
                    transform={`translate(${modX + pos.x}, ${rowY + pos.y})`}
                    onPointerDown={(e) =>
                      handleJackPointerDown(e, placement.id, comp.id)
                    }
                    style={{ cursor: "crosshair" }}
                  >
                    {isHovered && (
                      <circle
                        r={4.5}
                        fill="none"
                        stroke="#4af"
                        strokeWidth={0.6}
                        opacity={0.8}
                        pointerEvents="none"
                      />
                    )}
                    <circle r={5} fill="transparent" pointerEvents="all" />
                  </g>
                );
              });
          })}

          {wireStart && wireStartPos && wirePreviewEnd && (
            <PreviewWire
              fromX={wireStartPos.x}
              fromY={wireStartPos.y}
              toX={wirePreviewEnd.x}
              toY={wirePreviewEnd.y}
              color="#4af"
            />
          )}
          {wireDrag && wireDragEnd && (
            <PreviewWire
              fromX={wireDrag.anchorPos.x}
              fromY={wireDrag.anchorPos.y}
              toX={wireDragEnd.x}
              toY={wireDragEnd.y}
              color={wireDrag.color}
            />
          )}

          {/* Library drag ghost preview */}
          {libDrag &&
            (() => {
              const mod = modules.find((m) => m.id === libDrag.moduleId);
              if (!mod) return null;
              const ghostX = libDrag.hp * HP_WIDTH;
              const ghostY = libDrag.row * rowHeight + RAIL_HEIGHT;
              const ghostW = mod.widthHP * HP_WIDTH;
              return (
                <rect
                  x={ghostX}
                  y={ghostY}
                  width={ghostW}
                  height={PANEL_HEIGHT}
                  fill={
                    libDragOverlaps
                      ? "rgba(255,80,80,0.15)"
                      : "rgba(80,200,120,0.15)"
                  }
                  stroke={libDragOverlaps ? "#f44" : "#4a6"}
                  strokeWidth={0.5}
                  strokeDasharray="2 1"
                  rx={0.5}
                  pointerEvents="none"
                />
              );
            })()}

          {/* Marquee selection rect */}
          {marqueeBounds && (
            <rect
              x={marqueeBounds.x1}
              y={marqueeBounds.y1}
              width={marqueeBounds.x2 - marqueeBounds.x1}
              height={marqueeBounds.y2 - marqueeBounds.y1}
              fill="rgba(100,150,255,0.08)"
              stroke="rgba(100,150,255,0.6)"
              strokeWidth={0.25 / view.zoom}
              strokeDasharray={`${1 / view.zoom} ${1 / view.zoom}`}
              pointerEvents="none"
            />
          )}
        </svg>
        {searchPopup && (
          <ModuleSearchPopup
            screenX={searchPopup.screenX}
            screenY={searchPopup.screenY}
            onSelect={(moduleId) => {
              const mod = modules.find((m) => m.id === moduleId);
              if (mod) {
                const hp = Math.max(
                  0,
                  Math.min(
                    Math.round(searchPopup.svgX / HP_WIDTH),
                    rack.widthHP - mod.widthHP,
                  ),
                );
                const row = Math.max(
                  0,
                  Math.min(
                    Math.floor(searchPopup.svgY / rowHeight),
                    rack.rows - 1,
                  ),
                );
                placeModule(moduleId, hp, row);
              }
              setSearchPopup(null);
            }}
            onClose={() => setSearchPopup(null)}
          />
        )}
      </div>
    </div>
  );
}
