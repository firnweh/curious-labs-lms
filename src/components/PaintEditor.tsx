"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small Scratch-style paint editor. Opens as a modal overlay, lets a child
 * draw on a 480×360 canvas, and returns a PNG data-URL via onSave.
 *
 * - mode "sprite"  → transparent canvas; result becomes a new sprite costume
 * - mode "costume" → transparent canvas; result is appended to a sprite
 * - mode "backdrop"→ canvas starts filled white; result becomes the backdrop
 */
type Mode = "sprite" | "costume" | "backdrop";
type Tool = "pencil" | "line" | "rect" | "ellipse" | "fill" | "eraser";
type Pt = { x: number; y: number };

const W = 480;
const H = 360;

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: "pencil", icon: "✏️", label: "Brush" },
  { id: "line", icon: "📏", label: "Line" },
  { id: "rect", icon: "▭", label: "Rectangle" },
  { id: "ellipse", icon: "⬭", label: "Ellipse" },
  { id: "fill", icon: "🪣", label: "Fill" },
  { id: "eraser", icon: "🧽", label: "Eraser" },
];

const SWATCHES = [
  "#000000", "#7f7f7f", "#ffffff", "#ff4d4d", "#ff9a3c", "#ffd633",
  "#4cd964", "#34c3ff", "#4c97ff", "#9966ff", "#ff66c4", "#a0522d",
];

const TITLES: Record<Mode, string> = {
  sprite: "Paint a new sprite",
  costume: "Paint a new costume",
  backdrop: "Paint a backdrop",
};

export function PaintEditor({ mode, onSave, onClose }: { mode: Mode; onSave: (dataUrl: string) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const start = useRef<Pt>({ x: 0, y: 0 });
  const last = useRef<Pt>({ x: 0, y: 0 });
  const snapshot = useRef<ImageData | null>(null); // for live shape preview
  const undoStack = useRef<ImageData[]>([]);
  const moved = useRef(false); // did the pointer move during this stroke?

  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#4c97ff");
  const [size, setSize] = useState(8);
  const [canUndo, setCanUndo] = useState(false);
  const [empty, setEmpty] = useState(false); // "draw something first" hint

  // Keep onClose fresh without re-running the setup effect (which would re-fill
  // a backdrop white and wipe the drawing on any parent re-render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ── Setup: runs once per modal instance (mount, or when the mode changes) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (mode === "backdrop") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
    }
    // Close on Escape.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function xy(e: React.PointerEvent): Pt {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(W - 1, (e.clientX - r.left) * (W / r.width))),
      y: Math.max(0, Math.min(H - 1, (e.clientY - r.top) * (H / r.height))),
    };
  }

  function pushUndo() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, W, H));
    if (undoStack.current.length > 30) undoStack.current.shift();
    setCanUndo(true);
  }

  function stroke(a: Pt, b: Pt, eraser: boolean) {
    const ctx = ctxRef.current!;
    ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function shape(a: Pt, b: Pt) {
    const ctx = ctxRef.current!;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    if (tool === "line") {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (tool === "rect") {
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else if (tool === "ellipse") {
      ctx.beginPath();
      ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function floodFill(px: number, py: number) {
    const ctx = ctxRef.current!;
    const img = ctx.getImageData(0, 0, W, H);
    const data = new Uint32Array(img.data.buffer);
    const x = Math.floor(px), y = Math.floor(py);
    const startIdx = y * W + x;
    const target = data[startIdx];
    const n = parseInt(color.slice(1), 16);
    const fill = (((255 << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0); // little-endian RGBA
    if (target === fill) return;
    const tr = target & 0xff, tg = (target >> 8) & 0xff, tb = (target >> 16) & 0xff, ta = (target >>> 24) & 0xff;
    const seedClear = ta <= 16; // filling a transparent region
    const tol = 16; // tight: absorbs anti-aliasing only, not distinct palette colors
    const match = (c: number) => {
      const ca = (c >>> 24) & 0xff;
      if (seedClear) return ca <= 16;  // spread only through transparent pixels — stop at any inked edge
      if (ca <= 16) return false;      // an opaque seed never crosses into transparent
      return Math.abs((c & 0xff) - tr) <= tol && Math.abs(((c >> 8) & 0xff) - tg) <= tol && Math.abs(((c >> 16) & 0xff) - tb) <= tol;
    };
    // Pre-push visited marking + a fixed Int32 stack bound the work to ~W*H pixels.
    const visited = new Uint8Array(W * H);
    const stack = new Int32Array(W * H);
    let sp = 0;
    stack[sp++] = startIdx;
    visited[startIdx] = 1;
    while (sp > 0) {
      const i = stack[--sp];
      if (!match(data[i])) continue;
      data[i] = fill;
      const cx = i % W, cy = (i / W) | 0;
      if (cx > 0 && !visited[i - 1]) { visited[i - 1] = 1; stack[sp++] = i - 1; }
      if (cx < W - 1 && !visited[i + 1]) { visited[i + 1] = 1; stack[sp++] = i + 1; }
      if (cy > 0 && !visited[i - W]) { visited[i - W] = 1; stack[sp++] = i - W; }
      if (cy < H - 1 && !visited[i + W]) { visited[i + W] = 1; stack[sp++] = i + W; }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ── Pointer handlers ─────────────────────────────────────────────────────
  function onDown(e: React.PointerEvent) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const p = xy(e);
    setEmpty(false);
    pushUndo();
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (tool === "fill") { floodFill(p.x, p.y); return; }
    drawing.current = true;
    moved.current = false;
    start.current = p;
    last.current = p;
    if (tool === "pencil" || tool === "eraser") {
      stroke(p, p, tool === "eraser"); // a single click leaves a dot
    } else {
      snapshot.current = ctx.getImageData(0, 0, W, H);
    }
  }

  function onMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    moved.current = true;
    const ctx = ctxRef.current!;
    const p = xy(e);
    if (tool === "pencil" || tool === "eraser") {
      stroke(last.current, p, tool === "eraser");
      last.current = p;
    } else if (snapshot.current) {
      ctx.putImageData(snapshot.current, 0, 0);
      shape(start.current, p);
    }
  }

  function onUp(e: React.PointerEvent) {
    // A shape tool tapped without dragging draws nothing — drop its phantom undo step.
    if (drawing.current && !moved.current && (tool === "line" || tool === "rect" || tool === "ellipse")) {
      undoStack.current.pop();
      setCanUndo(undoStack.current.length > 0);
    }
    drawing.current = false;
    snapshot.current = null;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function undo() {
    const ctx = ctxRef.current;
    const img = undoStack.current.pop();
    if (ctx && img) ctx.putImageData(img, 0, 0);
    setCanUndo(undoStack.current.length > 0);
  }

  function clearAll() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    pushUndo();
    ctx.clearRect(0, 0, W, H);
    if (mode === "backdrop") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H); }
  }

  function save() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    // Sprite/costume canvases start transparent — don't save an invisible blank.
    if (mode !== "backdrop") {
      const d = ctx.getImageData(0, 0, W, H).data;
      let hasInk = false;
      for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) { hasInk = true; break; } }
      if (!hasInk) { setEmpty(true); return; }
    }
    onSave(canvas.toDataURL("image/png"));
  }

  // ── UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[680px] rounded-2xl border border-[#D9D9D9] bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-sm font-semibold text-[#2E3856]">🎨 {TITLES[mode]}</p>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full border border-[#D9D9D9] text-[#575E75] hover:border-[#EC4C4C] hover:text-[#EC4C4C]">×</button>
        </div>

        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`grid h-9 w-9 place-items-center rounded-lg border text-lg transition-colors ${tool === t.id ? "border-[#4C97FF] bg-[#4C97FF]/15" : "border-[#D9D9D9] bg-white hover:border-[#4C97FF]/60"}`}
            >
              {t.icon}
            </button>
          ))}
          <div className="mx-1 h-6 w-px bg-[#E5E5E5]" />
          <label className="flex items-center gap-1.5 text-xs text-[#575E75]">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border border-[#D9D9D9] bg-white p-0.5" />
          </label>
          <label className="flex items-center gap-1.5 font-mono text-[10px] text-[#9AA0B3]">
            SIZE
            <input type="range" min={1} max={48} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-24 accent-[#4C97FF]" />
            <span className="w-5 text-right text-[#575E75]">{size}</span>
          </label>
          <div className="mx-1 h-6 w-px bg-[#E5E5E5]" />
          <button onClick={undo} disabled={!canUndo} className="rounded-lg border border-[#D9D9D9] px-2.5 py-1.5 text-xs text-[#575E75] enabled:hover:border-[#4C97FF] disabled:opacity-40">↩︎ Undo</button>
          <button onClick={clearAll} className="rounded-lg border border-[#D9D9D9] px-2.5 py-1.5 text-xs text-[#575E75] hover:border-[#EC4C4C] hover:text-[#EC4C4C]">Clear</button>
        </div>

        {/* Swatches */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SWATCHES.map((c) => (
            <button key={c} onClick={() => setColor(c)} title={c} className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${color.toLowerCase() === c.toLowerCase() ? "border-[#4C97FF] ring-2 ring-[#4C97FF]/40" : "border-[#D9D9D9]"}`} style={{ background: c }} />
          ))}
        </div>

        {/* Canvas (checkerboard shows transparency) */}
        <div
          className="relative mx-auto aspect-[4/3] w-full max-w-[600px] overflow-hidden rounded-xl border border-[#D9D9D9]"
          style={{ backgroundImage: "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)", backgroundSize: "16px 16px", backgroundPosition: "0 0,0 8px,8px -8px,-8px 0", backgroundColor: "#fff" }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="absolute inset-0 h-full w-full touch-none"
            style={{ cursor: "crosshair" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-end gap-2">
          {empty && <span className="mr-auto font-mono text-xs text-[#EC4C4C]">✋ Draw something first!</span>}
          <button onClick={onClose} className="rounded-full border border-[#D9D9D9] px-4 py-2 font-mono text-xs text-[#575E75] hover:bg-[#F2F2F2]">Cancel</button>
          <button onClick={save} className="rounded-full bg-[#4C97FF] px-5 py-2 font-mono text-xs font-semibold text-white hover:bg-[#3373CC]">✓ Save</button>
        </div>
      </div>
    </div>
  );
}
