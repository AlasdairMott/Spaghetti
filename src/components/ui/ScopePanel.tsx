import { useRef, useEffect, useState } from "react";
import { useAppStore } from "../../store";
import { getAnalyserNode } from "../../audio/singleton";
import { Activity } from "lucide-react";

export function ScopePanel() {
  const audioRunning = useAppStore((s) => s.audioRunning);
  const theme = useAppStore((s) => s.theme);
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const bufferRef = useRef<Float32Array | null>(null);
  // Store CSS dimensions for drawing (after DPR scale, draw in CSS px)
  const cssSizeRef = useRef({ w: 320, h: 156 });

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

      ctx.fillStyle = isLight ? "#e8e4e0" : "#111";
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = isLight ? "#ccc" : "#222";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.moveTo(0, h / 4);
      ctx.lineTo(w, h / 4);
      ctx.moveTo(0, (3 * h) / 4);
      ctx.lineTo(w, (3 * h) / 4);
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();

      if (analyser) {
        if (
          !bufferRef.current ||
          bufferRef.current.length !== analyser.fftSize
        ) {
          bufferRef.current = new Float32Array(analyser.fftSize);
        }
        const buf = bufferRef.current;
        analyser.getFloatTimeDomainData(buf as Float32Array<ArrayBuffer>);

        ctx.strokeStyle = isLight ? "#4a9" : "#4f8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const len = buf.length;
        const step = len / w;
        for (let i = 0; i < w; i++) {
          const idx = Math.floor(i * step);
          const val = buf[idx];
          const y = ((1 - val) * h) / 2;
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open, theme]);

  // Resize canvas to match element size with DPR
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
          style={{ width: 320, height: 180 }}
        >
          <div className="flex items-center justify-between px-2 py-1 bg-surface-2 border-b border-border">
            <span className="text-[11px] text-text-muted uppercase tracking-wide">
              Scope
            </span>
            {!audioRunning && (
              <span className="text-[10px] text-text-faint">No signal</span>
            )}
          </div>
          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              height: "calc(100% - 24px)",
              display: "block",
            }}
          />
        </div>
      )}
    </>
  );
}
