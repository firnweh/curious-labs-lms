"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Turtle Art Functions — a function is a reusable drawing recipe,    */
/*  and calling it inside a loop with changing inputs paints a whole   */
/*  pattern from a few lines. Dial in repeat / sides / size / grow /   */
/*  turn so one draw_shape() call, looped, matches the target rosette. */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";
const VIEW = 260; // square SVG viewBox
const CX = VIEW / 2;
const CY = VIEW / 2;

/** Hue list the colour-cycle pulls from, one per repeat. */
const HUES: readonly string[] = [
  "#22d3ee",
  "#34d399",
  "#a3e635",
  "#fbbf24",
  "#fb923c",
  "#f87171",
  "#f472b6",
  "#c084fc",
  "#818cf8",
  "#60a5fa",
  "#2dd4bf",
  "#4ade80",
];

/** The artwork the learner is chasing — fixed, deterministic. */
const TARGET = { repeat: 12, sides: 4, size: 22, grow: 3, turn: 30 } as const;

interface Dials {
  repeat: number;
  sides: number;
  size: number;
  grow: number;
  turn: number;
}

const DEFAULTS: Dials = { repeat: 6, sides: 3, size: 22, grow: 3, turn: 48 };

interface Dial {
  key: keyof Dials;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}

const DIALS: readonly Dial[] = [
  { key: "repeat", label: "repeat", hint: "loop count", min: 3, max: 16, step: 1 },
  { key: "sides", label: "sides", hint: "shape", min: 3, max: 6, step: 1 },
  { key: "size", label: "size", hint: "start size", min: 12, max: 34, step: 2 },
  { key: "grow", label: "grow", hint: "+size / loop", min: 0, max: 6, step: 1 },
  { key: "turn", label: "turn", hint: "angle °", min: 10, max: 60, step: 1 },
];

interface Pt {
  x: number;
  y: number;
}

/**
 * draw_shape(sides, size) drawn as a regular polygon, then the whole
 * shape rotated by `rot` degrees about the canvas centre. The turtle
 * starts each shape offset from the centre so growing shapes fan out.
 */
function polygon(sides: number, size: number, rotDeg: number): Pt[] {
  const pts: Pt[] = [];
  const rot = (rotDeg * Math.PI) / 180;
  // Offset so the shape sits away from the hub — a rosette "petal".
  const reach = 8;
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const lx = reach + size * Math.cos(a);
    const ly = size * Math.sin(a);
    // rotate the local point by rot about the centre
    const x = CX + lx * Math.cos(rot) - ly * Math.sin(rot);
    const y = CY + lx * Math.sin(rot) + ly * Math.cos(rot);
    pts.push({ x, y });
  }
  return pts;
}

function toPath(pts: Pt[]): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

/** All shapes a given dial setting produces — the full looped program. */
function buildShapes(d: Dials): { path: string; hue: string }[] {
  const out: { path: string; hue: string }[] = [];
  for (let i = 0; i < d.repeat; i++) {
    const size = d.size + i * d.grow;
    const rot = i * d.turn;
    out.push({ path: toPath(polygon(d.sides, size, rot)), hue: HUES[i % HUES.length] });
  }
  return out;
}

/**
 * Match score in [0,1]. Each dial contributes; the closer every dial is
 * to the target, the higher the score. Turn angle is weighted hardest
 * because it controls whether the ring closes. 100% only when every dial
 * is exact — deterministic and always reachable.
 */
function matchScore(d: Dials): number {
  const part = (val: number, target: number, span: number): number =>
    Math.max(0, 1 - Math.abs(val - target) / span);
  const wRepeat = part(d.repeat, TARGET.repeat, 13);
  const wSides = part(d.sides, TARGET.sides, 3);
  const wSize = part(d.size, TARGET.size, 22);
  const wGrow = d.grow > 0 ? 1 : 0.4; // any growth helps; zero is flat
  const wTurn = part(d.turn, TARGET.turn, 50);
  const raw =
    0.18 * wRepeat + 0.18 * wSides + 0.12 * wSize + 0.12 * wGrow + 0.4 * wTurn;
  return raw;
}

function isSolved(d: Dials): boolean {
  return (
    d.repeat === TARGET.repeat &&
    d.sides === TARGET.sides &&
    d.turn === TARGET.turn &&
    d.grow > 0
  );
}

type Phase = "idle" | "drawing" | "won";

export default function TurtleArtFunctions({ onComplete }: ActivityProps) {
  const [dials, setDials] = useState<Dials>({ ...DEFAULTS });
  const [phase, setPhase] = useState<Phase>("idle");
  const [drawn, setDrawn] = useState<number>(0); // shapes revealed so far
  const [tries, setTries] = useState<number>(0);
  const completedRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);

  const shapes = useMemo(() => buildShapes(dials), [dials]);
  const target = useMemo(() => buildShapes(TARGET as Dials), []);
  const score = useMemo(() => matchScore(dials), [dials]);
  const pct = Math.round(score * 100);
  const solved = isSolved(dials);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  // Animate the turtle drawing one shape per tick during "drawing".
  useEffect(() => {
    if (phase !== "drawing") return;
    if (drawn >= shapes.length) {
      // Finished the program. Grade it.
      if (solved && !completedRef.current) {
        completedRef.current = true;
        setPhase("won");
        onComplete({
          passed: true,
          stars: 3,
          detail: "One function + a loop drew all 12 shapes!",
        });
      } else if (!solved) {
        setPhase("idle");
        onComplete({
          passed: false,
          detail:
            dials.turn !== TARGET.turn
              ? "Close the ring: 12 repeats need 360 / 12 = 30° to meet."
              : "Almost! Nudge the dials toward the faded target.",
        });
      }
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setDrawn((n) => n + 1);
    }, 150);
    return clearTimer;
  }, [phase, drawn, shapes.length, solved, dials.turn, onComplete, clearTimer]);

  const setDial = useCallback(
    (key: keyof Dials, value: number) => {
      if (phase === "drawing") return;
      completedRef.current = completedRef.current && phase === "won";
      setDials((prev) => ({ ...prev, [key]: value }));
      if (phase !== "idle") {
        setPhase("idle");
        setDrawn(0);
      }
    },
    [phase],
  );

  const handleRun = useCallback(() => {
    if (phase === "drawing") return;
    clearTimer();
    setDrawn(0);
    setTries((t) => t + 1);
    setPhase("drawing");
  }, [phase, clearTimer]);

  const handleReset = useCallback(() => {
    clearTimer();
    completedRef.current = false;
    setDials({ ...DEFAULTS });
    setDrawn(0);
    setPhase("idle");
  }, [clearTimer]);

  const won = phase === "won";
  const visible = won ? shapes.length : drawn;

  const status = useMemo(() => {
    if (won) return "Match 100% — the rosette closes! ✨";
    if (phase === "drawing") return `Turtle drawing… shape ${visible} / ${shapes.length}`;
    if (dials.turn !== TARGET.turn && pct >= 55)
      return "Gaps left — 12 repeats need 360 / 12 = 30°.";
    return `Match ${pct}% · set the dials, then Run ▶`;
  }, [won, phase, visible, shapes.length, dials.turn, pct]);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g6turtleartfunctions-pop {
          0% { transform: scale(.6); opacity: 0; }
          70% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g6turtleartfunctions-spark {
          0%, 100% { opacity: 0; transform: scale(.4); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes g6turtleartfunctions-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>

      {/* ---------------- CANVAS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={
          won
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 26px -4px ${ACCENT}`, transition: "box-shadow .3s ease" }
            : { transition: "box-shadow .3s ease" }
        }
      >
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="block aspect-square w-full"
          role="img"
          aria-label="Turtle drawing canvas with faded target rosette behind it"
        >
          {/* faint grid */}
          <g stroke="#1b2433" strokeWidth={0.5}>
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`gv${i}`} x1={(i * VIEW) / 8} y1={0} x2={(i * VIEW) / 8} y2={VIEW} />
            ))}
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`gh${i}`} x1={0} y1={(i * VIEW) / 8} x2={VIEW} y2={(i * VIEW) / 8} />
            ))}
          </g>

          {/* faded TARGET artwork behind everything */}
          <g opacity={won ? 0 : 0.22} style={{ transition: "opacity .4s ease" }}>
            {target.map((s, i) => (
              <path
                key={`t${i}`}
                d={s.path}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={1.4}
                strokeLinejoin="round"
              />
            ))}
          </g>

          {/* the learner's drawing, revealed shape by shape */}
          <g>
            {shapes.slice(0, visible).map((s, i) => (
              <path
                key={`s${i}`}
                d={s.path}
                fill="none"
                stroke={s.hue}
                strokeWidth={2}
                strokeLinejoin="round"
                style={{
                  transformOrigin: `${CX}px ${CY}px`,
                  animation: `g6turtleartfunctions-pop .28s ease both`,
                  filter: won ? `drop-shadow(0 0 2px ${s.hue})` : undefined,
                }}
              />
            ))}
          </g>

          {/* the turtle, parked at the hub */}
          <g
            transform={`translate(${CX} ${CY})`}
            style={{ animation: phase === "drawing" ? "g6turtleartfunctions-bob .6s ease-in-out infinite" : undefined }}
          >
            <circle r={9} fill="#0b1220" stroke={ACCENT} strokeWidth={1} />
            <text x={0} y={3.5} fontSize={11} textAnchor="middle">
              🐢
            </text>
          </g>

          {/* win sparkles */}
          {won &&
            Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              const r = 96;
              return (
                <text
                  key={`sp${i}`}
                  x={CX + Math.cos(a) * r}
                  y={CY + Math.sin(a) * r}
                  fontSize={14}
                  textAnchor="middle"
                  style={{
                    transformOrigin: `${CX + Math.cos(a) * r}px ${CY + Math.sin(a) * r}px`,
                    animation: `g6turtleartfunctions-spark 1s ease-in-out ${i * 0.08}s infinite`,
                  }}
                >
                  ✨
                </text>
              );
            })}
        </svg>

        {/* status line + match meter */}
        <div className="mt-1 flex flex-col gap-1 px-1">
          <div
            className="flex items-center justify-between text-xs"
            role="status"
            aria-live="polite"
          >
            <span
              className={won ? "font-display" : "text-ink-dim"}
              style={won ? { color: ACCENT } : undefined}
            >
              {status}
            </span>
            <span className="tabular-nums" style={{ color: ACCENT }}>
              {pct}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2" aria-hidden>
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: ACCENT,
                transition: "width .25s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* ---------------- BLOCK CODE ---------------- */}
      <div className="panel rounded-xl p-3 text-xs leading-relaxed">
        <p className="mb-1.5 text-[11px] uppercase tracking-tech text-ink-faint">
          your program
        </p>
        <pre className="overflow-x-auto whitespace-pre text-ink-dim">
          <span style={{ color: "#c084fc" }}>def</span>{" "}
          <span style={{ color: ACCENT }}>draw_shape</span>(sides, size):{"\n"}
          {"  "}turtle.polygon(sides, size){"\n\n"}
          <span style={{ color: "#fbbf24" }}>for</span> i{" "}
          <span style={{ color: "#fbbf24" }}>in</span> range(
          <span style={{ color: "#34d399" }}>{dials.repeat}</span>):{"\n"}
          {"  "}<span style={{ color: ACCENT }}>draw_shape</span>(
          <span style={{ color: "#34d399" }}>{dials.sides}</span>,{" "}
          <span style={{ color: "#34d399" }}>{dials.size}</span> + i*
          <span style={{ color: "#34d399" }}>{dials.grow}</span>){"\n"}
          {"  "}turtle.right(<span style={{ color: "#34d399" }}>{dials.turn}</span>)
        </pre>
      </div>

      {/* ---------------- DIALS ---------------- */}
      <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
        {DIALS.map((d) => {
          const matched = (() => {
            if (d.key === "grow") return dials.grow > 0;
            return dials[d.key] === (TARGET as Dials)[d.key];
          })();
          return (
            <label key={d.key} className="flex flex-col gap-1 text-xs">
              <span className="flex items-center justify-between">
                <span className="text-ink-dim">
                  {d.label} <span className="text-ink-faint">· {d.hint}</span>
                </span>
                <span className="flex items-center gap-1.5 tabular-nums">
                  {matched && (
                    <span aria-hidden style={{ color: "#34d399" }}>
                      ✓
                    </span>
                  )}
                  <span className="font-display" style={{ color: ACCENT }}>
                    {dials[d.key]}
                    {d.key === "turn" ? "°" : ""}
                  </span>
                </span>
              </span>
              <input
                type="range"
                min={d.min}
                max={d.max}
                step={d.step}
                value={dials[d.key]}
                disabled={phase === "drawing"}
                onChange={(e) => setDial(d.key, Number(e.target.value))}
                aria-label={`${d.label} (${d.hint}), value ${dials[d.key]}`}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
                style={{ accentColor: ACCENT, touchAction: "none" }}
              />
            </label>
          );
        })}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint">Runs: {tries}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the dials and canvas"
          >
            Reset
          </button>
          <button
            type="button"
            onPointerDown={handleRun}
            disabled={phase === "drawing"}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Run the program and draw the pattern"
          >
            {phase === "drawing" ? "Drawing…" : won ? "Run again ▶" : "Run ▶"}
          </button>
        </div>
      </div>

      {/* win celebration */}
      {won && (
        <div
          className="panel flex flex-col items-center gap-1 rounded-xl p-3 text-center"
          style={{ boxShadow: `0 0 0 1px ${ACCENT}` }}
        >
          <div className="text-2xl">🎉 ⭐⭐⭐</div>
          <p className="text-xs" style={{ color: ACCENT }}>
            One function + a loop drew all 12 shapes!
          </p>
        </div>
      )}
    </div>
  );
}
