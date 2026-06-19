"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── 3D House Designer 🏠 ──────────────────────────────────────────────────────
   JUNIOR (Grade 3, age ~8) THREE-D / CAD lab. Single learning goal: a 3D model
   is BUILT by combining solid shapes on a workplane — and DOORS & WINDOWS are
   made by SUBTRACTING holes (cutting openings) from a wall. On an isometric
   workplane the child sees a "build card" of four ghost outlines: a BOX body,
   a WEDGE roof, a DOOR hole and a WINDOW hole. From a palette they DRAG each big
   solid onto its matching ghost. Solids snap in and render in colour; the two
   "hole" shapes, dropped on the wall, CUT a real opening (wall pixels go
   transparent with a subtractive "pop"). Snapping is generous & forgiving — a
   miss just floats the shape home, never a scold. With all four placed, a big
   TURNTABLE button rotates the finished house to a second isometric angle
   (reinforcing 3D spatial thinking) and a "Ready to 3D print!" printer plays.
   Deterministic 4-shape match → onComplete(passed) ONCE. Always winnable. */

const ACCENT = "#f59e0b";

/* Every draggable solid + the order it should ideally go (any order works). */
type ShapeId = "wall" | "roof" | "door" | "window";

interface ShapeDef {
  id: ShapeId;
  /** Big palette emoji (no reading required). */
  emoji: string;
  /** aria word for screen readers. */
  word: string;
  /** true = a SOLID that snaps in; false = a HOLE that subtracts. */
  solid: boolean;
}

const SHAPES: Record<ShapeId, ShapeDef> = {
  wall: { id: "wall", emoji: "🧱", word: "box wall", solid: true },
  roof: { id: "roof", emoji: "🔺", word: "roof wedge", solid: true },
  door: { id: "door", emoji: "🚪", word: "door hole", solid: false },
  window: { id: "window", emoji: "🪟", word: "window hole", solid: false },
};

const PALETTE: readonly ShapeId[] = ["wall", "roof", "door", "window"];

/* ── Workplane geometry (virtual SVG units; CSS scales it responsively) ─────────
   One shared 100×100 viewBox. Each ghost target is a circle the dragged shape
   must land near. Snap radius is large & kind. */
const VB = 100;

interface Target {
  id: ShapeId;
  /** Centre of the ghost outline / snap point. */
  x: number;
  y: number;
}

/* Front-facing house, drawn on the iso plane. Roof on top, door & window on
   the front wall. These centres are where each shape snaps to. */
const TARGETS: Record<ShapeId, Target> = {
  wall: { id: "wall", x: 50, y: 60 },
  roof: { id: "roof", x: 50, y: 30 },
  door: { id: "door", x: 41, y: 70 },
  window: { id: "window", x: 61, y: 56 },
};

/** Generous snap distance (in viewBox units) — big forgiving targets. */
const SNAP_R = 17;

type Placed = Record<ShapeId, boolean>;
const NONE: Placed = { wall: false, roof: false, door: false, window: false };

/* A hole can only be cut once the WALL solid exists — keeps the lesson honest
   (you subtract FROM something). If a hole is dropped first it floats home with
   a kind nudge instead. */
type Phase = "build" | "solved";

interface DragState {
  id: ShapeId;
  /** Pointer position in viewBox units. */
  x: number;
  y: number;
}

export default function HouseDesigner({ onComplete }: ActivityProps) {
  const [placed, setPlaced] = useState<Placed>(NONE);
  const [drag, setDrag] = useState<DragState | null>(null);
  /** Shape id currently flashing its "cut!" subtract pop. */
  const [cutting, setCutting] = useState<ShapeId | null>(null);
  /** Palette tile nudging because it can't go yet (e.g. hole before wall). */
  const [nudge, setNudge] = useState<ShapeId | null>(null);
  /** Turntable angle: 0 = front view, 1 = rotated view. */
  const [angle, setAngle] = useState<0 | 1>(0);
  const [phase, setPhase] = useState<Phase>("build");

  const reportedRef = useRef<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const cutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const solved = phase === "solved";
  const wallUp = placed.wall;

  const doneCount = useMemo<number>(
    () => PALETTE.filter((id) => placed[id]).length,
    [placed],
  );

  useEffect(
    () => () => {
      if (cutTimer.current !== null) clearTimeout(cutTimer.current);
      if (nudgeTimer.current !== null) clearTimeout(nudgeTimer.current);
    },
    [],
  );

  const finishIfDone = useCallback(
    (next: Placed) => {
      if (PALETTE.every((id) => next[id]) && !reportedRef.current) {
        reportedRef.current = true;
        setPhase("solved");
        onComplete({ passed: true, stars: 3, detail: "Your house is ready to 3D print! 🏠" });
      }
    },
    [onComplete],
  );

  const bumpNudge = useCallback((id: ShapeId) => {
    setNudge(id);
    if (nudgeTimer.current !== null) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudge(null), 460);
  }, []);

  /** Translate a pointer event to viewBox coordinates. */
  const toView = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 50, y: 50 };
    const r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * VB;
    const y = ((clientY - r.top) / r.height) * VB;
    return { x, y };
  }, []);

  const startDrag = useCallback(
    (id: ShapeId, clientX: number, clientY: number) => {
      if (solved || placed[id]) return;
      const p = toView(clientX, clientY);
      setDrag({ id, x: p.x, y: p.y });
    },
    [solved, placed, toView],
  );

  const moveDrag = useCallback(
    (clientX: number, clientY: number) => {
      setDrag((d) => (d ? { ...d, ...toView(clientX, clientY) } : d));
    },
    [toView],
  );

  const endDrag = useCallback(() => {
    setDrag((d) => {
      if (!d) return null;
      const t = TARGETS[d.id];
      const dist = Math.hypot(d.x - t.x, d.y - t.y);
      const shape = SHAPES[d.id];

      // Holes need a wall to cut into. Dropped early → gentle nudge, floats home.
      if (!shape.solid && !wallUp) {
        bumpNudge(d.id);
        onComplete({
          passed: false,
          detail: "Build the box wall first, then cut the door or window into it. 🧱",
        });
        return null;
      }

      if (dist <= SNAP_R) {
        // Snap! Place the solid, or CUT the hole with a subtract pop.
        setPlaced((prev) => {
          const next: Placed = { ...prev, [d.id]: true };
          if (!shape.solid) {
            setCutting(d.id);
            if (cutTimer.current !== null) clearTimeout(cutTimer.current);
            cutTimer.current = setTimeout(() => setCutting(null), 520);
          }
          finishIfDone(next);
          return next;
        });
      } else {
        // A miss is never a scold — the shape simply floats back to the palette.
        onComplete({ passed: false, detail: "Almost! Drag it onto the glowing outline. ✨" });
      }
      return null;
    });
  }, [wallUp, bumpNudge, finishIfDone, onComplete]);

  const reset = useCallback(() => {
    if (cutTimer.current !== null) clearTimeout(cutTimer.current);
    if (nudgeTimer.current !== null) clearTimeout(nudgeTimer.current);
    reportedRef.current = false;
    setPlaced(NONE);
    setDrag(null);
    setCutting(null);
    setNudge(null);
    setAngle(0);
    setPhase("build");
  }, []);

  // Shift = which iso view we render (front vs rotated). Pure visual flourish.
  const rot = angle === 1;

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny visual status (emoji + progress dots) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          solved
            ? "Your house is finished. Three stars."
            : drag
              ? `Dragging the ${SHAPES[drag.id].word}. Drop it on its outline.`
              : `${doneCount} of 4 shapes placed. Drag a shape onto the build card.`
        }
        style={{
          background: solved ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${solved ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: solved ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{solved ? "🎉" : drag ? "✋" : "🏠"}</span>
        {solved ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="flex items-center gap-1">
            {PALETTE.map((id) => (
              <span
                key={id}
                className="block h-3 w-3 rounded-full transition-all"
                style={{
                  background: placed[id] ? ACCENT : "transparent",
                  border: `2px solid ${placed[id] ? ACCENT : "var(--color-line, #33405c)"}`,
                  boxShadow: placed[id] ? `0 0 8px ${ACCENT}` : "none",
                }}
              />
            ))}
          </span>
        )}
        {solved && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The isometric workplane / build card ── */}
      <div
        className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2"
        style={{
          boxShadow: solved ? `0 0 22px ${ACCENT}55, inset 0 0 0 2px ${ACCENT}` : undefined,
          transition: "box-shadow .3s",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB} ${VB}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="An isometric workplane showing a ghost house to build from shapes"
          onPointerMove={(e) => {
            if (drag) {
              e.preventDefault();
              moveDrag(e.clientX, e.clientY);
            }
          }}
          onPointerUp={() => {
            if (drag) endDrag();
          }}
          onPointerLeave={() => {
            if (drag) endDrag();
          }}
        >
          <defs>
            <radialGradient id="g33dhousedesigner-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* isometric floor grid */}
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={`grid-${i}`} stroke="rgba(120,140,170,0.18)" strokeWidth={0.4}>
              <line x1={10 + i * 20} y1={78} x2={10 + i * 20} y2={94} />
              <line x1={6} y1={80 + i * 3.2} x2={94} y2={80 + i * 3.2} />
            </g>
          ))}
          <text x={50} y={92} fontSize={5} textAnchor="middle" fill="rgba(180,195,220,0.5)" aria-hidden="true">
            workplane
          </text>

          {/* ── Ghost outlines (the build card) — dashed where empty ── */}
          {!placed.wall && <GhostWall />}
          {!placed.roof && <GhostRoof />}

          {/* ── Placed solids render in colour ── */}
          {placed.wall && <WallSolid rot={rot} />}
          {placed.roof && <RoofSolid rot={rot} />}

          {/* ── Holes: ghost outline when wall is up & not yet cut ── */}
          {placed.wall && !placed.door && <GhostHole id="door" />}
          {placed.wall && !placed.window && <GhostHole id="window" />}

          {/* ── Cut openings (transparent gaps in the wall) ── */}
          {placed.door && <Opening id="door" cutting={cutting === "door"} />}
          {placed.window && <Opening id="window" cutting={cutting === "window"} />}

          {/* ── The shape being dragged, following the pointer ── */}
          {drag && (
            <g
              transform={`translate(${drag.x} ${drag.y})`}
              style={{ pointerEvents: "none" }}
              aria-hidden="true"
            >
              <circle r={11} fill="url(#g33dhousedesigner-glow)" />
              <text x={0} y={0} fontSize={13} textAnchor="middle" dominantBaseline="central">
                {SHAPES[drag.id].emoji}
              </text>
            </g>
          )}

          {/* celebration sparkles */}
          {solved && (
            <>
              <text x={16} y={20} fontSize={9} aria-hidden="true" style={{ animation: "g33dhousedesigner-spark 1s 0.1s ease-out both" }}>
                ✨
              </text>
              <text x={82} y={24} fontSize={9} aria-hidden="true" style={{ animation: "g33dhousedesigner-spark 1s 0.3s ease-out both" }}>
                ⭐
              </text>
              <text x={78} y={70} fontSize={9} aria-hidden="true" style={{ animation: "g33dhousedesigner-spark 1s 0.5s ease-out both" }}>
                🎉
              </text>
            </>
          )}
        </svg>

        {/* the little 3D printer that runs on win */}
        {solved && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center gap-1"
            aria-hidden="true"
          >
            <div className="text-3xl" style={{ animation: "g33dhousedesigner-print 1.4s ease-in-out infinite" }}>
              🖨️
            </div>
            <div className="text-xs font-bold" style={{ color: ACCENT }}>
              Ready to 3D print!
            </div>
          </div>
        )}
      </div>

      {/* ── Turntable: rotate the finished house to admire it ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          if (solved) setAngle((a) => (a === 0 ? 1 : 0));
        }}
        disabled={!solved}
        aria-label="Turntable: rotate the house to see another 3D angle"
        className="flex min-h-[48px] items-center gap-2 rounded-2xl px-5 py-2 text-base font-bold transition active:scale-95 disabled:opacity-40"
        style={{
          touchAction: "none",
          background: solved ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${solved ? ACCENT : "var(--color-line, #33405c)"}`,
          color: solved ? ACCENT : "var(--color-ink-dim, #9fb0cc)",
        }}
      >
        <span className="text-2xl" aria-hidden="true">
          🔄
        </span>
        <span aria-hidden="true">Spin it!</span>
      </button>

      {/* ── Palette of draggable shapes: BIG drag targets ── */}
      <div
        className="grid w-full max-w-[420px] grid-cols-4 gap-2"
        role="group"
        aria-label="Drag a shape onto the build card"
      >
        {PALETTE.map((id) => {
          const isPlaced = placed[id];
          const isDragging = drag?.id === id;
          const isNudge = nudge === id;
          const shape = SHAPES[id];
          return (
            <button
              key={id}
              type="button"
              disabled={solved || isPlaced}
              aria-label={
                isPlaced
                  ? `${shape.word} already placed`
                  : `Drag the ${shape.word} onto its outline`
              }
              onPointerDown={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
                startDrag(id, e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (drag) {
                  e.preventDefault();
                  moveDrag(e.clientX, e.clientY);
                }
              }}
              onPointerUp={() => {
                if (drag) endDrag();
              }}
              className="relative grid aspect-square min-h-[64px] place-items-center rounded-2xl text-4xl transition active:scale-95 disabled:opacity-50"
              style={{
                touchAction: "none",
                background: isPlaced
                  ? "rgba(245,158,11,0.12)"
                  : isDragging
                    ? "rgba(245,158,11,0.16)"
                    : "rgba(255,255,255,0.05)",
                border: `2px ${shape.solid ? "solid" : "dashed"} ${
                  isPlaced || isDragging ? ACCENT : "var(--color-line, #33405c)"
                }`,
                boxShadow: isDragging ? `0 0 14px ${ACCENT}88` : "none",
                opacity: isDragging ? 0.35 : 1,
                animation: isNudge ? "g33dhousedesigner-wobble 0.45s ease-in-out" : undefined,
              }}
            >
              <span aria-hidden="true">{isPlaced ? "✅" : shape.emoji}</span>
              {!shape.solid && !isPlaced && (
                <span
                  className="pointer-events-none absolute bottom-0 right-1 text-[10px]"
                  style={{ color: ACCENT }}
                  aria-hidden="true"
                >
                  cut
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Reset control ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over"
        className="flex min-h-[52px] items-center gap-2 rounded-2xl px-6 py-3 text-base font-bold transition active:scale-95"
        style={{
          touchAction: "none",
          background: "var(--color-panel-2, #11182f)",
          border: "2px solid var(--color-line, #33405c)",
          color: "var(--color-ink, #e8eefc)",
        }}
      >
        <span className="text-2xl" aria-hidden="true">
          🔄
        </span>
        <span aria-hidden="true">Reset</span>
      </button>
    </div>
  );
}

/* ── SVG shape pieces (all on the shared 100×100 viewBox) ─────────────────────── */

/** Dashed ghost outline of the box body. */
function GhostWall() {
  return (
    <g aria-hidden="true">
      <circle cx={TARGETS.wall.x} cy={TARGETS.wall.y} r={SNAP_R} fill="url(#g33dhousedesigner-glow)" opacity={0.5} />
      <polygon
        points="32,48 50,42 68,48 68,72 50,78 32,72"
        fill="rgba(245,158,11,0.06)"
        stroke={ACCENT}
        strokeWidth={0.9}
        strokeDasharray="3 2.5"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Dashed ghost outline of the wedge roof. */
function GhostRoof() {
  return (
    <g aria-hidden="true">
      <circle cx={TARGETS.roof.x} cy={TARGETS.roof.y} r={SNAP_R} fill="url(#g33dhousedesigner-glow)" opacity={0.45} />
      <polygon
        points="32,46 50,24 68,46 50,40"
        fill="rgba(245,158,11,0.06)"
        stroke={ACCENT}
        strokeWidth={0.9}
        strokeDasharray="3 2.5"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Dashed ghost outline of a hole (door or window). */
function GhostHole({ id }: { id: "door" | "window" }) {
  const t = TARGETS[id];
  const isDoor = id === "door";
  const w = isDoor ? 8 : 9;
  const h = isDoor ? 14 : 8;
  return (
    <g aria-hidden="true">
      <circle cx={t.x} cy={t.y} r={SNAP_R} fill="url(#g33dhousedesigner-glow)" opacity={0.4} />
      <rect
        x={t.x - w / 2}
        y={t.y - h / 2}
        width={w}
        height={h}
        rx={1}
        fill="rgba(7,10,18,0.55)"
        stroke={ACCENT}
        strokeWidth={0.8}
        strokeDasharray="2.5 2"
      />
      <text x={t.x} y={t.y + 1.5} fontSize={5} textAnchor="middle" dominantBaseline="central">
        {isDoor ? "🚪" : "🪟"}
      </text>
    </g>
  );
}

/** The solid box body — two shaded iso faces. `rot` swaps the lit side. */
function WallSolid({ rot }: { rot: boolean }) {
  const left = rot ? "#f5a623" : "#d98a18";
  const right = rot ? "#d98a18" : "#f5a623";
  return (
    <g aria-hidden="true" style={{ animation: "g33dhousedesigner-pop 0.4s ease both" }}>
      {/* front face */}
      <polygon points="32,48 50,54 50,78 32,72" fill={left} stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} strokeLinejoin="round" />
      {/* side face */}
      <polygon points="50,54 68,48 68,72 50,78" fill={right} stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} strokeLinejoin="round" />
      {/* top */}
      <polygon points="32,48 50,42 68,48 50,54" fill="#fbbf6e" stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} strokeLinejoin="round" />
    </g>
  );
}

/** The wedge roof sitting on the box. */
function RoofSolid({ rot }: { rot: boolean }) {
  const left = rot ? "#e0561a" : "#b8431a";
  const right = rot ? "#b8431a" : "#e0561a";
  return (
    <g aria-hidden="true" style={{ animation: "g33dhousedesigner-pop 0.4s ease both" }}>
      <polygon points="32,46 50,28 50,42" fill={left} stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points="50,28 68,46 50,42" fill={right} stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points="32,46 50,40 68,46 50,52" fill="#cf4d1c" stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} strokeLinejoin="round" />
    </g>
  );
}

/** A cut opening: a transparent gap punched into the wall. */
function Opening({ id, cutting }: { id: "door" | "window"; cutting: boolean }) {
  const t = TARGETS[id];
  const isDoor = id === "door";
  const w = isDoor ? 7 : 8;
  const h = isDoor ? 13 : 7;
  return (
    <g aria-hidden="true">
      {cutting && (
        <rect
          x={t.x - w / 2 - 3}
          y={t.y - h / 2 - 3}
          width={w + 6}
          height={h + 6}
          rx={2}
          fill={ACCENT}
          opacity={0.6}
          style={{ animation: "g33dhousedesigner-cut 0.5s ease-out both" }}
        />
      )}
      {/* the hole itself — dark/transparent, as if the wall is gone here */}
      <rect
        x={t.x - w / 2}
        y={t.y - h / 2}
        width={w}
        height={h}
        rx={1}
        fill="#070a12"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={0.5}
        style={{ animation: cutting ? "g33dhousedesigner-pop 0.45s ease both" : undefined }}
      />
    </g>
  );
}

const KEYFRAMES = `
@keyframes g33dhousedesigner-wobble {
  0%,100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-5px) rotate(-3deg); }
  45% { transform: translateX(5px) rotate(3deg); }
  70% { transform: translateX(-3px) rotate(-2deg); }
  90% { transform: translateX(2px) rotate(1deg); }
}
@keyframes g33dhousedesigner-pop {
  0% { transform: scale(0.9); }
  55% { transform: scale(1.06); }
  100% { transform: scale(1); }
}
@keyframes g33dhousedesigner-cut {
  0% { transform: scale(0.6); opacity: 0.85; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes g33dhousedesigner-spark {
  0% { transform: scale(0) rotate(0deg); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: scale(1.3) rotate(35deg); opacity: 0; }
}
@keyframes g33dhousedesigner-print {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
