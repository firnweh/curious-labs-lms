"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── 3D Transformer 🧊 ────────────────────────────────────────────────────────
   CLASS 4-6 (explorer, age ~9-11) SPATIAL-REASONING lab. You drive an orange
   L-block onto a glowing ghost target using rotations (X/Y/Z, +90°), moves and
   a 2× scale. Rebuilt from a one-shot puzzle into a REAL, planned problem:

   • PREDICT → RUN: you BUILD a plan of moves first (a step strip), then press
     ▶ RUN to watch the block transform one step at a time and snap (or not) onto
     the ghost. No live "are we there yet" hill-climbing — you must reason about
     the result in your head before committing.

   • THREE escalating rounds, each a fresh target:
       R1  warm-up: one rotate + a move (read the orientation).
       R2  scale + two rotations: 2× changes how moves land.
       R3  the TWIST — a DOUBLE tumble (two turns on different axes) lands the L
           in an orientation you can't reach by repeating one turn, and the slide
           direction depends on where the tumbled arm ends up. You must picture
           the whole result before you RUN — brute-force tapping fails because the
           result is only revealed AFTER you commit and run the plan.

   • OPTIMIZE for stars: each round has a known-shortest move count (par). Match a
     round in par → it stays gold. Go over par on any round → max 2 stars. Solve
     all three → onComplete({passed:true, stars}) exactly once, guarded.

   Wrong RUN → friendly "not yet", the block hops home, your plan is KEPT so you
   can edit it (⬅ undo last, Clear). No onComplete on misses. Always winnable.
   Deterministic grading; reduced-motion friendly; full aria. Visuals/iso render
   preserved from the original. */

const ACCENT = "#f59e0b";

/** One axis of a discrete 90° rotation. */
type Axis = "x" | "y" | "z";

/** A 3D integer point (a voxel centre in model space). */
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** The kinds of step a player can queue into a plan. */
type Step =
  | { kind: "rot"; axis: Axis }
  | { kind: "move"; dx: number; dy: number }
  | { kind: "scale" };

/**
 * The whole pose is DISCRETE so it is deterministic and checkable:
 * - rx/ry/rz: rotation in quarter-turns (0..3) about each axis, applied X→Y→Z.
 * - tx/ty: integer translation on the floor grid (a few steps each way).
 * - scale: 1 or 2 (uniform).
 */
interface Pose {
  rx: number;
  ry: number;
  rz: number;
  tx: number;
  ty: number;
  scale: number;
}

const START: Pose = { rx: 0, ry: 0, rz: 0, tx: 0, ty: 0, scale: 1 };

interface Round {
  /** Human round title. */
  name: string;
  /** The target pose to match. */
  target: Pose;
  /** Shortest number of plan steps that reaches the target (par for full stars). */
  par: number;
  /** A short reasoning nudge shown above the stage. */
  hint: string;
}

/**
 * Three fixed, hand-authored, escalating targets.
 * Each `par` is the minimum step count reachable with the available controls,
 * verified by hand against the move set (rotate ×1 per axis tap toward target,
 * +1 per scale toggle, +1 per single-cell move).
 */
const ROUNDS: readonly Round[] = [
  // R1 — one Y turn, slide right one. Par = 2 (Rotate Y, Move right).
  {
    name: "Round 1 — Turn & Slide",
    target: { rx: 0, ry: 1, rz: 0, tx: 1, ty: 0, scale: 1 },
    par: 2,
    hint: "Picture the block after one turn — THEN decide which way to slide it.",
  },
  // R2 — scale up, X turn, slide back one. Par = 3 (Scale, Rotate X, Move back).
  {
    name: "Round 2 — Grow & Tilt",
    target: { rx: 1, ry: 0, rz: 0, tx: 0, ty: 1, scale: 2 },
    par: 3,
    hint: "It's twice as big AND tilted. Which order keeps it on the ghost?",
  },
  // R3 — the TWIST: TWO turns on DIFFERENT axes tumble the L into an orientation
  // you can't reach by repeating one turn. You must picture the doubly-rotated
  // shape, THEN work out which way to slide it — all before you RUN, with no live
  // score to fall back on. BFS-verified par = 3 (Rotate X, Rotate Y, Move right).
  {
    name: "Round 3 — Double Tumble",
    target: { rx: 1, ry: 1, rz: 0, tx: 1, ty: 0, scale: 1 },
    par: 3,
    hint: "It's tumbled on TWO axes. Picture the final shape, then plan the slide.",
  },
];

/**
 * An asymmetric "L"-tromino of unit cubes so orientation is readable.
 * Centred-ish around the origin; one arm points +x, the body sits in -y.
 */
const SHAPE: Vec3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: -2, z: 0 },
  { x: 1, y: 0, z: 0 },
];

/** Rotate a point one quarter-turn about an axis (right-handed, integer-safe). */
function rotateQuarter(p: Vec3, axis: Axis): Vec3 {
  if (axis === "x") return { x: p.x, y: -p.z, z: p.y };
  if (axis === "y") return { x: p.z, y: p.y, z: -p.x };
  return { x: -p.y, y: p.x, z: p.z };
}

function rotateTurns(p: Vec3, axis: Axis, turns: number): Vec3 {
  let out = p;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) out = rotateQuarter(out, axis);
  return out;
}

/** Apply a full pose to the base shape, returning world-space voxels. */
function applyPose(pose: Pose): Vec3[] {
  return SHAPE.map((p0) => {
    let p = rotateTurns(p0, "x", pose.rx);
    p = rotateTurns(p, "y", pose.ry);
    p = rotateTurns(p, "z", pose.rz);
    return {
      x: p.x * pose.scale + pose.tx,
      y: p.y * pose.scale + pose.ty,
      z: p.z * pose.scale,
    };
  });
}

/** Project a world point to 2D isometric screen coordinates. */
function iso(p: Vec3, unit: number): { sx: number; sy: number } {
  const sx = (p.x - p.y) * unit * 0.5;
  const sy = (p.x + p.y) * unit * 0.25 - p.z * unit * 0.5;
  return { sx, sy };
}

/** The three visible faces of one iso cube, as SVG point strings. */
function cubeFaces(
  p: Vec3,
  unit: number,
  scale: number,
): { top: string; left: string; right: string; depth: number } {
  const s = scale;
  const corners: Vec3[] = [
    { x: p.x, y: p.y, z: p.z + s },
    { x: p.x + s, y: p.y, z: p.z + s },
    { x: p.x + s, y: p.y + s, z: p.z + s },
    { x: p.x, y: p.y + s, z: p.z + s },
    { x: p.x, y: p.y, z: p.z },
    { x: p.x + s, y: p.y, z: p.z },
    { x: p.x + s, y: p.y + s, z: p.z },
    { x: p.x, y: p.y + s, z: p.z },
  ];
  const c = corners.map((v) => iso(v, unit));
  const poly = (idx: number[]): string =>
    idx.map((i) => `${c[i].sx.toFixed(1)},${c[i].sy.toFixed(1)}`).join(" ");
  return {
    top: poly([0, 1, 2, 3]),
    left: poly([3, 2, 6, 7]),
    right: poly([1, 2, 6, 5]),
    depth: p.x + p.y + p.z,
  };
}

/** Painter's-order list of cubes for one pose. */
function cubesFor(pose: Pose, unit: number) {
  const voxels = applyPose(pose);
  const built = voxels.map((p) => ({ p, ...cubeFaces(p, unit, pose.scale) }));
  return built.sort((a, b) => a.depth - b.depth);
}

function poseEqual(a: Pose, b: Pose): boolean {
  return (
    a.rx === b.rx &&
    a.ry === b.ry &&
    a.rz === b.rz &&
    a.tx === b.tx &&
    a.ty === b.ty &&
    a.scale === b.scale
  );
}

/** Apply ONE plan step to a pose (clamped move, wrapping rotations). */
function stepPose(p: Pose, step: Step): Pose {
  if (step.kind === "rot") {
    if (step.axis === "x") return { ...p, rx: (p.rx + 1) % 4 };
    if (step.axis === "y") return { ...p, ry: (p.ry + 1) % 4 };
    return { ...p, rz: (p.rz + 1) % 4 };
  }
  if (step.kind === "scale") return { ...p, scale: p.scale === 1 ? 2 : 1 };
  return {
    ...p,
    tx: Math.max(-2, Math.min(2, p.tx + step.dx)),
    ty: Math.max(-2, Math.min(2, p.ty + step.dy)),
  };
}

/** Run a whole plan from START → final pose (used for grading, no animation). */
function runPlan(plan: readonly Step[]): Pose {
  return plan.reduce<Pose>((p, s) => stepPose(p, s), START);
}

function stepLabel(step: Step): string {
  if (step.kind === "rot") return `Rot ${step.axis.toUpperCase()}`;
  if (step.kind === "scale") return "Scale";
  if (step.dy === 1) return "Back";
  if (step.dy === -1) return "Fwd";
  if (step.dx === 1) return "Right";
  return "Left";
}

const STEP_MS = 460;

export default function Transformer({ onComplete }: ActivityProps) {
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [plan, setPlan] = useState<Step[]>([]);
  // Pose currently shown on the live block (animates during a run).
  const [livePose, setLivePose] = useState<Pose>(START);
  const [running, setRunning] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Build a plan of moves, then press RUN to watch it happen!",
  );
  // Did each round get solved IN PAR (full stars) or over par (partial)?
  const [overPar, setOverPar] = useState<boolean>(false);
  const [allDone, setAllDone] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const UNIT = 46;
  const round = ROUNDS[roundIdx];
  const target = round.target;

  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const ghostCubes = useMemo(() => cubesFor(target, UNIT), [target]);
  const liveCubes = useMemo(() => cubesFor(livePose, UNIT), [livePose]);

  // Clear any pending animation on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const queue = useCallback(
    (step: Step): void => {
      if (running || allDone) return;
      setStatus("Build a plan of moves, then press RUN to watch it happen!");
      setPlan((p) => (p.length >= 12 ? p : [...p, step]));
    },
    [running, allDone],
  );

  const undo = useCallback((): void => {
    if (running || allDone) return;
    setPlan((p) => p.slice(0, -1));
  }, [running, allDone]);

  const clearPlan = useCallback((): void => {
    if (running || allDone) return;
    setPlan([]);
    setLivePose(START);
    setStatus("Build a plan of moves, then press RUN to watch it happen!");
  }, [running, allDone]);

  // Advance to next round (or finish) after a solved animation settles.
  const finishRound = useCallback(
    (usedOverPar: boolean): void => {
      const nowOver = overPar || usedOverPar;
      if (roundIdx + 1 < ROUNDS.length) {
        setRoundIdx((i) => i + 1);
        setPlan([]);
        setLivePose(START);
        setRunning(false);
        setOverPar(nowOver);
        setStatus("Snapped! Next target loaded — plan your moves.");
        return;
      }
      // Final round solved → grade & report exactly once.
      setAllDone(true);
      setRunning(false);
      setStatus(
        nowOver
          ? "All three solved! Great spatial thinking."
          : "Flawless — every round in par. Master transformer!",
      );
      if (!reportedRef.current) {
        reportedRef.current = true;
        const stars: 1 | 2 | 3 = nowOver ? 2 : 3;
        onComplete({
          passed: true,
          stars,
          detail: nowOver ? "solved (over par)" : "solved all rounds in par",
        });
      }
    },
    [overPar, roundIdx, onComplete],
  );

  // PREDICT → RUN: animate the plan step-by-step, then grade the final pose.
  const run = useCallback((): void => {
    if (running || allDone || plan.length === 0) return;
    setRunning(true);
    setStatus("Running your plan…");

    const finalPose = runPlan(plan);
    const matched = poseEqual(finalPose, target);
    const usedOverPar = plan.length > round.par;

    const playStep = (i: number, pose: Pose): void => {
      if (i >= plan.length) {
        // Plan finished animating — judge it.
        if (matched) {
          setStatus(
            usedOverPar
              ? `Match! (${plan.length} moves — par is ${round.par}.)`
              : `Perfect match in par (${round.par})! ✨`,
          );
          timerRef.current = setTimeout(
            () => finishRound(usedOverPar),
            reduceMotion ? 0 : 650,
          );
        } else {
          // Gentle retry — hop home, keep the plan to edit.
          setStatus("Not on the ghost yet — tweak your plan and run again.");
          timerRef.current = setTimeout(
            () => {
              setLivePose(START);
              setRunning(false);
            },
            reduceMotion ? 0 : 600,
          );
        }
        return;
      }
      const next = stepPose(pose, plan[i]);
      setLivePose(next);
      timerRef.current = setTimeout(
        () => playStep(i + 1, next),
        reduceMotion ? 0 : STEP_MS,
      );
    };

    if (reduceMotion) {
      // No animation: jump to final and judge immediately.
      setLivePose(finalPose);
      if (matched) {
        setStatus(
          usedOverPar
            ? `Match! (${plan.length} moves — par is ${round.par}.)`
            : `Perfect match in par (${round.par})!`,
        );
        finishRound(usedOverPar);
      } else {
        setStatus("Not on the ghost yet — tweak your plan and run again.");
        setLivePose(START);
        setRunning(false);
      }
      return;
    }

    playStep(0, START);
  }, [running, allDone, plan, target, round.par, reduceMotion, finishRound]);

  const glow = allDone;
  // Preview pose = result of the current plan (so kids can sanity-check counts,
  // but they must RUN to actually grade — no live "x/6 right" hand-holding).
  const planLen = plan.length;

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Round + reasoning banner */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="rounded-md px-2 py-0.5 text-xs font-semibold"
            style={{ background: ACCENT, color: "#05070d" }}
          >
            {round.name}
          </span>
          <span className="font-mono text-[11px] text-ink-faint">
            par {round.par} moves
          </span>
        </div>
        <div className="flex gap-1" aria-label={`Round ${roundIdx + 1} of ${ROUNDS.length}`}>
          {ROUNDS.map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="h-2 w-6 rounded-full"
              style={{
                background:
                  i < roundIdx || (allDone && i <= roundIdx)
                    ? ACCENT
                    : i === roundIdx
                      ? "rgba(245,158,11,0.45)"
                      : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-ink-dim">{round.hint}</p>

      {/* Stage */}
      <div
        className="panel relative overflow-hidden rounded-xl border p-2"
        style={{ borderColor: glow ? ACCENT : "var(--color-line, #27314f)" }}
      >
        <svg
          viewBox="-150 -130 300 250"
          className="block w-full"
          role="img"
          aria-label="An isometric L-shaped block on a grid, with a faded ghost showing the target pose to match."
          style={{ maxHeight: 360 }}
        >
          <defs>
            <filter id="tfGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* iso floor grid */}
          {(() => {
            const lines: ReactNode[] = [];
            const N = 3;
            for (let i = -N; i <= N; i++) {
              const a = iso({ x: i, y: -N, z: 0 }, UNIT);
              const b = iso({ x: i, y: N, z: 0 }, UNIT);
              const c = iso({ x: -N, y: i, z: 0 }, UNIT);
              const d = iso({ x: N, y: i, z: 0 }, UNIT);
              lines.push(
                <line
                  key={`gx${i}`}
                  x1={a.sx}
                  y1={a.sy}
                  x2={b.sx}
                  y2={b.sy}
                  stroke="#1c2540"
                  strokeWidth="1"
                />,
                <line
                  key={`gy${i}`}
                  x1={c.sx}
                  y1={c.sy}
                  x2={d.sx}
                  y2={d.sy}
                  stroke="#1c2540"
                  strokeWidth="1"
                />,
              );
            }
            return lines;
          })()}

          {/* ghost target pose */}
          <g opacity={glow ? 0 : 0.32} style={{ transition: "opacity 300ms ease" }}>
            {ghostCubes.map((cube, i) => (
              <g key={`gh${i}`}>
                <polygon points={cube.left} fill="#3a2c0a" stroke={ACCENT} strokeWidth="1" />
                <polygon points={cube.right} fill="#4a380d" stroke={ACCENT} strokeWidth="1" />
                <polygon points={cube.top} fill="#5a440f" stroke={ACCENT} strokeWidth="1" />
              </g>
            ))}
          </g>

          {/* live transformed block */}
          <g
            filter={glow ? "url(#tfGlow)" : undefined}
            style={{ transition: "filter 200ms ease" }}
          >
            {liveCubes.map((cube, i) => (
              <g key={`lv${i}`}>
                <polygon points={cube.left} fill="#a06a06" stroke="#241a02" strokeWidth="1.2" />
                <polygon points={cube.right} fill="#c98708" stroke="#241a02" strokeWidth="1.2" />
                <polygon points={cube.top} fill={ACCENT} stroke="#241a02" strokeWidth="1.2" />
              </g>
            ))}
          </g>
        </svg>

        {/* in-canvas status line */}
        <div
          className="font-mono mt-1 rounded-md px-2 py-1 text-center text-xs"
          style={{
            color: glow ? "#05070d" : "#9aa6cf",
            background: glow ? ACCENT : "transparent",
          }}
          aria-live="polite"
        >
          {status}
        </div>
      </div>

      {/* Plan strip */}
      <div
        className="flex min-h-[2.5rem] flex-wrap items-center gap-1.5 rounded-lg border p-2"
        style={{ borderColor: "var(--color-line, #27314f)", background: "rgba(11,16,32,0.4)" }}
        role="group"
        aria-label="Your plan of moves"
      >
        <span className="font-mono mr-1 text-[10px] text-ink-faint">PLAN</span>
        {plan.length === 0 ? (
          <span className="text-xs text-ink-faint">Tap moves below to build your plan…</span>
        ) : (
          plan.map((s, i) => (
            <span
              key={i}
              className="font-mono rounded-md px-2 py-1 text-[11px]"
              style={{
                background: "rgba(245,158,11,0.16)",
                color: "#f3d9a4",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "rgba(245,158,11,0.4)",
              }}
            >
              {i + 1}. {stepLabel(s)}
            </span>
          ))
        )}
        <span className="font-mono ml-auto text-[10px] text-ink-faint">
          {planLen} {planLen === 1 ? "move" : "moves"}
        </span>
      </div>

      {/* Transform controls (queue into plan) */}
      <div className="flex flex-wrap items-center gap-2">
        <CtrlButton label="Rotate X" sub="+90°" onClick={() => queue({ kind: "rot", axis: "x" })} disabled={running || allDone} />
        <CtrlButton label="Rotate Y" sub="+90°" onClick={() => queue({ kind: "rot", axis: "y" })} disabled={running || allDone} />
        <CtrlButton label="Rotate Z" sub="+90°" onClick={() => queue({ kind: "rot", axis: "z" })} disabled={running || allDone} />
        <CtrlButton label="Scale" sub="1× ⇄ 2×" onClick={() => queue({ kind: "scale" })} disabled={running || allDone} />
      </div>

      {/* Move pad + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Add a move step to your plan">
          <span />
          <MoveButton label="Move back" glyph="▲" onClick={() => queue({ kind: "move", dx: 0, dy: 1 })} disabled={running || allDone} />
          <span />
          <MoveButton label="Move left" glyph="◀" onClick={() => queue({ kind: "move", dx: -1, dy: 0 })} disabled={running || allDone} />
          <MoveButton label="Move forward" glyph="▼" onClick={() => queue({ kind: "move", dx: 0, dy: -1 })} disabled={running || allDone} />
          <MoveButton label="Move right" glyph="▶" onClick={() => queue({ kind: "move", dx: 1, dy: 0 })} disabled={running || allDone} />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <button
            type="button"
            onClick={run}
            disabled={running || allDone || plan.length === 0}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Run your plan and watch the block transform"
          >
            {allDone ? "Solved!" : running ? "Running…" : "▶ Run plan"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={running || allDone || plan.length === 0}
              className="flex-1 rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim disabled:opacity-40"
              aria-label="Undo the last step in your plan"
            >
              ⬅ Undo
            </button>
            <button
              type="button"
              onClick={clearPlan}
              disabled={running || allDone || plan.length === 0}
              className="flex-1 rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim disabled:opacity-40"
              aria-label="Clear your whole plan"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CtrlButton({
  label,
  sub,
  onClick,
  disabled,
}: {
  label: string;
  sub: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} ${sub} — add to plan`}
      className="flex flex-col items-center rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50"
      style={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--color-line, #27314f)",
        background: "rgba(11,16,32,0.6)",
        color: "#cbd3ef",
      }}
    >
      <span>{label}</span>
      <span className="font-mono text-[10px] text-ink-faint">{sub}</span>
    </button>
  );
}

function MoveButton({
  label,
  glyph,
  onClick,
  disabled,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} — add to plan`}
      className="grid h-9 w-9 place-items-center rounded-lg text-sm transition disabled:opacity-50"
      style={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--color-line, #27314f)",
        background: "rgba(11,16,32,0.6)",
        color: "#cbd3ef",
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}
