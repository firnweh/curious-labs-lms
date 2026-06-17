"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

const ACCENT = "#f59e0b";

/** One axis of a discrete 90° rotation. */
type Axis = "x" | "y" | "z";

/** A 3D integer point (a voxel centre in model space). */
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

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

/**
 * A fixed, reachable target pose. Reachable in a handful of moves:
 *   Rotate Y ×1, Rotate X ×1, Scale up ×1, Move right ×1, Move back ×1.
 */
const TARGET: Pose = { rx: 1, ry: 1, rz: 0, tx: 1, ty: 1, scale: 2 };

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

const DIFF_LABEL: Record<Axis, string> = {
  x: "Rotation on X",
  y: "Rotation on Y",
  z: "Rotation on Z",
};

export default function Transformer({ onComplete }: ActivityProps) {
  const [pose, setPose] = useState<Pose>(START);
  const [solved, setSolved] = useState<boolean>(false);
  const [tries, setTries] = useState<number>(0);
  const [status, setStatus] = useState<string>(
    "Match the orange block to the glowing ghost!",
  );

  const UNIT = 46;

  const matched = useMemo(() => poseEqual(pose, TARGET), [pose]);

  // How many of the six pose dimensions are already right (for the score line).
  const correctCount = useMemo(() => {
    let n = 0;
    if (pose.rx === TARGET.rx) n++;
    if (pose.ry === TARGET.ry) n++;
    if (pose.rz === TARGET.rz) n++;
    if (pose.tx === TARGET.tx) n++;
    if (pose.ty === TARGET.ty) n++;
    if (pose.scale === TARGET.scale) n++;
    return n;
  }, [pose]);

  const ghostCubes = useMemo(() => cubesFor(TARGET, UNIT), []);
  const liveCubes = useMemo(() => cubesFor(pose, UNIT), [pose]);

  const update = useCallback(
    (fn: (p: Pose) => Pose): void => {
      if (solved) return;
      setStatus("Match the orange block to the glowing ghost!");
      setPose(fn);
    },
    [solved],
  );

  const rotate = useCallback(
    (axis: Axis): void =>
      update((p) =>
        axis === "x"
          ? { ...p, rx: (p.rx + 1) % 4 }
          : axis === "y"
            ? { ...p, ry: (p.ry + 1) % 4 }
            : { ...p, rz: (p.rz + 1) % 4 },
      ),
    [update],
  );

  const move = useCallback(
    (dx: number, dy: number): void =>
      update((p) => ({
        ...p,
        tx: Math.max(-2, Math.min(2, p.tx + dx)),
        ty: Math.max(-2, Math.min(2, p.ty + dy)),
      })),
    [update],
  );

  const scaleUp = useCallback(
    (): void => update((p) => ({ ...p, scale: p.scale === 1 ? 2 : 1 })),
    [update],
  );

  const reset = useCallback((): void => {
    setPose(START);
    setSolved(false);
    setTries(0);
    setStatus("Match the orange block to the glowing ghost!");
  }, []);

  const check = useCallback((): void => {
    if (solved) return;
    const n = tries + 1;
    setTries(n);
    if (matched) {
      setSolved(true);
      setStatus("Perfect match — the block snapped into the ghost!");
      const stars: 1 | 2 | 3 = n > 6 ? 2 : 3;
      onComplete({ passed: true, stars });
      return;
    }
    // Surface ONE off-axis as a friendly hint.
    let hint = "";
    if (pose.scale !== TARGET.scale) {
      hint = pose.scale < TARGET.scale ? "Try scaling up" : "Try scaling down";
    } else if (pose.rx !== TARGET.rx) {
      hint = `${DIFF_LABEL.x} is off`;
    } else if (pose.ry !== TARGET.ry) {
      hint = `${DIFF_LABEL.y} is off`;
    } else if (pose.rz !== TARGET.rz) {
      hint = `${DIFF_LABEL.z} is off`;
    } else if (pose.tx !== TARGET.tx) {
      hint = pose.tx < TARGET.tx ? "Slide it right" : "Slide it left";
    } else {
      hint = pose.ty < TARGET.ty ? "Slide it back" : "Slide it forward";
    }
    setStatus(`${hint} — ${correctCount} / 6 right`);
    onComplete({ passed: false, detail: hint });
  }, [solved, tries, matched, pose, correctCount, onComplete]);

  const glow = solved || matched;

  return (
    <div className="flex w-full flex-col gap-3">
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

      {/* Transform controls */}
      <div className="flex flex-wrap items-center gap-2">
        <CtrlButton label="Rotate X" sub="+90°" onClick={() => rotate("x")} disabled={solved} />
        <CtrlButton label="Rotate Y" sub="+90°" onClick={() => rotate("y")} disabled={solved} />
        <CtrlButton label="Rotate Z" sub="+90°" onClick={() => rotate("z")} disabled={solved} />
        <CtrlButton
          label="Scale"
          sub={pose.scale === 1 ? "→ 2×" : "→ 1×"}
          onClick={scaleUp}
          disabled={solved}
        />
      </div>

      {/* Move pad + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Move the block on the grid">
          <span />
          <MoveButton label="Move back" glyph="▲" onClick={() => move(0, 1)} disabled={solved} />
          <span />
          <MoveButton label="Move left" glyph="◀" onClick={() => move(-1, 0)} disabled={solved} />
          <MoveButton label="Move forward" glyph="▼" onClick={() => move(0, -1)} disabled={solved} />
          <MoveButton label="Move right" glyph="▶" onClick={() => move(1, 0)} disabled={solved} />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <button
            type="button"
            onClick={check}
            disabled={solved}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Check whether the block matches the target ghost"
          >
            {solved ? "Solved!" : "Check match"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the block to its starting pose"
          >
            Reset
          </button>
        </div>

        <span className="font-mono ml-auto self-start text-xs text-ink-faint">
          {correctCount} / 6 right
        </span>
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
      aria-label={`${label} ${sub}`}
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
      aria-label={label}
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
