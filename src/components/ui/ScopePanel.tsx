import { useRef, useEffect, useState, useCallback } from "react";
import { useAppStore } from "../../store";
import { getAnalyserNode } from "../../audio/singleton";
import { Activity, Pause, Play, RotateCcw } from "lucide-react";

type ViewMode = "scope" | "spectrogram";

// Spectrogram color LUT: 256 entries, index = dB mapped to 0..255
const SPEC_LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r: number, g: number, b: number;
    if (t < 0.2) {
      const s = t / 0.2;
      r = 0; g = 0; b = Math.floor(s * 160);
    } else if (t < 0.4) {
      const s = (t - 0.2) / 0.2;
      r = 0; g = Math.floor(s * 220); b = 160 + Math.floor(s * 95);
    } else if (t < 0.6) {
      const s = (t - 0.4) / 0.2;
      r = Math.floor(s * 255); g = 220 + Math.floor(s * 35); b = 255 - Math.floor(s * 255);
    } else if (t < 0.8) {
      const s = (t - 0.6) / 0.2;
      r = 255; g = 255 - Math.floor(s * 200); b = 0;
    } else {
      const s = (t - 0.8) / 0.2;
      r = 255; g = 55 + Math.floor(s * 200); b = Math.floor(s * 255);
    }
    lut[i * 4] = r;
    lut[i * 4 + 1] = g;
    lut[i * 4 + 2] = b;
    lut[i * 4 + 3] = 255;
  }
  return lut;
})();

const SPEC_HISTORY = 1024;

const tabCls = (active: boolean) =>
  `px-1.5 py-0.5 text-[10px] border-none rounded cursor-pointer ${
    active
      ? "bg-accent text-surface-0"
      : "bg-transparent text-text-muted hover:text-text"
  }`;

const iconBtnCls =
  "border-none rounded p-0.5 cursor-pointer bg-transparent text-text-muted hover:text-text";

export function ScopePanel() {
  const audioRunning = useAppStore((s) => s.audioRunning);
  const theme = useAppStore((s) => s.theme);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ViewMode>("scope");
  const [paused, setPaused] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const cssSizeRef = useRef({ w: 400, h: 200 });

  // Audio buffers
  const timeBufRef = useRef<Float32Array | null>(null);
  const freqBufRef = useRef<Float32Array | null>(null);
  const frozenTimeBufRef = useRef<Float32Array | null>(null);

  // Spectrogram offscreen canvas
  const specCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const specBinCount = useRef(0);

  // Zoom / pan (refs for smooth interaction without re-renders)
  const zoomRef = useRef({ x: 1, y: 1 });
  const panRef = useRef({ x: 0, y: 0 });

  const resetView = useCallback(() => {
    zoomRef.current = { x: 1, y: 1 };
    panRef.current = { x: 0, y: 0 };
  }, []);

  // Reset view on mode switch
  useEffect(() => {
    resetView();
  }, [mode, resetView]);

  // Wheel-to-zoom on the canvas
  useEffect(() => {
    if (!open) return;
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const z = zoomRef.current;
      const p = panRef.current;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const w = rect.width;
      const h = rect.height;

      // Normalised cursor position (0..1)
      const nx = mx / w;
      const ny = my / h;

      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;

      if (e.shiftKey) {
        // Zoom Y only
        const newY = Math.max(1, Math.min(64, z.y * factor));
        p.y += (ny - 0.5) * h * (1 / z.y - 1 / newY);
        z.y = newY;
      } else {
        // Zoom X only
        const newX = Math.max(1, Math.min(64, z.x * factor));
        p.x += (nx - 0.5) * w * (1 / z.x - 1 / newX);
        z.x = newX;
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [open]);

  // Pointer drag to pan
  useEffect(() => {
    if (!open) return;
    const el = canvasRef.current;
    if (!el) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startPanX = 0;
    let startPanY = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = panRef.current.x;
      startPanY = panRef.current.y;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      panRef.current.x = startPanX + (e.clientX - startX);
      panRef.current.y = startPanY + (e.clientY - startY);
    };
    const onUp = () => {
      dragging = false;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
  }, [open]);

  // Resize observer
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      cssSizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [open]);

  // Draw loop
  useEffect(() => {
    if (!open) return;

    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = getAnalyserNode();
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const w = cssSizeRef.current.w;
      const h = cssSizeRef.current.h;
      const isLight = theme === "light";
      const bg = isLight ? "#e8e4e0" : "#111";
      const gridColor = isLight ? "#ccc" : "#222";
      const zx = zoomRef.current.x;
      const zy = zoomRef.current.y;
      const px = panRef.current.x;
      const py = panRef.current.y;

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      if (mode === "scope") {
        // --- Scope ---
        // Acquire data
        if (analyser && !paused) {
          if (!timeBufRef.current || timeBufRef.current.length !== analyser.fftSize) {
            timeBufRef.current = new Float32Array(analyser.fftSize);
          }
          analyser.getFloatTimeDomainData(timeBufRef.current as Float32Array<ArrayBuffer>);
          if (!frozenTimeBufRef.current || frozenTimeBufRef.current.length !== timeBufRef.current.length) {
            frozenTimeBufRef.current = new Float32Array(timeBufRef.current.length);
          }
          frozenTimeBufRef.current.set(timeBufRef.current);
        }

        const buf = paused ? frozenTimeBufRef.current : timeBufRef.current;

        // Grid
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const cy = h / 2 + py;
        ctx.moveTo(0, cy); ctx.lineTo(w, cy);
        ctx.moveTo(0, cy - (h / 4) * zy); ctx.lineTo(w, cy - (h / 4) * zy);
        ctx.moveTo(0, cy + (h / 4) * zy); ctx.lineTo(w, cy + (h / 4) * zy);
        ctx.moveTo(w / 2 + px, 0); ctx.lineTo(w / 2 + px, h);
        ctx.stroke();

        // Waveform
        if (buf && buf.length > 0) {
          ctx.strokeStyle = isLight ? "#4a9" : "#4f8";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const len = buf.length;
          const visSamples = len / zx;
          const startSample = (len - visSamples) / 2 - px * (len / w) / zx;
          for (let i = 0; i < w; i++) {
            const si = startSample + (i / w) * visSamples;
            const idx = Math.max(0, Math.min(len - 1, Math.floor(si)));
            const val = buf[idx];
            const y = h / 2 + py - val * (h / 2) * zy;
            if (i === 0) ctx.moveTo(i, y);
            else ctx.lineTo(i, y);
          }
          ctx.stroke();
        }
      } else {
        // --- Spectrogram ---
        if (!analyser) {
          rafRef.current = requestAnimationFrame(draw);
          return;
        }

        const binCount = analyser.frequencyBinCount;

        // Init offscreen canvas
        if (!specCanvasRef.current || specBinCount.current !== binCount) {
          const c = document.createElement("canvas");
          c.width = SPEC_HISTORY;
          c.height = binCount;
          const sctx = c.getContext("2d")!;
          sctx.fillStyle = "#000";
          sctx.fillRect(0, 0, SPEC_HISTORY, binCount);
          specCanvasRef.current = c;
          specBinCount.current = binCount;
        }

        // Add new column
        if (!paused) {
          if (!freqBufRef.current || freqBufRef.current.length !== binCount) {
            freqBufRef.current = new Float32Array(binCount);
          }
          analyser.getFloatFrequencyData(freqBufRef.current as Float32Array<ArrayBuffer>);

          const sc = specCanvasRef.current;
          const sctx = sc.getContext("2d")!;
          // Shift left by 1
          sctx.drawImage(sc, 1, 0, SPEC_HISTORY - 1, binCount, 0, 0, SPEC_HISTORY - 1, binCount);
          // Draw new column at right edge
          const col = sctx.createImageData(1, binCount);
          for (let b = 0; b < binCount; b++) {
            const db = freqBufRef.current[b];
            const lutIdx = Math.max(0, Math.min(255, Math.floor((db + 100) * 2.55)));
            const row = binCount - 1 - b; // low freq at bottom
            const off = row * 4;
            col.data[off] = SPEC_LUT[lutIdx * 4];
            col.data[off + 1] = SPEC_LUT[lutIdx * 4 + 1];
            col.data[off + 2] = SPEC_LUT[lutIdx * 4 + 2];
            col.data[off + 3] = 255;
          }
          sctx.putImageData(col, SPEC_HISTORY - 1, 0);
        }

        // --- Layout: inset the spectrogram to leave room for labels ---
        const leftMargin = 24;
        const bottomMargin = 14;
        const specW = w - leftMargin;
        const specH = h - bottomMargin;

        const sampleRate = analyser.context.sampleRate;
        const nyquist = sampleRate / 2;
        const labelFill = isLight ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.55)";
        const tickColor = isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)";

        // Log frequency mapping: display rows map logarithmically to freq bins
        const minFreq = 20;
        const maxFreq = nyquist;
        const logMin = Math.log(minFreq);
        const logMax = Math.log(maxFreq);
        const logRange = logMax - logMin;

        // Visible log-frequency range (zoom/pan in log space)
        const logViewRange = logRange / zy;
        const logViewCenter = (logMax + logMin) / 2 + py * (logRange / specH);
        const logViewTop = Math.min(logMax, logViewCenter + logViewRange / 2);
        const logViewBottom = Math.max(logMin, logViewTop - logViewRange);

        // Time axis (linear) — same as before
        const srcW = specW / zx;
        const srcX = Math.max(0, Math.min(SPEC_HISTORY - srcW, SPEC_HISTORY - srcW - px * (SPEC_HISTORY / specW) / zx));

        // Draw spectrogram with log-Y mapping: one drawImage per display row
        ctx.imageSmoothingEnabled = false;
        for (let dy = 0; dy < specH; dy++) {
          // Map display row to log frequency
          const t = dy / specH; // 0 = top (high freq), 1 = bottom (low freq)
          const logFreq = logViewTop - t * (logViewTop - logViewBottom);
          const freq = Math.exp(logFreq);
          const bin = freq * binCount / nyquist;
          // In offscreen canvas: row 0 = low freq (bin 0), row binCount-1 = high freq
          // But we stored flipped: row = binCount - 1 - bin
          const srcRow = Math.max(0, Math.min(binCount - 1, Math.round(binCount - 1 - bin)));
          ctx.drawImage(
            specCanvasRef.current,
            srcX, srcRow, srcW, 1,
            leftMargin, dy, specW, 1,
          );
        }

        // --- Frequency scale (left margin, log-spaced) ---
        ctx.font = "8px sans-serif";
        ctx.textAlign = "right";
        const freqs = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter(
          (f) => f >= minFreq && f <= maxFreq,
        );
        for (const freq of freqs) {
          const lf = Math.log(freq);
          const dispY = ((logViewTop - lf) / (logViewTop - logViewBottom)) * specH;
          if (dispY < 6 || dispY > specH - 4) continue;
          // Tick
          ctx.strokeStyle = tickColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(leftMargin - 3, dispY);
          ctx.lineTo(leftMargin, dispY);
          ctx.stroke();
          // Label
          const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
          ctx.fillStyle = labelFill;
          ctx.fillText(label, leftMargin - 4, dispY + 3);
        }

        // --- Time scale (bottom margin) ---
        const colsPerSec = 60;
        const visibleSecs = srcW / colsPerSec;
        let tInterval = 1;
        if (visibleSecs < 2) tInterval = 0.25;
        else if (visibleSecs < 5) tInterval = 0.5;
        else if (visibleSecs < 12) tInterval = 1;
        else if (visibleSecs < 30) tInterval = 2;
        else tInterval = 5;

        ctx.font = "8px sans-serif";
        ctx.textAlign = "center";
        for (let t = 0; t <= visibleSecs + tInterval; t += tInterval) {
          const col = SPEC_HISTORY - 1 - t * colsPerSec;
          const dispX = leftMargin + ((col - srcX) / srcW) * specW;
          if (dispX < leftMargin + 10 || dispX > w - 10) continue;
          // Tick
          ctx.strokeStyle = tickColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(dispX, specH);
          ctx.lineTo(dispX, specH + 3);
          ctx.stroke();
          // Label
          const ago = t + (SPEC_HISTORY - srcX - srcW) / colsPerSec;
          const label = ago < 0.01 ? "0s" : `-${ago % 1 === 0 ? ago.toFixed(0) : ago.toFixed(1)}s`;
          ctx.fillStyle = labelFill;
          ctx.fillText(label, dispX, h - 2);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open, theme, mode, paused]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={`absolute bottom-2 right-2 z-10 border-none rounded p-1.5 cursor-pointer ${
          open ? "bg-accent" : "bg-surface-3"
        }`}
        title="Toggle Scope"
      >
        <Activity
          size={16}
          color={open ? "var(--color-surface-0)" : "var(--color-text)"}
          strokeWidth={1.5}
        />
      </button>
      {open && (
        <div
          className="absolute bottom-10 right-2 z-10 bg-surface-1 border border-border-light rounded-lg overflow-hidden shadow-lg"
          style={{ width: 400, height: 240 }}
        >
          {/* Header */}
          <div className="flex items-center gap-1 px-2 py-1 bg-surface-2 border-b border-border">
            <button
              className={tabCls(mode === "scope")}
              onClick={() => setMode("scope")}
            >
              Scope
            </button>
            <button
              className={tabCls(mode === "spectrogram")}
              onClick={() => setMode("spectrogram")}
            >
              Spectrogram
            </button>
            <div className="flex-1" />
            {!audioRunning && (
              <span className="text-[10px] text-text-faint mr-1">
                No signal
              </span>
            )}
            <button
              className={iconBtnCls}
              onClick={() => setPaused(!paused)}
              title={paused ? "Resume" : "Pause"}
            >
              {paused ? (
                <Play size={12} strokeWidth={2} />
              ) : (
                <Pause size={12} strokeWidth={2} />
              )}
            </button>
            <button
              className={iconBtnCls}
              onClick={resetView}
              title="Reset zoom"
            >
              <RotateCcw size={12} strokeWidth={2} />
            </button>
          </div>
          {/* Canvas */}
          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              height: "calc(100% - 26px)",
              display: "block",
              cursor: "grab",
            }}
          />
        </div>
      )}
    </>
  );
}
