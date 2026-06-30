"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Pixel Lab" (image processing, the OpenCV way).
 *
 * The same operations classic computer-vision libraries (like OpenCV) run: take
 * the webcam frame as a grid of numbers and transform it — greyscale, invert,
 * threshold, pixelate, edge-detect. No ML model at all; pure maths on pixels.
 * Drives home that "an image is just numbers" before any AI looks at it. Goal:
 * try every filter.
 */

const ACCENT = "#a855f7";
const W = 360, H = 270;

type Filter = "live" | "gray" | "invert" | "threshold" | "pixelate" | "edges";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "gray", label: "Greyscale" },
  { id: "invert", label: "Invert" },
  { id: "threshold", label: "Black/White" },
  { id: "pixelate", label: "Pixelate" },
  { id: "edges", label: "Find edges" },
];

function apply(filter: Filter, ctx: CanvasRenderingContext2D) {
  if (filter === "live") return;
  if (filter === "pixelate") {
    const block = 12;
    const small = ctx.getImageData(0, 0, W, H);
    for (let y = 0; y < H; y += block) {
      for (let x = 0; x < W; x += block) {
        const i = (y * W + x) * 4;
        ctx.fillStyle = `rgb(${small.data[i]},${small.data[i + 1]},${small.data[i + 2]})`;
        ctx.fillRect(x, y, block, block);
      }
    }
    return;
  }
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  if (filter === "edges") {
    // Sobel on a greyscale copy
    const g = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    const out = ctx.createImageData(W, H);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const gx = -g[(y - 1) * W + x - 1] - 2 * g[y * W + x - 1] - g[(y + 1) * W + x - 1]
          + g[(y - 1) * W + x + 1] + 2 * g[y * W + x + 1] + g[(y + 1) * W + x + 1];
        const gy = -g[(y - 1) * W + x - 1] - 2 * g[(y - 1) * W + x] - g[(y - 1) * W + x + 1]
          + g[(y + 1) * W + x - 1] + 2 * g[(y + 1) * W + x] + g[(y + 1) * W + x + 1];
        const m = Math.min(255, Math.hypot(gx, gy));
        const i = (y * W + x) * 4;
        out.data[i] = out.data[i + 1] = out.data[i + 2] = m;
        out.data[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    return;
  }
  for (let i = 0; i < d.length; i += 4) {
    if (filter === "gray") {
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = v;
    } else if (filter === "invert") {
      d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2];
    } else if (filter === "threshold") {
      const v = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) > 110 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export default function PixelLab() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const filterRef = useRef<Filter>("live");
  const [filter, setFilter] = useState<Filter>("live");
  const [tried, setTried] = useState<Record<string, boolean>>({ live: true });

  const loop = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(video, 0, 0, W, H);
      apply(filterRef.current, ctx);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (status !== "on") return;
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [status, loop]);

  useEffect(() => () => stop(), [stop]);

  const pick = (f: Filter) => {
    filterRef.current = f;
    setFilter(f);
    setTried((t) => (t[f] ? t : { ...t, [f]: true }));
  };

  const triedCount = FILTERS.filter((f) => tried[f.id]).length;
  const allDone = triedCount === FILTERS.length;
  const live = status === "on";

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🎛️" title="Pixel Lab" grades="Grades 4–9" topic="Computer vision" accent={ACCENT} right={`${triedCount}/${FILTERS.length} filters`} />

      <Caption accent={ACCENT} active={allDone}>
        {allDone
          ? "🧮 You ran every filter! None of these used AI — they're just maths on a grid of numbers. 'Find edges' is exactly how vision systems spot shapes before a smart model ever looks. Pixels first, AI second."
          : live
            ? `Filter: ${FILTERS.find((f) => f.id === filter)?.label}. Try the rest below.`
            : "Turn on the camera and bend your video with classic image-processing filters."}
      </Caption>

      <div className="relative mx-auto aspect-[4/3] w-full max-w-[420px] overflow-hidden rounded-2xl border" style={{ borderColor: live ? `${ACCENT}66` : "#1e2738", background: "#060912" }}>
        <video ref={videoRef} playsInline muted className="hidden" />
        <canvas ref={canvasRef} width={W} height={H} className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
        {!live && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            <div className="flex flex-col items-center gap-3">
              <span aria-hidden style={{ fontSize: 40 }}>🎛️</span>
              {error && <p className="max-w-[260px] font-mono text-[11px] text-[#fb7185]">{error}</p>}
              <button type="button" onClick={start} className="rounded-xl border-2 px-4 py-2 font-mono text-xs font-semibold" style={{ borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` }}>
                {error ? "Try again" : "▶ Turn on camera"}
              </button>
              <p className="max-w-[260px] font-mono text-[9px] text-[#5b6b8c]">Everything runs on your device.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => pick(f.id)}
              disabled={!live}
              className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px] transition-colors disabled:opacity-40"
              style={{ borderColor: on ? ACCENT : "#1e2738", background: on ? `${ACCENT}1a` : "transparent", color: on ? ACCENT : "#9fb0d0" }}
            >
              {tried[f.id] && !on ? "✓ " : ""}{f.label}
            </button>
          );
        })}
      </div>

      <Footer accent={ACCENT}>
        Libraries like <Hi accent={ACCENT}>OpenCV</Hi> treat an image as a grid of numbers and run fast maths on them —
        greyscale averages the colours, invert flips them, edge-detection finds where numbers change sharply. This
        “classic” computer vision often runs <Hi accent={ACCENT}>before</Hi> a neural network, to clean up the picture.
      </Footer>
    </div>
  );
}
