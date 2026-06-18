"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Star Walk — a JUNIOR (Class 1-3) CODING activity: SEQUENCING, no loops.
 * A tiger 🐯 sits on a start cell. A star ⭐ waits a few clear steps away.
 * The child taps the FOUR big arrows ⬆️⬇️⬅️➡️ to build a "program strip",
 * then taps GO ▶ to send the tiger walking one cell per step. Land on the
 * star → big happy celebration + onComplete({passed:true,stars:3}). Walk off
 * the grid or onto a rock → the tiger wobbles and hops back to start, no
 * scolding. Built to be understood from VISUALS alone — no reading required.
 * Touch-first (pointer events), big targets, deterministic, always winnable.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#22d3ee";
const COLS = 5;
const ROWS = 4;
const STEP_MS = 360;

/** Absolute directions — NO turning. 0=Up 1=Down 2=Left 3=Right. Row 0 = top. */
type Dir = 0 | 1 | 2 | 3;
const DX: readonly number[] = [0, 0, -1, 1];
const DY: readonly number[] = [-1, 1, 0, 0];
const ARROW: Record<Dir, string> = { 0: "⬆️", 1: "⬇️", 2: "⬅️", 3: "➡️" };
const DIR_WORD: Record<Dir, string> = { 0: "up", 1: "down", 2: "left", 3: "right" };
// Display order for the arrow pad: up / left+right / down (a familiar D-pad).
const PAD_ORDER: readonly Dir[] = [0, 2, 3, 1];

interface Cell {
  c: number;
  r: number;
}

// ── Fixed, friendly level ────────────────────────────────────────────────
// A clear L-path: 3 right, then 2 up → 5 steps. Rocks sit well off the trail.
const START: Cell = { c: 0, r: 3 };
const GOAL: Cell = { c: 3, r: 1 };
const ROCKS: readonly Cell[] = [
  { c: 1, r: 1 },
  { c: 4, r: 3 },
  { c: 2, r: 0 },
];

const isRock = (c: number, r: number): boolean =>
  ROCKS.some((k) => k.c === c && k.r === r);

// ── Simulation ────────────────────────────────────────────────────────────
type Outcome =
  | { type: "win" }
  | { type: "rock" }
  | { type: "edge" }
  | { type: "short" }; // path ended before reaching the star (still fine)

interface SimResult {
  trail: Cell[]; // cells visited in order, including the start cell
  outcome: Outcome;
}

/** Deterministically walk the arrow program from the fixed start cell. */
function simulate(steps: Dir[]): SimResult {
  let { c, r } = START;
  const trail: Cell[] = [{ c, r }];
  for (const d of steps) {
    const nc = c + DX[d];
    const nr = r + DY[d];
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) {
      return { trail, outcome: { type: "edge" } };
    }
    if (isRock(nc, nr)) {
      return { trail, outcome: { type: "rock" } };
    }
    c = nc;
    r = nr;
    trail.push({ c, r });
    if (c === GOAL.c && r === GOAL.r) return { trail, outcome: { type: "win" } };
  }
  return { trail, outcome: { type: "short" } };
}

// ── Layout maths (virtual SVG units; CSS scales it responsively) ──────────
const PAD = 8;
const TILE = 56; // ≥ 56px touch target intent at full size
const VW = PAD * 2 + COLS * TILE;
const VH = PAD * 2 + ROWS * TILE;
const cx = (c: number): number => PAD + c * TILE + TILE / 2;
const cy = (r: number): number => PAD + r * TILE + TILE / 2;

type Phase = "idle" | "running" | "won" | "wobble";

interface Step {
  id: number;
  dir: Dir;
}
let UID = 1;
const nextId = (): number => UID++;

export default function StarWalk({ onComplete }: ActivityProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pos, setPos] = useState<Cell>(START);
  const [litTrail, setLitTrail] = useState<Cell[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solvedRef = useRef<boolean>(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const running = phase === "running";
  const won = phase === "won";

  const resetWalker = useCallback(() => {
    setPos(START);
    setLitTrail([]);
  }, []);

  const addStep = useCallback(
    (dir: Dir) => {
      if (running || won) return;
      setSteps((s) => (s.length >= 14 ? s : [...s, { id: nextId(), dir }]));
      setPhase("idle");
      resetWalker();
    },
    [running, won, resetWalker],
  );

  const undoStep = useCallback(() => {
    if (running || won) return;
    setSteps((s) => s.slice(0, -1));
    setPhase("idle");
    resetWalker();
  }, [running, won, resetWalker]);

  const clearAll = useCallback(() => {
    clearTimer();
    solvedRef.current = false;
    setSteps([]);
    setPhase("idle");
    resetWalker();
  }, [clearTimer, resetWalker]);

  const go = useCallback(() => {
    if (running || won) return;
    if (steps.length === 0) {
      // Nudge with a gentle wobble, no fail toast — empty isn't a "mistake".
      setPhase("wobble");
      timerRef.current = setTimeout(() => setPhase("idle"), 520);
      return;
    }

    const sim = simulate(steps.map((s) => s.dir));
    clearTimer();
    resetWalker();
    setPhase("running");

    let i = 0; // index into trail (0 = start, already shown)
    const tick = (): void => {
      i += 1;
      if (i >= sim.trail.length) {
        const out = sim.outcome;
        if (out.type === "win") {
          setLitTrail(sim.trail);
          setPhase("won");
          if (!solvedRef.current) {
            solvedRef.current = true;
            onComplete({ passed: true, stars: 3, detail: "You reached the star! ⭐" });
          }
        } else {
          // Gentle: wobble at the stopping point, then hop home. No harsh fail.
          setPhase("wobble");
          timerRef.current = setTimeout(() => {
            resetWalker();
            setPhase("idle");
          }, 620);
        }
        return;
      }
      const cell = sim.trail[i];
      setPos(cell);
      setLitTrail(sim.trail.slice(0, i + 1));
      timerRef.current = setTimeout(tick, STEP_MS);
    };

    setPos(sim.trail[0]);
    setLitTrail([sim.trail[0]]);
    timerRef.current = setTimeout(tick, STEP_MS);
  }, [running, won, steps, clearTimer, resetWalker, onComplete]);

  const statusEmoji = useMemo<string>(() => {
    if (won) return "🎉";
    if (phase === "wobble") return "🤔";
    if (running) return "🐾";
    return "🐯";
  }, [won, phase, running]);

  const wobbling = phase === "wobble";

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      {/* ── Tiny visual status (emoji, not paragraphs) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "You reached the star!"
            : running
              ? "The tiger is walking"
              : wobbling
                ? "Oops, try again"
                : "Build a path, then press Go"
        }
        style={{
          background: won ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {won ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            →
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            🎈
          </span>
        )}
      </div>

      {/* ── The grid ── */}
      <div className="panel w-full max-w-[420px] rounded-2xl p-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="h-auto w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A grid with a tiger and a star to reach"
        >
          <defs>
            <radialGradient id="sw-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.95" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* tiles */}
          {Array.from({ length: COLS * ROWS }).map((_, idx) => {
            const c = idx % COLS;
            const r = Math.floor(idx / COLS);
            const rock = isRock(c, r);
            const lit = litTrail.some((t) => t.c === c && t.r === r);
            return (
              <rect
                key={`t-${idx}`}
                x={PAD + c * TILE + 2}
                y={PAD + r * TILE + 2}
                width={TILE - 4}
                height={TILE - 4}
                rx={10}
                fill={
                  rock
                    ? "#1b2436"
                    : lit
                      ? "rgba(34,211,238,0.22)"
                      : "rgba(255,255,255,0.05)"
                }
                stroke={rock ? "#3a4866" : lit ? ACCENT : "rgba(120,140,170,0.22)"}
                strokeWidth={lit ? 2 : 1.2}
              />
            );
          })}

          {/* rocks */}
          {ROCKS.map((k, i) => (
            <text
              key={`k-${i}`}
              x={cx(k.c)}
              y={cy(k.r) + 1}
              fontSize={TILE * 0.5}
              textAnchor="middle"
              dominantBaseline="central"
              aria-hidden="true"
            >
              🪨
            </text>
          ))}

          {/* star / goal */}
          <circle
            cx={cx(GOAL.c)}
            cy={cy(GOAL.r)}
            r={TILE * 0.5}
            fill="url(#sw-glow)"
            opacity={won ? 1 : 0.6}
          />
          <g
            style={{
              transformOrigin: `${cx(GOAL.c)}px ${cy(GOAL.r)}px`,
              transformBox: "fill-box",
              animation: won ? "sw-spin 1.1s linear infinite" : undefined,
            }}
          >
            <text
              x={cx(GOAL.c)}
              y={cy(GOAL.r) + 1}
              fontSize={TILE * 0.56}
              textAnchor="middle"
              dominantBaseline="central"
              aria-label="star to reach"
            >
              ⭐
            </text>
          </g>

          {/* the tiger walker */}
          <g
            style={{
              transform: `translate(${cx(pos.c)}px, ${cy(pos.r)}px)`,
              transition: running
                ? `transform ${STEP_MS}ms ease-in-out`
                : "transform 140ms ease-out",
            }}
          >
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: wobbling
                  ? "sw-wobble 0.5s ease-in-out"
                  : won
                    ? "sw-pop 0.6s ease-out"
                    : undefined,
              }}
            >
              <circle
                r={TILE * 0.42}
                fill="#0b1220"
                stroke={ACCENT}
                strokeWidth={2}
                style={won ? { filter: `drop-shadow(0 0 6px ${ACCENT})` } : undefined}
              />
              <text
                x={0}
                y={1}
                fontSize={TILE * 0.52}
                textAnchor="middle"
                dominantBaseline="central"
                aria-label="tiger"
              >
                🐯
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* ── Program strip: the arrows the child has added, in order ── */}
      <div
        className="flex min-h-[52px] w-full max-w-[420px] flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
        }}
        aria-label="Your path of arrows"
      >
        {steps.length === 0 ? (
          <span aria-hidden="true" className="text-2xl opacity-50">
            🐯 …… ⭐
          </span>
        ) : (
          steps.map((s, i) => (
            <span
              key={s.id}
              aria-label={`Step ${i + 1}: ${DIR_WORD[s.dir]}`}
              className="grid h-9 w-9 place-items-center rounded-lg text-xl"
              style={{
                background: "rgba(34,211,238,0.12)",
                border: `1.5px solid ${ACCENT}`,
              }}
            >
              <span aria-hidden="true">{ARROW[s.dir]}</span>
            </span>
          ))
        )}
      </div>

      {/* ── The FOUR big arrow buttons (D-pad layout) ── */}
      <div className="grid w-full max-w-[300px] grid-cols-3 grid-rows-3 gap-2">
        {PAD_ORDER.map((dir) => {
          // place arrows in a + shape: up=top-center, left=mid-left, right=mid-right, down=bottom-center
          const cellClass =
            dir === 0
              ? "col-start-2 row-start-1"
              : dir === 2
                ? "col-start-1 row-start-2"
                : dir === 3
                  ? "col-start-3 row-start-2"
                  : "col-start-2 row-start-3";
          return (
            <button
              key={dir}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                addStep(dir);
              }}
              disabled={running || won}
              aria-label={`Add a step going ${DIR_WORD[dir]}`}
              className={`grid h-[62px] place-items-center rounded-2xl text-3xl transition active:scale-90 disabled:opacity-40 ${cellClass}`}
              style={{
                touchAction: "none",
                background: "rgba(34,211,238,0.10)",
                border: `2px solid ${ACCENT}`,
                color: ACCENT,
              }}
            >
              <span aria-hidden="true">{ARROW[dir]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Controls: Undo · GO · Start over ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            undoStep();
          }}
          disabled={running || won || steps.length === 0}
          aria-label="Remove the last arrow"
          className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-2xl transition active:scale-90 disabled:opacity-30"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">↩️</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            go();
          }}
          disabled={running || won}
          aria-label="Go — make the tiger walk the path"
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#060810",
            boxShadow: `0 6px 0 0 #0e8aa0`,
          }}
        >
          <span aria-hidden="true">{running ? "🐾" : "▶"}</span>
          <span aria-hidden="true" className="text-xl font-extrabold">
            GO
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            clearAll();
          }}
          disabled={running}
          aria-label="Start over"
          className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-2xl transition active:scale-90 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      <style>{`
        @keyframes sw-wobble {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-13deg); }
          45% { transform: rotate(11deg); }
          70% { transform: rotate(-7deg); }
          90% { transform: rotate(4deg); }
        }
        @keyframes sw-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.28); }
          100% { transform: scale(1); }
        }
        @keyframes sw-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
