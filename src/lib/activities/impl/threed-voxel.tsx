"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Voxel Architect — a 3D MODELLING / spatial-reasoning lab (CLASS 4-6).
 *
 * Build in 3D WITHOUT three.js: a per-layer 2D editor drives a live ISOMETRIC
 * preview rendered in pure SVG. Each filled voxel (x,y,z) is projected to iso
 * screen coords and drawn as 3 shaded cube faces (light top, darker sides),
 * painter-sorted by (x+y+z) so nearer cubes overlap farther ones.
 *
 * WHY IT'S A PROBLEM, NOT A COPY-TASK:
 *  Instead of a ghost that highlights every target cell on the editor grid
 *  (which turned the old version into mindless tracing), the child is given a
 *  real engineer's BLUEPRINT: three orthographic silhouettes — FRONT, SIDE and
 *  TOP — exactly like a CAD/engineering drawing. They must READ the three flat
 *  views and REASON which cube goes at each (x,y,z). The editor grid no longer
 *  reveals the answer, so copy-tracing is impossible: you have to plan.
 *
 *  Escalation across THREE rounds:
 *   • R1 "Pyramid step" — gentle: a 3-tier stepped pyramid. Reading three views
 *     onto a 4×4×3 volume; mostly solid, builds confidence with the blueprint.
 *   • R2 "Archway" — a TWIST: there is a hole (a tunnel) through the middle, so
 *     the obvious "fill the whole footprint and stack it up" guess is WRONG.
 *     The top view shows a solid roof but the front view shows the gap beneath —
 *     you must keep z=1 hollow under the bridge.
 *   • R3 "Floating chair" — an OVERHANG: cubes hang out over empty space with
 *     nothing under them. "Towers only grow off the ground" intuition fails;
 *     you must read the side view to see the seat juts forward unsupported.
 *
 *  OPTIMIZATION / STARS: a perfectly-clean solve (exact match, no wasted
 *  checks) on every round earns 3 stars. Getting there but with several wrong
 *  checks along the way still wins, with fewer stars — a sloppy build is still
 *  a win, just not a perfect one. Always winnable, never scolds.
 *
 * Deterministic. Self-contained. Calls onComplete exactly once on final win.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#f59e0b";

const SIZE = 4; // 4×4 footprint
const LAYERS = 3; // z = 0,1,2

/** A voxel coordinate. x→right, y→back, z→up. */
interface Vox {
  x: number;
  y: number;
  z: number;
}

const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;

interface Round {
  name: string;
  hint: string;
  /** The exact set of voxels the build must match. */
  cells: readonly Vox[];
}

/* ── Three hand-authored, escalating target shapes. ──
 * Each is described as voxel coordinates inside a 4×4×3 volume. They are read
 * by the player through orthographic FRONT / SIDE / TOP silhouettes only. */

// R1 — Stepped pyramid: a 3-tier wedding-cake. z grows toward the back-left.
const R1: Vox[] = (() => {
  const out: Vox[] = [];
  // z=0 full 4×4 base; z=1 inner 3×3 (back-left corner); z=2 inner 2×2.
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) out.push({ x, y, z: 0 });
  for (let x = 0; x < 3; x++) for (let y = 1; y < 4; y++) out.push({ x, y, z: 1 });
  for (let x = 0; x < 2; x++) for (let y = 2; y < 4; y++) out.push({ x, y, z: 2 });
  return out;
})();

// R2 — Archway / tunnel: two solid legs, a roof bridging them, a HOLE beneath.
const R2: Vox[] = (() => {
  const out: Vox[] = [];
  // Two legs at x=0 and x=3, full depth (y 0..3), full height (z 0..2).
  for (const x of [0, 3]) {
    for (let y = 0; y < 4; y++) for (let z = 0; z < 3; z++) out.push({ x, y, z });
  }
  // Roof bridges across the top (z=2) at the inner columns x=1,2 — but NOT below.
  for (const x of [1, 2]) {
    for (let y = 0; y < 4; y++) out.push({ x, y, z: 2 });
  }
  // Under the roof (x=1,2 ; z=0,1) stays EMPTY → the tunnel. That's the twist.
  return out;
})();

// R3 — Floating chair: a seat that juts forward over empty space (overhang).
const R3: Vox[] = (() => {
  const out: Vox[] = [];
  // Back wall (the chair back): x=3, full depth, full height.
  for (let y = 0; y < 4; y++) for (let z = 0; z < 3; z++) out.push({ x: 3, y, z });
  // A single support leg at z=0 under the back only (x=2,3) so it can stand.
  for (let y = 0; y < 4; y++) out.push({ x: 2, y, z: 0 });
  // The SEAT at z=1 juts forward to x=0,1,2 — overhanging x=0,1 with nothing
  // underneath at z=0. Reading the SIDE view is the only way to see this.
  for (let x = 0; x < 3; x++) for (let y = 0; y < 4; y++) out.push({ x, y, z: 1 });
  return out;
})();

const ROUNDS: readonly Round[] = [
  {
    name: "Stepped Pyramid",
    hint: "Read the 3 blueprints. Each layer is a smaller square — stack them.",
    cells: R1,
  },
  {
    name: "The Archway",
    hint: "There's a TUNNEL! The roof bridges the gap — keep the middle hollow underneath.",
    cells: R2,
  },
  {
    name: "Floating Seat",
    hint: "The seat hangs out over empty air. Check the SIDE view — some cubes float!",
    cells: R3,
  },
];

const roundSet = (cells: readonly Vox[]): ReadonlySet<string> =>
  new Set(cells.map((v) => key(v.x, v.y, v.z)));

/* ── Orthographic silhouettes (the blueprint the player reads). ──
 * front = looking along −y: which (x,z) columns have ANY cube? (collapse y)
 * side  = looking along +x: which (y,z) have ANY cube? (collapse x)
 * top   = looking down −z:  which (x,y) have ANY cube? (collapse z)            */
function silhouettes(cells: readonly Vox[]): {
  front: boolean[][]; // [z][x]
  side: boolean[][]; // [z][y]
  top: boolean[][]; // [y][x]
} {
  const front: boolean[][] = Array.from({ length: LAYERS }, () =>
    Array(SIZE).fill(false),
  );
  const side: boolean[][] = Array.from({ length: LAYERS }, () =>
    Array(SIZE).fill(false),
  );
  const top: boolean[][] = Array.from({ length: SIZE }, () =>
    Array(SIZE).fill(false),
  );
  for (const v of cells) {
    front[v.z][v.x] = true;
    side[v.z][v.y] = true;
    top[v.y][v.x] = true;
  }
  return { front, side, top };
}

/* ── Isometric projection ── */
const VIEW_W = 260;
const VIEW_H = 240;
const TW = 28; // tile half-width
const TH = 14; // tile half-height
const ZH = 24; // vertical lift per z layer
const ORIGIN_X = VIEW_W / 2;
const ORIGIN_Y = 64;

interface Pt {
  sx: number;
  sy: number;
}

function project(x: number, y: number, z: number): Pt {
  return {
    sx: ORIGIN_X + (x - y) * TW,
    sy: ORIGIN_Y + (x + y) * TH - z * ZH,
  };
}

function cubeFaces(p: Pt): { top: string; left: string; right: string } {
  const { sx, sy } = p;
  const tBack = `${sx},${sy - TH}`;
  const tRight = `${sx + TW},${sy}`;
  const tFront = `${sx},${sy + TH}`;
  const tLeft = `${sx - TW},${sy}`;
  const top = `${tBack} ${tRight} ${tFront} ${tLeft}`;
  const left = `${sx - TW},${sy} ${sx},${sy + TH} ${sx},${sy + TH + ZH} ${sx - TW},${sy + ZH}`;
  const right = `${sx},${sy + TH} ${sx + TW},${sy} ${sx + TW},${sy + ZH} ${sx},${sy + TH + ZH}`;
  return { top, left, right };
}

const FACE_TOP = "#ffd479";
const FACE_LEFT = "#c97e08";
const FACE_RIGHT = "#9a5e05";
const EDGE = "#5c3a02";

type Phase = "build" | "won" | "done";

export default function VoxelArchitect({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [filled, setFilled] = useState<ReadonlySet<string>>(() => new Set());
  const [layer, setLayer] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("build");
  const [status, setStatus] = useState<string>(
    "Read the 3 blueprints, then build the shape layer by layer.",
  );
  const [wrongChecks, setWrongChecks] = useState<number>(0);

  const reportedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const r = ROUNDS[round];
  const targetSet = useMemo(() => roundSet(r.cells), [r]);
  const targetCount = targetSet.size;
  const views = useMemo(() => silhouettes(r.cells), [r]);

  const solvedRound = phase === "won" || phase === "done";
  const allDone = phase === "done";

  // Reset the build whenever a fresh round loads.
  useEffect(() => {
    setFilled(new Set());
    setLayer(0);
  }, [round]);

  const toggleCell = useCallback(
    (x: number, y: number) => {
      if (solvedRound) return;
      const k = key(x, y, layer);
      setFilled((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      });
      setStatus("Building… read all three views before you check.");
    },
    [layer, solvedRound],
  );

  const clearAll = useCallback(() => {
    if (solvedRound) return;
    setFilled(new Set());
    setLayer(0);
    setStatus("Cleared this layer set. Rebuild from the blueprints!");
  }, [solvedRound]);

  const check = useCallback(() => {
    if (solvedRound) return;
    let matches = 0;
    let extra = 0;
    for (const k of filled) {
      if (targetSet.has(k)) matches += 1;
      else extra += 1;
    }
    const missing = targetCount - matches;

    if (matches === targetCount && extra === 0) {
      const last = round >= ROUNDS.length - 1;
      if (last) {
        // Stars by how clean the whole 3-round build was.
        const stars = wrongChecks === 0 ? 3 : wrongChecks <= 3 ? 2 : 1;
        setPhase("done");
        setStatus(
          stars === 3
            ? "All three models built — flawless engineering! 🏆"
            : "All three models built! Great spatial work. 🎉",
        );
        if (!reportedRef.current) {
          reportedRef.current = true;
          onComplete({
            passed: true,
            stars,
            detail:
              stars === 3
                ? "Perfect — read every blueprint with no wrong checks!"
                : `Solved all 3 models (${wrongChecks} wrong check${wrongChecks === 1 ? "" : "s"}).`,
          });
        }
      } else {
        setPhase("won");
        setStatus(`${r.name} complete! Next blueprint loading… ✓`);
        clearTimer();
        timerRef.current = setTimeout(() => {
          setPhase("build");
          setRound((n) => n + 1);
          setStatus("New blueprint! Read all three views, then build.");
        }, 1300);
      }
      return;
    }

    // Wrong — gentle, specific nudge. No onComplete(false), keep the build.
    setWrongChecks((w) => w + 1);
    const parts: string[] = [`${matches} / ${targetCount} cubes correct`];
    if (extra > 0)
      parts.push(`${extra} stray cube${extra > 1 ? "s" : ""} to remove`);
    if (missing > 0) parts.push(`${missing} still missing`);
    setStatus(parts.join(" · ") + " — re-check the views!");
  }, [
    solvedRound,
    filled,
    targetSet,
    targetCount,
    round,
    wrongChecks,
    onComplete,
    r,
    clearTimer,
  ]);

  /* ── Iso draw list for the live preview (painter-sorted). ── */
  const isoCubes = useMemo(() => {
    const list: { v: Vox; depth: number }[] = [];
    for (const k of filled) {
      const [x, y, z] = k.split(",").map(Number);
      list.push({ v: { x, y, z }, depth: x + y + z });
    }
    list.sort((a, b) => a.depth - b.depth);
    return list;
  }, [filled]);

  const placedOnLayer = useMemo(() => {
    let n = 0;
    for (const k of filled) if (k.endsWith(`,${layer}`)) n += 1;
    return n;
  }, [filled, layer]);

  const totalPlaced = filled.size;

  /* ── Small blueprint grid renderer (orthographic silhouette). ── */
  const Blueprint = ({
    title,
    grid,
    rows,
    cols,
    flipRows,
  }: {
    title: string;
    grid: boolean[][];
    rows: number;
    cols: number;
    flipRows: boolean; // draw row 0 at the BOTTOM (for z, ground is low)
  }): React.ReactElement => {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] font-display tracking-tech text-ink-dim">
          {title}
        </span>
        <div
          className="grid gap-[2px] rounded-md p-[3px]"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--color-line, #33405c)",
          }}
          role="img"
          aria-label={`${title} blueprint silhouette`}
        >
          {Array.from({ length: rows * cols }).map((_, idx) => {
            const rr = Math.floor(idx / cols);
            const cc = idx % cols;
            const srcRow = flipRows ? rows - 1 - rr : rr;
            const on = grid[srcRow]?.[cc] ?? false;
            return (
              <span
                key={idx}
                aria-hidden="true"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: on ? ACCENT : "rgba(255,255,255,0.04)",
                  boxShadow: on ? `0 0 4px ${ACCENT}99` : undefined,
                  border: on
                    ? "1px solid #7a4d03"
                    : "1px solid rgba(120,140,170,0.18)",
                }}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full flex-col gap-3 font-mono text-ink">
      {/* round progress + name */}
      <div className="flex items-center justify-between text-[11px] text-ink-dim">
        <span className="font-display tracking-tech">
          MODEL {round + 1}/3 · {r.name.toUpperCase()}
        </span>
        <span aria-hidden="true" className="inline-flex items-center gap-1.5">
          {ROUNDS.map((_, i) => {
            const past = i < round || allDone;
            const cur = i === round && !allDone;
            return (
              <span
                key={i}
                className="rounded-full"
                style={{
                  height: 10,
                  width: 10,
                  background: past
                    ? ACCENT
                    : cur
                      ? "rgba(245,158,11,0.3)"
                      : "rgba(255,255,255,0.06)",
                  border: `2px solid ${past || cur ? ACCENT : "rgba(120,140,170,0.35)"}`,
                  boxShadow: cur ? `0 0 6px ${ACCENT}88` : undefined,
                }}
              />
            );
          })}
        </span>
      </div>

      {/* ── BLUEPRINT row: front / side / top silhouettes (the puzzle to read) ── */}
      <div
        className="flex items-start justify-around gap-2 rounded-xl p-2"
        style={{
          background: "rgba(245,158,11,0.05)",
          border: `1px solid ${ACCENT}55`,
        }}
        aria-label="Engineering blueprint: three orthographic views to read"
      >
        <Blueprint
          title="FRONT"
          grid={views.front}
          rows={LAYERS}
          cols={SIZE}
          flipRows
        />
        <Blueprint
          title="SIDE"
          grid={views.side}
          rows={LAYERS}
          cols={SIZE}
          flipRows
        />
        <Blueprint
          title="TOP"
          grid={views.top}
          rows={SIZE}
          cols={SIZE}
          flipRows={false}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {/* ── Isometric preview ── */}
        <div className="panel relative flex-1 rounded-xl p-2">
          <div className="mb-1 flex items-center justify-between px-1 text-[11px] text-ink-dim">
            <span className="font-display tracking-tech">YOUR 3D MODEL</span>
            <span aria-hidden="true">{totalPlaced} cubes</span>
          </div>
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="h-auto w-full select-none"
            role="img"
            aria-label={`Isometric 3D model. ${totalPlaced} cubes placed.`}
          >
            {/* ground footprint outline */}
            {(() => {
              const a = project(0, 0, 0);
              const b = project(SIZE, 0, 0);
              const c = project(SIZE, SIZE, 0);
              const d = project(0, SIZE, 0);
              return (
                <polygon
                  points={`${a.sx},${a.sy} ${b.sx},${b.sy} ${c.sx},${c.sy} ${d.sx},${d.sy}`}
                  fill="rgba(255,255,255,0.025)"
                  stroke="rgba(120,140,170,0.22)"
                  strokeWidth={1}
                />
              );
            })()}
            {/* footprint grid lines */}
            {Array.from({ length: SIZE + 1 }).map((_, i) => {
              const p0 = project(i, 0, 0);
              const p1 = project(i, SIZE, 0);
              const q0 = project(0, i, 0);
              const q1 = project(SIZE, i, 0);
              return (
                <g
                  key={`g-${i}`}
                  stroke="rgba(120,140,170,0.14)"
                  strokeWidth={0.7}
                >
                  <line x1={p0.sx} y1={p0.sy} x2={p1.sx} y2={p1.sy} />
                  <line x1={q0.sx} y1={q0.sy} x2={q1.sx} y2={q1.sy} />
                </g>
              );
            })}

            {/* solid cubes (painter-sorted, near drawn last) */}
            {isoCubes.map(({ v }) => {
              const p = project(v.x + 0.5, v.y + 0.5, v.z);
              const f = cubeFaces(p);
              const onLayer = v.z === layer;
              return (
                <g
                  key={`c-${v.x}-${v.y}-${v.z}`}
                  style={
                    solvedRound
                      ? { filter: `drop-shadow(0 0 3px ${ACCENT})` }
                      : undefined
                  }
                >
                  <polygon
                    points={f.left}
                    fill={FACE_LEFT}
                    stroke={EDGE}
                    strokeWidth={0.6}
                  />
                  <polygon
                    points={f.right}
                    fill={FACE_RIGHT}
                    stroke={EDGE}
                    strokeWidth={0.6}
                  />
                  <polygon
                    points={f.top}
                    fill={onLayer && !solvedRound ? "#ffe6a3" : FACE_TOP}
                    stroke={EDGE}
                    strokeWidth={0.6}
                  />
                </g>
              );
            })}
          </svg>
          {solvedRound && (
            <div
              className="pointer-events-none absolute inset-0 rounded-xl"
              style={{
                boxShadow: `inset 0 0 0 2px ${ACCENT}, 0 0 18px ${ACCENT}66`,
              }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* ── Layer editor ── */}
        <div className="flex w-full flex-col gap-2 sm:w-[46%]">
          <div className="flex items-center justify-between text-[11px] text-ink-dim">
            <span className="font-display tracking-tech">LAYER EDITOR</span>
            <span aria-hidden="true">z = {layer}</span>
          </div>

          {/* layer picker */}
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="Choose height layer"
          >
            {Array.from({ length: LAYERS }).map((_, z) => {
              const active = z === layer;
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => setLayer(z)}
                  disabled={solvedRound}
                  aria-label={`Edit layer z equals ${z}${z === 0 ? ", ground" : ""}`}
                  aria-pressed={active}
                  className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium disabled:opacity-40"
                  style={
                    active
                      ? { background: ACCENT, color: "#05070d" }
                      : {
                          border: "1px solid var(--color-line, #33405c)",
                          color: "var(--color-ink-dim, #9aa6bd)",
                        }
                  }
                >
                  z{z}
                </button>
              );
            })}
          </div>

          {/* the 4×4 grid for the current layer — NO target hints (must reason) */}
          <div
            className="panel grid gap-1 rounded-xl p-2"
            style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
            role="group"
            aria-label={`Layer ${layer} grid, 4 by 4. Tap a cell to add or remove a cube.`}
          >
            {Array.from({ length: SIZE * SIZE }).map((_, idx) => {
              const x = idx % SIZE;
              const y = Math.floor(idx / SIZE);
              const k = key(x, y, layer);
              const on = filled.has(k);
              const below = layer > 0 && filled.has(key(x, y, layer - 1));
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleCell(x, y)}
                  disabled={solvedRound}
                  aria-label={`Cell x ${x}, y ${y}, layer ${layer}. ${
                    on ? "Cube placed. Tap to remove." : "Empty. Tap to add a cube."
                  }`}
                  aria-pressed={on}
                  className="relative aspect-square rounded-md text-[10px] transition disabled:cursor-default"
                  style={{
                    background: on
                      ? ACCENT
                      : below
                        ? "rgba(245,158,11,0.06)"
                        : "rgba(255,255,255,0.03)",
                    border: `1px solid ${
                      on ? "#7a4d03" : "var(--color-line, #33405c)"
                    }`,
                    boxShadow: on ? `0 0 8px ${ACCENT}88` : undefined,
                  }}
                >
                  {on ? (
                    <span aria-hidden="true" style={{ color: "#05070d" }}>
                      ■
                    </span>
                  ) : below ? (
                    <span aria-hidden="true" className="text-ink-faint">
                      ▢
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-ink-faint">
            <span>{placedOnLayer} on this layer</span>
            <span aria-hidden="true">▢ = cube directly below</span>
          </div>
        </div>
      </div>

      {/* hint line for the current model */}
      <div
        className="rounded-lg px-3 py-1.5 text-center text-[11px]"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px dashed var(--color-line, #33405c)",
          color: "var(--color-ink-dim, #9aa6bd)",
        }}
      >
        💡 {r.hint}
      </div>

      {/* status line */}
      <div
        className="rounded-lg px-3 py-2 text-center text-sm"
        role="status"
        aria-live="polite"
        style={{
          background: solvedRound
            ? "rgba(245,158,11,0.12)"
            : "rgba(255,255,255,0.03)",
          border: `1px solid ${solvedRound ? ACCENT : "var(--color-line, #33405c)"}`,
          color: solvedRound ? ACCENT : "var(--color-ink-dim, #9aa6bd)",
          boxShadow: solvedRound ? `0 0 14px ${ACCENT}55` : undefined,
        }}
      >
        {status}
      </div>

      {/* check / clear */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={check}
          disabled={solvedRound}
          aria-label="Check the model against the blueprint"
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
        >
          {allDone ? "All Built! ✓" : phase === "won" ? "Built! ✓" : "Check ✓"}
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={solvedRound}
          aria-label="Clear all cubes in this model and start the model over"
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm text-ink-dim disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
