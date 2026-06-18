"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useCreations, type Creation } from "@/lib/creations";

const W = 16;
const H = 16;
const EMPTY = -1;
const PALETTE = [
  "#22d3ee", "#34d399", "#a3e635", "#f59e0b",
  "#f43f5e", "#ec4899", "#a855f7", "#3b82f6",
  "#ffffff", "#94a3b8", "#1e293b", "#000000",
];

export function PixelStudio() {
  const { creations, save, remove } = useCreations();
  const [cells, setCells] = useState<number[]>(() => Array(W * H).fill(EMPTY));
  const [color, setColor] = useState(0);
  const [erasing, setErasing] = useState(false);
  const drawing = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const paintAt = useCallback(
    (clientX: number, clientY: number) => {
      const el = gridRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const col = Math.floor(((clientX - r.left) / r.width) * W);
      const row = Math.floor(((clientY - r.top) / r.height) * H);
      if (col < 0 || col >= W || row < 0 || row >= H) return;
      const idx = row * W + col;
      const val = erasing ? EMPTY : color;
      setCells((prev) => (prev[idx] === val ? prev : prev.map((c, i) => (i === idx ? val : c))));
    },
    [color, erasing],
  );

  function onDown(e: ReactPointerEvent) {
    drawing.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    paintAt(e.clientX, e.clientY);
  }
  function onMove(e: ReactPointerEvent) {
    if (drawing.current) paintAt(e.clientX, e.clientY);
  }
  function onUp() {
    drawing.current = false;
  }

  function clearAll() {
    setCells(Array(W * H).fill(EMPTY));
  }

  function onSave() {
    if (cells.every((c) => c === EMPTY)) return;
    const name = window.prompt("Name your creation:", "My pixel art")?.trim();
    if (name === undefined) return;
    save({ name: name || "Untitled", kind: "pixel", w: W, h: H, palette: PALETTE, cells });
  }

  function exportPng() {
    const scale = 28;
    const c = document.createElement("canvas");
    c.width = W * scale;
    c.height = H * scale;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, c.width, c.height);
    cells.forEach((v, i) => {
      if (v >= 0) {
        ctx.fillStyle = PALETTE[v];
        ctx.fillRect((i % W) * scale, Math.floor(i / W) * scale, scale, scale);
      }
    });
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "curious-pixel-art.png";
    a.click();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {/* canvas */}
      <div>
        <div
          ref={gridRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          className="mx-auto grid aspect-square w-full max-w-[460px] touch-none select-none overflow-hidden rounded-xl border border-line"
          style={{ gridTemplateColumns: `repeat(${W}, 1fr)`, background: "#0b1020", cursor: "crosshair" }}
        >
          {cells.map((v, i) => (
            <div
              key={i}
              className="border-[0.5px] border-line/40"
              style={{ background: v >= 0 ? PALETTE[v] : "transparent" }}
            />
          ))}
        </div>

        {/* palette */}
        <div className="mx-auto mt-4 flex max-w-[460px] flex-wrap items-center justify-center gap-2">
          {PALETTE.map((c, i) => (
            <button
              key={c}
              onClick={() => {
                setColor(i);
                setErasing(false);
              }}
              aria-label={`colour ${i + 1}`}
              className="h-8 w-8 rounded-full transition-transform hover:scale-110"
              style={{
                background: c,
                outline: !erasing && color === i ? "2px solid #e8eefc" : "1px solid #1e2a44",
                outlineOffset: 2,
              }}
            />
          ))}
          <button
            onClick={() => setErasing(true)}
            className="grid h-8 w-8 place-items-center rounded-full border border-line text-sm"
            style={{ outline: erasing ? "2px solid #e8eefc" : "none", outlineOffset: 2 }}
            title="Eraser"
          >
            🧽
          </button>
        </div>

        {/* tools */}
        <div className="mx-auto mt-4 flex max-w-[460px] flex-wrap items-center justify-center gap-2">
          <button onClick={onSave} className="rounded-lg bg-neon-cyan px-4 py-2 text-sm font-medium text-[#05070d]">
            💾 Save
          </button>
          <button onClick={exportPng} className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm text-ink-dim hover:text-ink">
            ⬇️ Export PNG
          </button>
          <button onClick={clearAll} className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm text-ink-dim hover:text-neon-red">
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* gallery */}
      <aside>
        <h2 className="font-display text-lg font-bold text-ink">My creations</h2>
        {creations.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">Make something and hit Save — it&apos;ll show up here.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {creations.map((c) => (
              <GalleryItem key={c.id} c={c} onLoad={() => setCells([...c.cells])} onDelete={() => remove(c.id)} />
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function GalleryItem({ c, onLoad, onDelete }: { c: Creation; onLoad: () => void; onDelete: () => void }) {
  return (
    <div className="panel overflow-hidden p-2">
      <button onClick={onLoad} className="block w-full" title="Load into editor">
        <div
          className="grid aspect-square w-full overflow-hidden rounded"
          style={{ gridTemplateColumns: `repeat(${c.w}, 1fr)`, background: "#0b1020" }}
        >
          {c.cells.map((v, i) => (
            <div key={i} style={{ background: v >= 0 ? c.palette[v] : "transparent" }} />
          ))}
        </div>
      </button>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="truncate text-[11px] text-ink-dim">{c.name}</span>
        <button onClick={onDelete} className="text-[11px] text-ink-faint hover:text-neon-red" title="Delete">
          ✕
        </button>
      </div>
    </div>
  );
}
