"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Number Brain" (tabular classification + regression).
 *
 * No camera — pure data. Click the plane to drop labelled dots; the model
 * (nearest-centroid) paints the whole space into class regions so you SEE the
 * decision boundary it learned. Flip to Predict mode to fit a best-fit line
 * through points and forecast new values. PictoBlox's Numbers (Classify /
 * Regression) idea as a hands-on plot.
 */

const ACCENT = "#60a5fa";
const W = 380, H = 280;
const COLORS = ["#60a5fa", "#fb7185"];

type Mode = "classify" | "regress";
interface Dot { x: number; y: number; cls: number }

export default function NumberBrain() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<Mode>("classify");
  const [dots, setDots] = useState<Dot[]>([]);
  const [cls, setCls] = useState(0);

  const add = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    setDots((d) => [...d, { x, y, cls: mode === "classify" ? cls : 0 }]);
  }, [cls, mode]);

  // centroids for classification
  const centroids = (() => {
    const sums: { x: number; y: number; n: number }[] = [{ x: 0, y: 0, n: 0 }, { x: 0, y: 0, n: 0 }];
    for (const d of dots) { sums[d.cls].x += d.x; sums[d.cls].y += d.y; sums[d.cls].n++; }
    return sums.map((s) => (s.n ? { x: s.x / s.n, y: s.y / s.n } : null));
  })();

  // least-squares line for regression: y = m x + b
  const line = (() => {
    if (dots.length < 2) return null;
    const n = dots.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (const d of dots) { sx += d.x; sy += d.y; sxy += d.x * d.y; sxx += d.x * d.x; }
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-6) return null;
    const m = (n * sxy - sx * sy) / denom;
    const b = (sy - m * sx) / n;
    return { m, b };
  })();

  const accuracy = (() => {
    if (mode !== "classify" || dots.length === 0 || !centroids[0] || !centroids[1]) return null;
    let ok = 0;
    for (const d of dots) {
      const d0 = Math.hypot(d.x - centroids[0]!.x, d.y - centroids[0]!.y);
      const d1 = Math.hypot(d.x - centroids[1]!.x, d.y - centroids[1]!.y);
      if ((d0 <= d1 ? 0 : 1) === d.cls) ok++;
    }
    return Math.round((ok / dots.length) * 100);
  })();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b1018";
    ctx.fillRect(0, 0, W, H);

    if (mode === "classify" && centroids[0] && centroids[1]) {
      const step = 10;
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          const d0 = Math.hypot(x - centroids[0]!.x, y - centroids[0]!.y);
          const d1 = Math.hypot(x - centroids[1]!.x, y - centroids[1]!.y);
          ctx.fillStyle = (d0 <= d1 ? COLORS[0] : COLORS[1]) + "22";
          ctx.fillRect(x, y, step, step);
        }
      }
    }
    if (mode === "regress" && line) {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, line.b);
      ctx.lineTo(W, line.m * W + line.b);
      ctx.stroke();
    }
    for (const d of dots) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = mode === "classify" ? COLORS[d.cls] : ACCENT;
      ctx.fill();
      ctx.strokeStyle = "#0b1018";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [dots, mode, centroids, line]);

  return (
    <div className="mx-auto w-full max-w-[620px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="📊" title="Number Brain" grades="Grades 5–10" topic="Machine learning" accent={ACCENT} right={`${dots.length} points`} />

      <Caption accent={ACCENT} active={(accuracy ?? 0) >= 90 || (mode === "regress" && !!line)}>
        {mode === "classify"
          ? dots.length === 0
            ? "Click the box to drop dots. Use the two colour buttons to place each class — then watch the AI paint its decision boundary."
            : `The shaded regions are the model's guess for each spot. Training accuracy: ${accuracy ?? 0}%. Add points to reshape the boundary.`
          : line
            ? `Best-fit line learned: y = ${line.m.toFixed(2)}·x + ${line.b.toFixed(0)}. That's regression — predicting a number, not a class.`
            : "Click to drop points; once there are 2+, the AI fits a best-fit line through them to predict new values."}
      </Caption>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {(["classify", "regress"] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setDots([]); }} className="rounded-xl border-2 px-3 py-1.5 font-mono text-[10px]" style={{ borderColor: mode === m ? ACCENT : "#1e2738", background: mode === m ? `${ACCENT}1a` : "transparent", color: mode === m ? ACCENT : "#9fb0d0" }}>
            {m === "classify" ? "Sort into 2 groups" : "Predict a number (line)"}
          </button>
        ))}
        <button type="button" onClick={() => setDots([])} className="rounded-xl border border-[#2a3550] px-2.5 py-1.5 font-mono text-[10px] text-[#9fb0d0]">↺ clear</button>
      </div>

      <canvas ref={canvasRef} width={W} height={H} onClick={add} className="w-full cursor-crosshair rounded-2xl border border-[#1e2738]" style={{ aspectRatio: `${W}/${H}` }} />

      {mode === "classify" && (
        <div className="mt-2 flex gap-1.5">
          {COLORS.map((c, i) => (
            <button key={i} type="button" onClick={() => setCls(i)} className="flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 font-mono text-[10px]" style={{ borderColor: cls === i ? c : "#1e2738", color: cls === i ? c : "#9fb0d0" }}>
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} /> Place class {i + 1}
            </button>
          ))}
        </div>
      )}

      <Footer accent={ACCENT}>
        Most real-world AI runs on <Hi accent={ACCENT}>tables of numbers</Hi>, not images. Classification sorts rows into
        groups (spam / not-spam); regression predicts a number (a price, a score). Here each dot is a row with two
        features — the model learns from your examples and fills in the rest.
      </Footer>
    </div>
  );
}
