import { useCallback, useRef } from "react";
import { useAppStore } from "../store";
import { screenToSvg } from "../utils/svg";

export function usePanZoom() {
  const zoom = useAppStore((s) => s.zoom);
  const panOffset = useAppStore((s) => s.panOffset);
  const setZoom = useAppStore((s) => s.setZoom);
  const setPanOffset = useAppStore((s) => s.setPanOffset);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffsetStart = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const svgEl = e.currentTarget;
      const pt = screenToSvg(svgEl, e.clientX, e.clientY);

      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = zoom * factor;

      // Zoom toward cursor: adjust pan so the point under the cursor stays fixed
      const newPanX = pt.x - (pt.x - panOffset.x) * (zoom / newZoom);
      const newPanY = pt.y - (pt.y - panOffset.y) * (zoom / newZoom);

      setZoom(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    },
    [zoom, panOffset, setZoom, setPanOffset]
  );

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
    [panOffset]
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
    [setPanOffset]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button === 1) {
        isPanning.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    []
  );

  return {
    zoom,
    panOffset,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
