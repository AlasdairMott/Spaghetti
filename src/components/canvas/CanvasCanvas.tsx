import { useRef, useState, useCallback, useEffect } from "react";
import { useAppStore } from "../../store";
import {
  PANEL_HEIGHT,
  HP_WIDTH,
} from "../../constants/grid";
import { screenToSvg } from "../../utils/svg";
import { gridToMm } from "../../utils/grid";
import { detectIsTrackpad } from "../../utils/wheelDetect";
import { RenderModeToggle } from "../layout/RenderModeToggle";
import {
  CanvasWireLayer,
  PreviewWire,
  resolveCanvasEndpoint,
} from "./CanvasWireLayer";
import { ModuleSearchPopup } from "../ui/ModuleSearchPopup";
import { snapPosition } from "../../store/canvasSlice";
import { useKnobDrag, randomizeKnobs } from "../../hooks/useKnobDrag";
import { ModulePanel } from "../shared/ModulePanel";
import type { RackWireEndpoint } from "../../models/types";

const JACK_HIT_RADIUS = 4;

interface DragState {
  placementId: string;
  moduleId: string;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  isMulti: boolean;
}

interface WireDragState {
  wireId: string;
  dragEnd: "from" | "to";
  anchorPos: { x: number; y: number };
  anchorEndpoint: RackWireEndpoint;
  color: string;
}

interface CanvasCanvasProps {
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

export function CanvasCanvas({
  onKnobChange,
  onButtonToggle,
}: CanvasCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvas = useAppStore((s) => s.canvas);
  const modules = useAppStore((s) => s.modules);
  const canvasPlaceModule = useAppStore((s) => s.canvasPlaceModule);
  const canvasRemovePlacement = useAppStore((s) => s.canvasRemovePlacement);
  const canvasMoveModule = useAppStore((s) => s.canvasMoveModule);
  const canvasBatchMoveModules = useAppStore((s) => s.canvasBatchMoveModules);
  const canvasAddWire = useAppStore((s) => s.canvasAddWire);
  const canvasRemoveWire = useAppStore((s) => s.canvasRemoveWire);
  const canvasSelectWires = useAppStore((s) => s.canvasSelectWires);
  const canvasSelectedWireIds = useAppStore((s) => s.canvasSelectedWireIds);
  const canvasSelectedPlacementIds = useAppStore(
    (s) => s.canvasSelectedPlacementIds,
  );
  const canvasSelectPlacements = useAppStore((s) => s.canvasSelectPlacements);
  const canvasSetKnobAngle = useAppStore((s) => s.canvasSetKnobAngle);
  const canvasToggleButton = useAppStore((s) => s.canvasToggleButton);
  const canvasUpdateWireEndpoint = useAppStore(
    (s) => s.canvasUpdateWireEndpoint,
  );
  const openModuleForEditing = useAppStore((s) => s.openModuleForEditing);
  const setMode = useAppStore((s) => s.setMode);
  const renderMode = useAppStore((s) => s.renderMode);
  const theme = useAppStore((s) => s.theme);
  const isLight = theme === "light";
  const isRendered = renderMode === "rendered";
  const panelBg = isRendered ? "#E7E0D8" : isLight ? "#e8e4e0" : "#222";
  const lineColor = isRendered ? "#231F20" : isLight ? "#555" : "#444";
  const textColor = isRendered ? "#231F20" : isLight ? "#444" : "#777";
  const canvasBg = isLight ? "#d8d4d0" : "#1a1a1a";
  const panelStroke = isLight ? "#b0acaa" : "#959495";
  const compStroke = isLight ? "#555" : "#888";

  // Pan / zoom
  const savedCanvasView = useAppStore((s) => s.canvas.view);
  const setCanvasView = useAppStore((s) => s.setActiveCanvasView);
  const [view, setView] = useState(
    () => savedCanvasView ?? { zoom: 1, panX: 0, panY: 0 },
  );
  const viewRef = useRef(view);

  useEffect(() => {
    return () => {
      setCanvasView(viewRef.current);
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
        // Trackpad pinch-to-zoom
        const pt = screenToSvg(el, e.clientX, e.clientY);
        const factor = Math.pow(2, -e.deltaY * 0.01);
        const newZoom = Math.max(0.15, Math.min(10, v.zoom * factor));
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
        const newZoom = Math.max(0.15, Math.min(10, v.zoom * factor));
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
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Library drag preview
  const [libDrag, setLibDrag] = useState<{
    moduleId: string;
    x: number;
    y: number;
  } | null>(null);

  const [wireStart, setWireStart] = useState<RackWireEndpoint | null>(null);
  const [wirePreviewEnd, setWirePreviewEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const getKnobAngle = useCallback(
    (placementId: string, componentId: string): number => {
      const knobStates = canvas.knobStates ?? [];
      return (
        knobStates.find(
          (k) => k.placementId === placementId && k.componentId === componentId,
        )?.angle ?? 150
      );
    },
    [canvas.knobStates],
  );

  const { knobDrag, handlePotPointerDown } = useKnobDrag(
    getKnobAngle,
    (pid: string, cid: string, angle: number) => {
      onKnobChange?.(pid, cid, angle);
      canvasSetKnobAngle(pid, cid, angle);
    },
  );

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

  // Compute viewport (infinite canvas — show whatever region the user has panned to)
  const vbW = 800 / view.zoom;
  const vbH = 600 / view.zoom;
  const vbX = view.panX;
  const vbY = view.panY;

  const resolveEndpointPos = useCallback(
    (ep: RackWireEndpoint): { x: number; y: number } | null => {
      return resolveCanvasEndpoint(ep, canvas.placements, modules);
    },
    [canvas.placements, modules],
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
        canvasSelectWires([]);
        canvasSelectPlacements([]);
      }
      if (e.key === "r" && (e.metaKey || e.ctrlKey)) {
        if (canvasSelectedPlacementIds.length > 0) {
          e.preventDefault();
          randomizeKnobs(canvasSelectedPlacementIds, canvas.placements, modules, (pid, cid, angle) => {
            canvasSetKnobAngle(pid, cid, angle);
            onKnobChange?.(pid, cid, angle);
          });
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (canvasSelectedWireIds.length > 0) {
          for (const id of canvasSelectedWireIds) canvasRemoveWire(id);
          canvasSelectWires([]);
        }
        if (canvasSelectedPlacementIds.length > 0) {
          for (const id of canvasSelectedPlacementIds)
            canvasRemovePlacement(id);
          canvasSelectPlacements([]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canvasSelectedWireIds,
    canvasRemoveWire,
    canvasSelectWires,
    canvasSelectPlacements,
    canvasSelectedPlacementIds,
    canvasRemovePlacement,
    wireDrag,
    canvas.placements,
    modules,
    canvasSetKnobAngle,
    onKnobChange,
  ]);

  const findNearestJack = useCallback(
    (svgX: number, svgY: number): RackWireEndpoint | null => {
      let closest: RackWireEndpoint | null = null;
      let closestDist = JACK_HIT_RADIUS;
      for (const placement of canvas.placements) {
        const mod = modules.find((m) => m.id === placement.moduleId);
        if (!mod) continue;
        for (const comp of mod.components) {
          if (comp.kind !== "jack") continue;
          const mm = gridToMm(comp.position);
          const dist = Math.hypot(
            svgX - (placement.x + mm.x),
            svgY - (placement.y + mm.y),
          );
          if (dist < closestDist) {
            closestDist = dist;
            closest = { placementId: placement.id, componentId: comp.id };
          }
        }
      }
      return closest;
    },
    [canvas.placements, modules],
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
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    // Center on cursor
    const x = pt.x - (mod.widthHP * HP_WIDTH) / 2;
    const y = pt.y - PANEL_HEIGHT / 2;
    if (
      !libDrag ||
      Math.abs(x - libDrag.x) > 1 ||
      Math.abs(y - libDrag.y) > 1
    ) {
      setLibDrag({ moduleId, x, y });
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
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    canvasPlaceModule(
      moduleId,
      pt.x - (mod.widthHP * HP_WIDTH) / 2,
      pt.y - PANEL_HEIGHT / 2,
    );
  };

  const handleModulePointerDown = useCallback(
    (
      e: React.PointerEvent<SVGElement>,
      placementId: string,
      moduleId: string,
      px: number,
      py: number,
    ) => {
      if (e.button !== 0 || !svgRef.current) return;
      e.stopPropagation();
      didDragRef.current = false;
      pointerDownShiftRef.current = e.shiftKey;
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      const curSelected = useAppStore.getState().canvasSelectedPlacementIds;
      const isAlreadySelected = curSelected.includes(placementId);
      const isMulti = isAlreadySelected && curSelected.length > 1 && !e.shiftKey;
      setDrag({
        placementId,
        moduleId,
        offsetX: pt.x - px,
        offsetY: pt.y - py,
        startX: px,
        startY: py,
        isMulti,
      });
      setDragPreview({ x: px, y: py });
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
      const wires = state.canvas.wires ?? [];
      for (const wire of wires) {
        for (const end of ["from", "to"] as const) {
          const ep = wire[end];
          if (
            ep.placementId === placementId &&
            ep.componentId === componentId
          ) {
            const otherEnd = end === "from" ? "to" : "from";
            const anchorPos = resolveCanvasEndpoint(
              wire[otherEnd],
              state.canvas.placements,
              state.modules,
            );
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

      setWireStart(endpoint);
      setWirePreviewEnd({ x: pt.x, y: pt.y });
      (e.target as SVGElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (drag && svgRef.current) {
        const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
        const rawX = pt.x - drag.offsetX;
        const rawY = pt.y - drag.offsetY;
        const mod = modules.find((m) => m.id === drag.moduleId);
        if (!mod) return;
        const getWidth = (id: string) =>
          (modules.find((m) => m.id === id)?.widthHP ?? 0) * HP_WIDTH;
        const snapped = snapPosition(
          rawX,
          rawY,
          mod.widthHP * HP_WIDTH,
          canvas.placements,
          drag.placementId,
          getWidth,
        );
        if (snapped.x !== dragPreview.x || snapped.y !== dragPreview.y) {
          didDragRef.current = true;
        }
        setDragPreview(snapped);
      }
      if (wireStart && svgRef.current) {
        const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
        setWirePreviewEnd({ x: pt.x, y: pt.y });
        setHoveredJack(findNearestJack(pt.x, pt.y));
      }
      if (wireDrag && svgRef.current) {
        const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
        setWireDragEnd({ x: pt.x, y: pt.y });
        setHoveredJack(findNearestJack(pt.x, pt.y));
      }
      if (!drag && !wireStart && !wireDrag && !knobDrag && svgRef.current) {
        const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
        setHoveredJack(findNearestJack(pt.x, pt.y));
      }
    },
    [
      drag,
      dragPreview,
      modules,
      canvas.placements,
      wireStart,
      knobDrag,
      wireDrag,
      findNearestJack,
    ],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (drag) {
        if (didDragRef.current) {
          if (drag.isMulti) {
            const deltaX = dragPreview.x - drag.startX;
            const deltaY = dragPreview.y - drag.startY;
            const state = useAppStore.getState();
            const moves = state.canvasSelectedPlacementIds
              .map((id) => {
                const p = state.canvas.placements.find((pl) => pl.id === id);
                if (!p) return null;
                return { placementId: id, x: p.x + deltaX, y: p.y + deltaY };
              })
              .filter((m): m is NonNullable<typeof m> => m !== null);
            canvasBatchMoveModules(moves);
          } else {
            canvasMoveModule(drag.placementId, dragPreview.x, dragPreview.y);
          }
        } else {
          const pid = drag.placementId;
          setWireStart(null);
          setWirePreviewEnd(null);
          if (pointerDownShiftRef.current) {
            const cur = useAppStore.getState().canvasSelectedPlacementIds;
            if (cur.includes(pid)) {
              canvasSelectPlacements(cur.filter((id) => id !== pid));
            } else {
              canvasSelectPlacements([...cur, pid]);
            }
          } else {
            canvasSelectPlacements([pid]);
          }
        }
        setDrag(null);
        return;
      }
      if (knobDrag) {
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
            canvasUpdateWireEndpoint(wireDrag.wireId, wireDrag.dragEnd, jack);
          }
        }
        setWireDrag(null);
        setWireDragEnd(null);
        setHoveredJack(null);
        return;
      }
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
          canvasAddWire(wireStart, jack);
        }
        setWireStart(null);
        setWirePreviewEnd(null);
        setHoveredJack(null);
        return;
      }
      canvasSelectWires([]);
      canvasSelectPlacements([]);
    },
    [
      drag,
      dragPreview,
      canvasMoveModule,
      canvasBatchMoveModules,
      knobDrag,
      canvasSelectWires,
      canvasSelectPlacements,
      wireDrag,
      canvasUpdateWireEndpoint,
      findNearestJack,
      wireStart,
      canvasAddWire,
    ],
  );


  const isButtonPressed = useCallback(
    (placementId: string, componentId: string): boolean => {
      const buttonStates = canvas.buttonStates ?? [];
      return (
        buttonStates.find(
          (b) => b.placementId === placementId && b.componentId === componentId,
        )?.pressed ?? false
      );
    },
    [canvas.buttonStates],
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
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ flex: 1, background: canvasBg, display: "block", cursor }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDoubleClick={(e) => {
            if (!svgRef.current) return;
            const target = e.target as Element;
            if (target !== e.currentTarget && target.getAttribute("data-bg") !== "true") return;
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
                const ids = canvas.placements
                  .filter((p) => {
                    const mod = modules.find((m) => m.id === p.moduleId);
                    if (!mod) return false;
                    const pw = mod.widthHP * HP_WIDTH;
                    return (
                      p.x < mb.x2 &&
                      p.x + pw > mb.x1 &&
                      p.y < mb.y2 &&
                      p.y + PANEL_HEIGHT > mb.y1
                    );
                  })
                  .map((p) => p.id);
                canvasSelectPlacements(ids);
                if (ids.length > 0) canvasSelectWires([]);
              } else {
                canvasSelectWires([]);
                canvasSelectPlacements([]);
              }
              return;
            }
            handlePointerUp(e);
          }}
        >
          {/* Subtle dot grid for orientation */}
          <defs>
            <pattern
              id="canvasGrid"
              width={HP_WIDTH}
              height={HP_WIDTH}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={HP_WIDTH / 2}
                cy={HP_WIDTH / 2}
                r={0.15}
                fill={isLight ? "#bbb" : "#333"}
              />
            </pattern>
          </defs>
          <rect
            x={vbX}
            y={vbY}
            width={vbW}
            height={vbH}
            fill="url(#canvasGrid)"
            data-bg="true"
          />

          {/* Modules */}
          {canvas.placements.map((placement) => {
            const mod = modules.find((m) => m.id === placement.moduleId);
            if (!mod) return null;
            const isDragging = drag?.placementId === placement.id;
            const isMultiDragging = drag?.isMulti && canvasSelectedPlacementIds.includes(placement.id) && !isDragging;
            const isSelected = canvasSelectedPlacementIds.includes(
              placement.id,
            );
            const displayX = isDragging
              ? dragPreview.x
              : isMultiDragging
                ? placement.x + (dragPreview.x - drag!.startX)
                : placement.x;
            const displayY = isDragging
              ? dragPreview.y
              : isMultiDragging
                ? placement.y + (dragPreview.y - drag!.startY)
                : placement.y;
            return (
              <g
                key={placement.id}
                transform={`translate(${displayX}, ${displayY})`}
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
                    placement.x,
                    placement.y,
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
                <ModulePanel
                  module={mod}
                  placementId={placement.id}
                  panelBg={panelBg}
                  panelStroke={panelStroke}
                  lineColor={lineColor}
                  textColor={textColor}
                  compStroke={compStroke}
                  borderStroke={isDragging || isMultiDragging ? "#fa4" : isSelected ? "#4af" : undefined}
                  borderWidth={isSelected ? 0.6 : undefined}
                  getKnobAngle={getKnobAngle}
                  isButtonPressed={isButtonPressed}
                  handlePotPointerDown={handlePotPointerDown}
                  onPotDoubleClick={(pid, cid) => {
                    canvasSetKnobAngle(pid, cid, 150);
                    onKnobChange?.(pid, cid, 150);
                  }}
                  onButtonClick={(pid, cid) => {
                    const p = !isButtonPressed(pid, cid);
                    canvasToggleButton(pid, cid);
                    onButtonToggle?.(pid, cid, p);
                  }}
                />
              </g>
            );
          })}

          <CanvasWireLayer
            dragOverrides={
              drag
                ? drag.isMulti
                  ? (() => {
                      const deltaX = dragPreview.x - drag.startX;
                      const deltaY = dragPreview.y - drag.startY;
                      return canvasSelectedPlacementIds
                        .map((id) => {
                          const p = canvas.placements.find((pl) => pl.id === id);
                          if (!p) return null;
                          return { placementId: id, x: p.x + deltaX, y: p.y + deltaY };
                        })
                        .filter((o): o is NonNullable<typeof o> => o !== null);
                    })()
                  : [{ placementId: drag.placementId, x: dragPreview.x, y: dragPreview.y }]
                : null
            }
          />

          {/* Jack hit targets above wires */}
          {canvas.placements.map((placement) => {
            const mod = modules.find((m) => m.id === placement.moduleId);
            if (!mod) return null;
            const isDragging = drag?.placementId === placement.id;
            const displayX = isDragging ? dragPreview.x : placement.x;
            const displayY = isDragging ? dragPreview.y : placement.y;
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
                    transform={`translate(${displayX + pos.x}, ${displayY + pos.y})`}
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
              const ghostW = mod.widthHP * HP_WIDTH;
              return (
                <rect
                  x={libDrag.x}
                  y={libDrag.y}
                  width={ghostW}
                  height={PANEL_HEIGHT}
                  fill="rgba(80,200,120,0.15)"
                  stroke="#4a6"
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
              strokeWidth={0.5 / view.zoom}
              strokeDasharray={`${2 / view.zoom} ${2 / view.zoom}`}
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
                canvasPlaceModule(
                  moduleId,
                  searchPopup.svgX - (mod.widthHP * HP_WIDTH) / 2,
                  searchPopup.svgY - PANEL_HEIGHT / 2,
                );
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
