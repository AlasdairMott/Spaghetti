import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../store";
import { screenToSvg } from "../utils/svg";
import { detectIsTrackpad } from "../utils/wheelDetect";

export function usePanZoom(svgEl: SVGSVGElement | null) {
  const zoom = useAppStore((s) => s.zoom);
  const panOffset = useAppStore((s) => s.panOffset);
  const setZoom = useAppStore((s) => s.setZoom);
  const setPanOffset = useAppStore((s) => s.setPanOffset);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffsetStart = useRef({ x: 0, y: 0 });

  // Store latest values in refs so the native wheel handler can access them
  const zoomRef = useRef(zoom);
  const panOffsetRef = useRef(panOffset);
  zoomRef.current = zoom;
  panOffsetRef.current = panOffset;

  // Batch updates via rAF to avoid jitter from rapid trackpad events
  const pendingRef = useRef<{
    zoom: number;
    panX: number;
    panY: number;
  } | null>(null);
  const rafId = useRef(0);

  const flush = useCallback(() => {
    rafId.current = 0;
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    setZoom(p.zoom);
    setPanOffset({ x: p.panX, y: p.panY });
  }, [setZoom, setPanOffset]);

  const scheduleUpdate = useCallback(
    (next: { zoom: number; panX: number; panY: number }) => {
      pendingRef.current = next;
      // Also update the refs immediately so the next wheel event reads fresh values
      zoomRef.current = next.zoom;
      panOffsetRef.current = { x: next.panX, y: next.panY };
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(flush);
      }
    },
    [flush],
  );

  // Register native wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    if (!svgEl) return;
    const el = svgEl;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const z = zoomRef.current;
      const pan = panOffsetRef.current;

      if (e.ctrlKey) {
        // Trackpad pinch-to-zoom (macOS fires wheel + ctrlKey for pinch gestures)
        const pt = screenToSvg(el, e.clientX, e.clientY);
        const factor = Math.pow(2, -e.deltaY * 0.01);
        const newZoom = Math.max(0.1, Math.min(10, z * factor));
        scheduleUpdate({
          zoom: newZoom,
          panX: pt.x - (pt.x - pan.x) * (z / newZoom),
          panY: pt.y - (pt.y - pan.y) * (z / newZoom),
        });
      } else if (detectIsTrackpad(e)) {
        // Trackpad two-finger scroll → pan
        const ctm = el.getScreenCTM();
        if (!ctm) return;
        scheduleUpdate({
          zoom: z,
          panX: pan.x + e.deltaX / ctm.a,
          panY: pan.y + e.deltaY / ctm.d,
        });
      } else {
        // Mouse scroll wheel → zoom
        const pt = screenToSvg(el, e.clientX, e.clientY);
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newZoom = Math.max(0.1, Math.min(10, z * factor));
        scheduleUpdate({
          zoom: newZoom,
          panX: pt.x - (pt.x - pan.x) * (z / newZoom),
          panY: pt.y - (pt.y - pan.y) * (z / newZoom),
        });
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [svgEl, scheduleUpdate]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button === 1) {
        // Middle mouse button → pan
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY };
        panOffsetStart.current = { ...panOffset };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
    [panOffset],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isPanning.current) return;
      const svgEl = e.currentTarget;
      const ctm = svgEl.getScreenCTM();
      if (!ctm) return;
      // Convert pixel delta to SVG units
      const dx = (e.clientX - panStart.current.x) / ctm.a;
      const dy = (e.clientY - panStart.current.y) / ctm.d;
      setPanOffset({
        x: panOffsetStart.current.x - dx,
        y: panOffsetStart.current.y - dy,
      });
    },
    [setPanOffset],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button === 1) {
        isPanning.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  return {
    zoom,
    panOffset,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
