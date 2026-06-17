"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Voxel Builder — a 3D MODELLING activity (3D space + coordinates + building).
 * Build in 3D WITHOUT three.js: a per-layer 2D editor drives a live ISOMETRIC
 * preview rendered in pure SVG. Each filled voxel (x,y,z) is projected to iso
 * screen coords and drawn as 3 shaded cube faces (light top, darker sides),
 * painter-sorted by (x+y+z) so nearer cubes overlap farther ones.
 *
 * Target: a 3-step staircase climbing the x axis inside a 4×4×3 build volume.
 * Win when the set of filled voxels EXACTLY matches the target set.
 * Single fixed, deterministic, winnable level.
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

/* ── Target: a 3-step staircase climbing along x. ──
 * z=0: a full 4-wide × 2-deep base of the first step plus the back columns.
 * We build a clean staircase: step k occupies x=k, all y, for heights up to k.
 * Concretely each column x rises to height (x+1): x=0 →1 cube, x=1 →2, x=2 →3,
 * x=3 →3 (cap). Only the front two rows (y=0,1) are used to keep it small/clear.
 */
const TARGET: Vox[] = (() => {
  const out: Vox[] = [];
  const heights = [1, 2, 3, 3]; // height of each x-column
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < 2; y++) {
      for (let z = 0; z < heights[x]; z++) {
        out.push({ x, y, z });
      }
    }
  }
  return out;
})();

const TARGET_SET: ReadonlySet<string> = new Set(
  TARGET.map((v) => key(v.x, v.y, v.z)),
);
const TARGET_COUNT = TARGET_SET.size;

/* ── Isometric projection ──
 * Classic 2:1 iso. Screen X spreads on (x − y); screen Y on (x + y) minus z lift.
 */
const VIEW_W = 260;
const VIEW_H = 230;
const TW = 30; // tile half-width  (screen px per unit on the x/y diagonal)
const TH = 15; // tile half-height
const ZH = 26; // vertical lift per z layer
const ORIGIN_X = VIEW_W / 2;
const ORIGIN_Y = 56;

interface Pt {
  sx: number;
  sy: number;
}

/** Project the TOP-CENTER of a voxel cell to screen space. */
function project(x: number, y: number, z: number): Pt {
  return {
    sx: ORIGIN_X + (x - y) * TW,
    sy: ORIGIN_Y + (x + y) * TH - z * ZH,
  };
}

/* Cube face polygons, given the projected top-center of a unit cell. */
function cubeFaces(p: Pt): { top: string; left: string; right: string } {
  const { sx, sy } = p;
  // Top rhombus corners (back, right, front, left)
  const tBack = `${sx},${sy - TH}`;
  const tRight = `${sx + TW},${sy}`;
  const tFront = `${sx},${sy + TH}`;
  const tLeft = `${sx - TW},${sy}`;
  const top = `${tBack} ${tRight} ${tFront} ${tLeft}`;
  // Left face drops from tLeft & tFront down by ZH
  const left = `${sx - TW},${sy} ${sx},${sy + TH} ${sx},${sy + TH + ZH} ${sx - TW},${sy + ZH}`;
  // Right face drops from tFront & tRight down by ZH
  const right = `${sx},${sy + TH} ${sx + TW},${sy} ${sx + TW},${sy + ZH} ${sx},${sy + TH + ZH}`;
  return { top, left, right };
}

/* Shade helpers — derive top/left/right tints from the accent. */
const FACE_TOP = "#ffd479"; // light top
const FACE_LEFT = "#c97e08"; // medium
const FACE_RIGHT = "#9a5e05"; // dark
const EDGE = "#5c3a02";

const GHOST_TOP = "rgba(245,158,11,0.10)";
const GHOST_EDGE = "rgba(245,158,11,0.45)";

type Phase = "build" | "solved";

export default function VoxelBuilder({ onComplete }: ActivityProps) {
  const [filled, setFilled] = useState<ReadonlySet<string>>(() => new Set());
  const [layer, setLayer] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("build");
  const [status, setStatus] = useState<string>(
    "Pick a height layer, tap cells to stack cubes.",
  );
  const [showGhost, setShowGhost] = useState<boolean>(true);
  const [tries, setTries] = useState<number>(0);

  const solved = phase === "solved";

  const toggleCell = useCallback(
    (x: number, y: number) => {
      if (solved) return;
      const k = key(x, y, layer);
      setFilled((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      });
      setStatus("Keep building — match the ghost shape!");
    },
    [layer, solved],
  );

  const clearAll = useCallback(() => {
    setFilled(new Set());
    setPhase("build");
    setLayer(0);
    setTries(0);
    setStatus("Cleared. Build the staircase from the ground up!");
  }, []);

  const check = useCallback(() => {
    if (solved) return;
    let matches = 0;
    let extra = 0;
    for (const k of filled) {
      if (TARGET_SET.has(k)) matches += 1;
      else extra += 1;
    }
    const missing = TARGET_COUNT - matches;
    if (matches === TARGET_COUNT && extra === 0) {
      setPhase("solved");
      setStatus("Staircase complete! You built it in 3D. 🎉");
      onComplete({
        passed: true,
        stars: 3,
        detail: tries <= 1 ? "Perfect build!" : "Nice — you matched it!",
      });
      return;
    }
    setTries((t) => t + 1);
    const parts: string[] = [`${matches} / ${TARGET_COUNT} cubes match`];
    if (extra > 0) parts.push(`${extra} to remove`);
    else if (missing > 0) parts.push(`${missing} to add`);
    const msg = parts.join(" · ");
    setStatus(msg);
    onComplete({
      passed: false,
      detail:
        extra > 0
          ? `${matches}/${TARGET_COUNT} match — clear ${extra} stray cube${extra > 1 ? "s" : ""}.`
          : `${matches}/${TARGET_COUNT} match — ${missing} more to add.`,
    });
  }, [filled, onComplete, solved, tries]);

  /* ── Build the painter-sorted draw list for the iso preview. ── */
  const isoCubes = useMemo(() => {
    const list: { v: Vox; depth: number }[] = [];
    for (const k of filled) {
      const [x, y, z] = k.split(",").map(Number);
      list.push({ v: { x, y, z }, depth: x + y + z });
    }
    // Farther cubes first (smaller depth), nearer last so they overlap on top.
    list.sort((a, b) => a.depth - b.depth);
    return list;
  }, [filled]);

  /* Ghost cubes for the target outline (only those not yet filled). */
  const ghostCubes = useMemo(() => {
    if (!showGhost) return [];
    const list: { v: Vox; depth: number }[] = [];
    TARGET.forEach((v) => {
      list.push({ v, depth: v.x + v.y + v.z });
    });
    list.sort((a, b) => a.depth - b.depth);
    return list;
  }, [showGhost]);

  const placedOnLayer = useMemo(() => {
    let n = 0;
    for (const k of filled) if (k.endsWith(`,${layer}`)) n += 1;
    return n;
  }, [filled, layer]);

  const totalPlaced = filled.size;

  return (
    <div className="flex w-full flex-col gap-3 font-mono text-ink">
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* ── Isometric preview ── */}
        <div className="panel relative flex-1 rounded-xl p-2">
          <div className="mb-1 flex items-center justify-between px-1 text-[11px] text-ink-dim">
            <span className="font-display tracking-tech">3D PREVIEW</span>
            <span aria-hidden="true">{totalPlaced} cubes</span>
          </div>
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="h-auto w-full select-none"
            role="img"
            aria-label={`Isometric 3D preview. ${totalPlaced} cubes placed of ${TARGET_COUNT} in the target staircase.`}
          >
            {/* ground footprint outline (4×4 base) */}
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
                <g key={`g-${i}`} stroke="rgba(120,140,170,0.14)" strokeWidth={0.7}>
                  <line x1={p0.sx} y1={p0.sy} x2={p1.sx} y2={p1.sy} />
                  <line x1={q0.sx} y1={q0.sy} x2={q1.sx} y2={q1.sy} />
                </g>
              );
            })}

            {/* ghost target outline */}
            {ghostCubes.map(({ v }) => {
              if (filled.has(key(v.x, v.y, v.z))) return null;
              const p = project(v.x + 0.5, v.y + 0.5, v.z);
              const f = cubeFaces(p);
              return (
                <g key={`gh-${v.x}-${v.y}-${v.z}`}>
                  <polygon points={f.left} fill={GHOST_TOP} stroke={GHOST_EDGE} strokeWidth={0.6} strokeDasharray="2 2" />
                  <polygon points={f.right} fill={GHOST_TOP} stroke={GHOST_EDGE} strokeWidth={0.6} strokeDasharray="2 2" />
                  <polygon points={f.top} fill={GHOST_TOP} stroke={GHOST_EDGE} strokeWidth={0.6} strokeDasharray="2 2" />
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
                  style={solved ? { filter: `drop-shadow(0 0 3px ${ACCENT})` } : undefined}
                >
                  <polygon points={f.left} fill={FACE_LEFT} stroke={EDGE} strokeWidth={0.6} />
                  <polygon points={f.right} fill={FACE_RIGHT} stroke={EDGE} strokeWidth={0.6} />
                  <polygon
                    points={f.top}
                    fill={onLayer && !solved ? "#ffe6a3" : FACE_TOP}
                    stroke={EDGE}
                    strokeWidth={0.6}
                  />
                </g>
              );
            })}
          </svg>
          {solved && (
            <div
              className="pointer-events-none absolute inset-0 rounded-xl"
              style={{ boxShadow: `inset 0 0 0 2px ${ACCENT}, 0 0 18px ${ACCENT}66` }}
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
          <div className="flex items-center gap-1" role="group" aria-label="Choose height layer">
            {Array.from({ length: LAYERS }).map((_, z) => {
              const active = z === layer;
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => setLayer(z)}
                  disabled={solved}
                  aria-label={`Edit layer z equals ${z}${z === 0 ? ", ground" : ""}`}
                  aria-pressed={active}
                  className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium disabled:opacity-40"
                  style={
                    active
                      ? { background: ACCENT, color: "#05070d" }
                      : { border: "1px solid var(--color-line, #33405c)", color: "var(--color-ink-dim, #9aa6bd)" }
                  }
                >
                  z{z}
                </button>
              );
            })}
          </div>

          {/* the 4×4 grid for the current layer */}
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
              const isTarget = TARGET_SET.has(k);
              const below = layer > 0 && filled.has(key(x, y, layer - 1));
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleCell(x, y)}
                  disabled={solved}
                  aria-label={`Cell x ${x}, y ${y}, layer ${layer}. ${on ? "Cube placed. Tap to remove." : "Empty. Tap to add a cube."}${showGhost && isTarget ? " Target cell." : ""}`}
                  aria-pressed={on}
                  className="relative aspect-square rounded-md text-[10px] transition disabled:cursor-default"
                  style={{
                    background: on ? ACCENT : below ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${
                      on
                        ? "#7a4d03"
                        : showGhost && isTarget
                          ? GHOST_EDGE
                          : "var(--color-line, #33405c)"
                    }`,
                    boxShadow: on ? `0 0 8px ${ACCENT}88` : undefined,
                  }}
                >
                  {on ? (
                    <span aria-hidden="true" style={{ color: "#05070d" }}>
                      ■
                    </span>
                  ) : showGhost && isTarget ? (
                    <span aria-hidden="true" style={{ color: GHOST_EDGE }}>
                      ·
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
            <button
              type="button"
              onClick={() => setShowGhost((g) => !g)}
              aria-pressed={showGhost}
              aria-label={showGhost ? "Hide target ghost outline" : "Show target ghost outline"}
              className="rounded px-1.5 py-0.5 text-ink-dim hover:text-ink"
              style={{ border: "1px solid var(--color-line, #33405c)" }}
            >
              {showGhost ? "Hide guide" : "Show guide"}
            </button>
          </div>
        </div>
      </div>

      {/* status line */}
      <div
        className="rounded-lg px-3 py-2 text-center text-sm"
        role="status"
        aria-live="polite"
        style={{
          background: solved ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${solved ? ACCENT : "var(--color-line, #33405c)"}`,
          color: solved ? ACCENT : "var(--color-ink-dim, #9aa6bd)",
          boxShadow: solved ? `0 0 14px ${ACCENT}55` : undefined,
        }}
      >
        {status}
      </div>

      {/* check / reset */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={check}
          disabled={solved}
          aria-label="Check the build against the target"
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
        >
          {solved ? "Built! ✓" : "Check ✓"}
        </button>
        <button
          type="button"
          onClick={clearAll}
          aria-label="Clear all cubes and start over"
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm text-ink-dim"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
