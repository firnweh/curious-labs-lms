"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Mini Maze 🌀 ─────────────────────────────────────────────────────────────
   CLASS 1-3 (junior, age ~6-8) CODING lab. ONE goal: plan several moves ahead to
   solve a winding path — sequencing with obstacles. A mouse 🐭 must reach the
   cheese 🧀 across a 5×5 grid with a few walls 🧱 forming one clear route. The
   child taps big D-pad arrow cards to build a PLAN strip, ⬅️ undoes the last one,
   and ▶ GO sends the mouse hopping one hop per step, lighting the trail. Reach the
   cheese → big celebration + onComplete({passed:true,stars:3}) once. Hit a wall or
   edge → friendly bonk 🙈, hop home, KEEP the plan so they can fix it. No reading,
   no timers, no scolding, always winnable. */

const ACCENT = "#22d3ee";
const COLS = 5;
const ROWS = 5;
const STEP_MS = 430;
const MAX_STEPS = 18;

/** Absolute directions. 0=Up 1=Down 2=Left 3=Right. Row 0 = top of the grid. */
type Dir = 0 | 1 | 2 | 3;
const DX: readonly number[] = [0, 0, -1, 1];
const DY: readonly number[] = [-1, 1, 0, 0];
const ARROW: Record<Dir, string> = { 0: "⬆️", 1: "⬇️", 2: "⬅️", 3: "➡️" };
const DIR_WORD: Record<Dir, string> = { 0: "up", 1: "down", 2: "left", 3: "right" };
// D-pad layout: up on top, left+right in the middle, down on the bottom.
const PAD_ORDER: readonly Dir[] = [0, 2, 3, 1];

interface Cell {
  c: number;
  r: number;
}

// ── Fixed, friendly level ────────────────────────────────────────────────────
// Intended path: (0,4)→up→up→(0,2)→right→right→(2,2)→up→up→(2,0)=cheese.
// Walls sit OFF that trail and gently fence in the tempting wrong turns.
const START: Cell = { c: 0, r: 4 };
const GOAL: Cell = { c: 2, r: 0 };
const WALLS: readonly Cell[] = [
  { c: 1, r: 4 },
  { c: 1, r: 3 },
  { c: 1, r: 2 },
  { c: 3, r: 2 },
  { c: 1, r: 0 },
  { c: 3, r: 0 },
];

const isWall = (c: number, r: number): boolean =>
  WALLS.some((w) => w.c === c && w.r === r);

// ── Deterministic simulation ─────────────────────────────────────────────────
type Outcome = "win" | "wall" | "edge" | "short";

interface SimResult {
  trail: Cell[]; // cells visited in order, including the start cell
  outcome: Outcome;
}

/** Walk the arrow plan from the fixed start; stop on win / wall / edge. */
function simulate(dirs: Dir[]): SimResult {
  let { c, r } = START;
  const trail: Cell[] = [{ c, r }];
  for (const d of dirs) {
    const nc = c + DX[d];
    const nr = r + DY[d];
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return { trail, outcome: "edge" };
    if (isWall(nc, nr)) return { trail, outcome: "wall" };
    c = nc;
    r = nr;
    trail.push({ c, r });
    if (c === GOAL.c && r === GOAL.r) return { trail, outcome: "win" };
  }
  return { trail, outcome: "short" };
}

// ── Layout maths (virtual SVG units; CSS scales it responsively) ──────────────
const PAD = 8;
const TILE = 56;
const VW = PAD * 2 + COLS * TILE;
const VH = PAD * 2 + ROWS * TILE;
const cx = (c: number): number => PAD + c * TILE + TILE / 2;
const cy = (r: number): number => PAD + r * TILE + TILE / 2;

type Phase = "idle" | "running" | "won" | "bonk";

interface Step {
  id: number;
  dir: Dir;
}
let UID = 1;
const nextId = (): number => UID++;

// ── Soft optional sound (created on a tap; never autoplays or throws) ─────────
function useChirp(): { blip: () => void; chime: () => void } {
  const ctxRef = useRef<AudioContext | null>(null);
  const ensure = (): AudioContext | null => {
    try {
      if (ctxRef.current === null) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return null;
        ctxRef.current = new Ctor();
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  };
  const tone = (freq: number, dur: number, when: number): void => {
    const ctx = ensure();
    if (!ctx) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      /* ignore */
    }
  };
  const blip = useCallback(() => tone(660, 0.09, 0), []);
  const chime = useCallback(() => {
    tone(523, 0.16, 0);
    tone(659, 0.16, 0.12);
    tone(784, 0.28, 0.24);
  }, []);
  return { blip, chime };
}

// ── Pre-computed confetti burst (purely decorative, transform/opacity only) ───
interface Confetti {
  emoji: string;
  dx: number; // px travelled horizontally
  dy: number; // px travelled vertically (positive = down)
  spin: number; // degrees of tumble
  delay: number; // s
  dur: number; // s
}
const CONFETTI: readonly Confetti[] = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const reach = 70 + (i % 4) * 18;
  return {
    emoji: ["✨", "🎉", "⭐", "💫", "🟡", "🩵"][i % 6],
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach * 0.7) + 36,
    spin: (i % 2 === 0 ? 1 : -1) * (180 + (i % 5) * 90),
    delay: (i % 7) * 0.05,
    dur: 1.1 + (i % 4) * 0.18,
  };
});

export default function MiniMaze({ onComplete }: ActivityProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pos, setPos] = useState<Cell>(START);
  const [litTrail, setLitTrail] = useState<Cell[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);
  const { blip, chime } = useChirp();

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const running = phase === "running";
  const won = phase === "won";
  const bonking = phase === "bonk";
  const locked = running || won;

  const resetMouse = useCallback(() => {
    setPos(START);
    setLitTrail([]);
  }, []);

  const addStep = useCallback(
    (dir: Dir) => {
      if (locked) return;
      blip();
      setSteps((s) => (s.length >= MAX_STEPS ? s : [...s, { id: nextId(), dir }]));
      setPhase("idle");
      resetMouse();
    },
    [locked, blip, resetMouse],
  );

  const undoStep = useCallback(() => {
    if (locked) return;
    blip();
    setSteps((s) => s.slice(0, -1));
    setPhase("idle");
    resetMouse();
  }, [locked, blip, resetMouse]);

  const reset = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    setSteps([]);
    setPhase("idle");
    resetMouse();
  }, [clearTimer, resetMouse]);

  const go = useCallback(() => {
    if (locked) return;
    if (steps.length === 0) {
      // Empty plan isn't a "mistake" — a gentle nudge, then settle.
      setPhase("bonk");
      timerRef.current = setTimeout(() => setPhase("idle"), 480);
      return;
    }
    const sim = simulate(steps.map((s) => s.dir));
    clearTimer();
    resetMouse();
    setPhase("running");

    let i = 0; // index into trail (0 = start, already shown)
    const tick = (): void => {
      i += 1;
      if (i >= sim.trail.length) {
        if (sim.outcome === "win") {
          setLitTrail(sim.trail);
          setPhase("won");
          chime();
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({ passed: true, stars: 3, detail: "Reached the cheese! 🧀" });
          }
        } else {
          // Friendly bonk, then hop home. Plan is KEPT so they can fix it.
          setPhase("bonk");
          if (sim.outcome === "wall" || sim.outcome === "edge") {
            onComplete({
              passed: false,
              detail:
                sim.outcome === "wall"
                  ? "Bonk! A wall is in the way — try a new path. 🙈"
                  : "Whoops — off the edge! Try again. 🤔",
            });
          }
          timerRef.current = setTimeout(() => {
            resetMouse();
            setPhase("idle");
          }, 660);
        }
        return;
      }
      setPos(sim.trail[i]);
      setLitTrail(sim.trail.slice(0, i + 1));
      timerRef.current = setTimeout(tick, STEP_MS);
    };

    setPos(sim.trail[0]);
    setLitTrail([sim.trail[0]]);
    timerRef.current = setTimeout(tick, STEP_MS);
  }, [locked, steps, clearTimer, resetMouse, chime, onComplete]);

  const statusEmoji = useMemo<string>(() => {
    if (won) return "🎉";
    if (bonking) return "🙈";
    if (running) return "🐾";
    return "🐭";
  }, [won, bonking, running]);

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      {/* ── Tiny visual status (emoji only, no sentences) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "The mouse reached the cheese!"
            : running
              ? "The mouse is hopping"
              : bonking
                ? "Bonk, try again"
                : "Plan a path, then press Go"
        }
        style={{
          background: won ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          data-jcm-idle={won || bonking || running ? undefined : ""}
          className="inline-block"
          style={{
            animation: won
              ? "jcmaze-cheer 0.9s cubic-bezier(.34,1.56,.64,1) infinite"
              : bonking || running
                ? undefined
                : "jcmaze-breathe 2.8s ease-in-out infinite",
          }}
        >
          {statusEmoji}
        </span>
        {won ? (
          <span aria-hidden="true" className="text-2xl">
            {[0, 1, 2].map((i) => (
              <span
                key={`hs-${i}`}
                className="inline-block"
                style={{
                  animation: `jcmaze-star-pop 0.55s cubic-bezier(.34,1.56,.64,1) ${0.15 + i * 0.28}s both`,
                }}
              >
                ⭐
              </span>
            ))}
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            🐭→🧀
          </span>
        )}
        {won && (
          <span
            aria-hidden="true"
            className="inline-block text-2xl"
            style={{ animation: "jcmaze-float 1.4s ease-in-out infinite" }}
          >
            ✨
          </span>
        )}
      </div>

      {/* ── The maze grid ── */}
      <div className="panel relative w-full max-w-[430px] overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A 5 by 5 maze with a mouse and cheese to reach"
        >
          <defs>
            <radialGradient id="jcmaze-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.95" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* tiles */}
          {Array.from({ length: COLS * ROWS }).map((_, idx) => {
            const c = idx % COLS;
            const r = Math.floor(idx / COLS);
            const wall = isWall(c, r);
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
                  wall
                    ? "#1b2436"
                    : lit
                      ? "rgba(34,211,238,0.22)"
                      : "rgba(255,255,255,0.05)"
                }
                stroke={wall ? "#3a4866" : lit ? ACCENT : "rgba(120,140,170,0.22)"}
                strokeWidth={lit ? 2 : 1.2}
              />
            );
          })}

          {/* walls */}
          {WALLS.map((w, i) => (
            <text
              key={`w-${i}`}
              x={cx(w.c)}
              y={cy(w.r) + 1}
              fontSize={TILE * 0.5}
              textAnchor="middle"
              dominantBaseline="central"
              aria-hidden="true"
            >
              🧱
            </text>
          ))}

          {/* cheese / goal */}
          <g
            data-jcm-idle={won ? undefined : ""}
            style={{
              transformOrigin: `${cx(GOAL.c)}px ${cy(GOAL.r)}px`,
              transformBox: "view-box",
              animation: won ? undefined : "jcmaze-goal-pulse 2.4s ease-in-out infinite",
            }}
          >
            <circle
              cx={cx(GOAL.c)}
              cy={cy(GOAL.r)}
              r={TILE * 0.5}
              fill="url(#jcmaze-glow)"
              opacity={won ? 1 : 0.6}
            />
          </g>
          <g
            data-jcm-idle={won ? undefined : ""}
            style={{
              transformOrigin: `${cx(GOAL.c)}px ${cy(GOAL.r)}px`,
              transformBox: "view-box",
              animation: won
                ? "jcmaze-pop 0.7s ease-out"
                : "jcmaze-cheese-bob 2.6s ease-in-out infinite",
            }}
          >
            <text
              x={cx(GOAL.c)}
              y={cy(GOAL.r) + 1}
              fontSize={TILE * 0.56}
              textAnchor="middle"
              dominantBaseline="central"
              aria-label="cheese to reach"
            >
              🧀
            </text>
          </g>

          {/* the mouse */}
          <g
            style={{
              transform: `translate(${cx(pos.c)}px, ${cy(pos.r)}px)`,
              transition: running
                ? `transform ${STEP_MS}ms ease-in-out`
                : "transform 140ms ease-out",
            }}
          >
            <g
              data-jcm-idle={!bonking && !running && !won ? "" : undefined}
              data-jcm-loop={running ? "" : undefined}
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: bonking
                  ? "jcmaze-wobble 0.5s ease-in-out"
                  : running
                    ? "jcmaze-hop 0.45s ease-in-out infinite"
                    : won
                      ? "jcmaze-cheer 0.9s cubic-bezier(.34,1.56,.64,1) infinite"
                      : "jcmaze-breathe 2.8s ease-in-out infinite",
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
                aria-label="mouse"
              >
                🐭
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* ── Plan strip: the arrows planned so far, in order ── */}
      <div
        className="flex min-h-[52px] w-full max-w-[430px] flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
        }}
        aria-label="Your planned path of arrows"
      >
        {steps.length === 0 ? (
          <span aria-hidden="true" className="text-2xl opacity-50">
            🐭 …… 🧀
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
                animation: "jcmaze-snap 0.42s cubic-bezier(.34,1.56,.64,1) both",
              }}
            >
              <span aria-hidden="true">{ARROW[s.dir]}</span>
            </span>
          ))
        )}
      </div>

      {/* ── The FOUR big arrow command cards (D-pad layout) ── */}
      <div className="grid w-full max-w-[300px] grid-cols-3 grid-rows-3 gap-2">
        {PAD_ORDER.map((dir) => {
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
              disabled={locked}
              aria-label={`Add a step going ${DIR_WORD[dir]}`}
              className={`grid h-[78px] place-items-center rounded-2xl text-3xl active:scale-90 disabled:opacity-40 ${cellClass}`}
              style={{
                touchAction: "none",
                background: "rgba(34,211,238,0.10)",
                border: `2px solid ${ACCENT}`,
                color: ACCENT,
                boxShadow: locked ? undefined : "0 5px 0 0 rgba(14,138,160,0.7)",
                transition: "transform 260ms cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              <span aria-hidden="true">{ARROW[dir]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Controls: Undo · GO · Reset ── */}
      <div className="flex w-full max-w-[430px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            undoStep();
          }}
          disabled={locked || steps.length === 0}
          aria-label="Remove the last arrow"
          className="grid h-[72px] w-[72px] place-items-center rounded-2xl text-2xl active:scale-90 disabled:opacity-30"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
            boxShadow: "0 5px 0 0 rgba(40,52,76,0.8)",
            transition: "transform 260ms cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span aria-hidden="true">⬅️</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            go();
          }}
          disabled={locked}
          aria-label="Go — make the mouse hop the path"
          className="flex h-[72px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#060810",
            boxShadow: "0 6px 0 0 #0e8aa0",
            transition: "transform 260ms cubic-bezier(.34,1.56,.64,1)",
            animation:
              !locked && steps.length > 0
                ? "jcmaze-float 1.6s ease-in-out infinite"
                : undefined,
          }}
          data-jcm-idle={!locked && steps.length > 0 ? "" : undefined}
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
            reset();
          }}
          disabled={running}
          aria-label="Start over"
          className="grid h-[72px] w-[72px] place-items-center rounded-2xl text-2xl active:scale-90 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
            boxShadow: "0 5px 0 0 rgba(40,52,76,0.8)",
            transition: "transform 260ms cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* ── BIG win celebration: confetti burst + bouncing stars ── */}
      {won && (
        <div
          className="pointer-events-none relative flex h-16 w-full max-w-[430px] items-center justify-center"
          aria-hidden="true"
        >
          {/* confetti flying outward from the centre */}
          <div className="absolute left-1/2 top-1/2 h-0 w-0">
            {CONFETTI.map((p, i) => (
              <span
                key={`cf-${i}`}
                className="absolute text-lg"
                style={
                  {
                    left: 0,
                    top: 0,
                    "--jcm-dx": `${p.dx}px`,
                    "--jcm-dy": `${p.dy}px`,
                    "--jcm-spin": `${p.spin}deg`,
                    animation: `jcmaze-confetti ${p.dur}s cubic-bezier(.2,.6,.3,1) ${p.delay}s infinite`,
                    willChange: "transform, opacity",
                  } as CSSProperties
                }
              >
                {p.emoji}
              </span>
            ))}
          </div>
          {/* the three stars pop in one at a time with a bounce */}
          <div className="relative z-10 flex gap-1 text-4xl">
            {[0, 1, 2].map((i) => (
              <span
                key={`star-${i}`}
                className="inline-block"
                style={{
                  animation: `jcmaze-star-pop 0.6s cubic-bezier(.34,1.56,.64,1) ${0.15 + i * 0.28}s both`,
                  filter: `drop-shadow(0 0 6px ${ACCENT}aa)`,
                }}
              >
                ⭐
              </span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes jcmaze-wobble {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-13deg); }
          45% { transform: rotate(11deg); }
          70% { transform: rotate(-7deg); }
          90% { transform: rotate(4deg); }
        }
        /* Hopping mouse with squash-and-stretch: crouch, leap (stretch), land (squash). */
        @keyframes jcmaze-hop {
          0%   { transform: translateY(0)    scale(1, 1); }
          18%  { transform: translateY(1px)  scale(1.1, 0.86); }
          50%  { transform: translateY(-7px) scale(0.9, 1.16); }
          82%  { transform: translateY(1px)  scale(1.1, 0.86); }
          100% { transform: translateY(0)    scale(1, 1); }
        }
        @keyframes jcmaze-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.28); }
          100% { transform: scale(1); }
        }
        /* Slow, calm "breathing" while the mouse waits — never static. */
        @keyframes jcmaze-breathe {
          0%, 100% { transform: translateY(0)     scale(1, 1); }
          50%      { transform: translateY(-1.5px) scale(1.03, 0.97); }
        }
        /* Big happy victory dance: bouncy jump + cheeky wiggle. */
        @keyframes jcmaze-cheer {
          0%   { transform: translateY(0)    rotate(0deg)  scale(1, 1); }
          15%  { transform: translateY(2px)  rotate(0deg)  scale(1.12, 0.88); }
          40%  { transform: translateY(-12px) rotate(-9deg) scale(0.92, 1.14); }
          60%  { transform: translateY(-10px) rotate(9deg)  scale(0.94, 1.12); }
          80%  { transform: translateY(1px)  rotate(-3deg) scale(1.08, 0.92); }
          100% { transform: translateY(0)    rotate(0deg)  scale(1, 1); }
        }
        /* Cheese bobs and glints happily while waiting to be reached. */
        @keyframes jcmaze-cheese-bob {
          0%, 100% { transform: translateY(0)    rotate(-3deg); }
          50%      { transform: translateY(-2px) rotate(3deg); }
        }
        /* Goal glow gently pulses so the target feels inviting. */
        @keyframes jcmaze-goal-pulse {
          0%, 100% { opacity: 0.45; transform: scale(0.94); }
          50%      { opacity: 0.75; transform: scale(1.06); }
        }
        /* Springy, toy-like press pop with overshoot. */
        @keyframes jcmaze-press {
          0%   { transform: scale(1); }
          35%  { transform: scale(0.82); }
          100% { transform: scale(1); }
        }
        /* A planned arrow card springs into its slot. */
        @keyframes jcmaze-snap {
          0%   { transform: translateY(-10px) scale(0.5); opacity: 0; }
          60%  { transform: translateY(2px)   scale(1.18); opacity: 1; }
          100% { transform: translateY(0)     scale(1); opacity: 1; }
        }
        /* Each victory star pops in with a bounce. */
        @keyframes jcmaze-star-pop {
          0%   { transform: scale(0)   rotate(-30deg); opacity: 0; }
          60%  { transform: scale(1.4) rotate(8deg);   opacity: 1; }
          100% { transform: scale(1)   rotate(0deg);   opacity: 1; }
        }
        /* Confetti flying outward and tumbling down. */
        @keyframes jcmaze-confetti {
          0%   { transform: translate(0, 0) rotate(0deg) scale(0.4); opacity: 0; }
          12%  { opacity: 1; }
          100% { transform: translate(var(--jcm-dx), var(--jcm-dy)) rotate(var(--jcm-spin)) scale(1); opacity: 0; }
        }
        @keyframes jcmaze-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          /* Stop the looping idle/running ambient loops; keep brief one-shot feedback gentle. */
          [data-jcm-idle], [data-jcm-loop] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
