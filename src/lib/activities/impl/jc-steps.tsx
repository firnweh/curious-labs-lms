"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Walk the Path 👣 ─────────────────────────────────────────────────────────
   JUNIORS (Class 1-3, age ~6-8). Single learning goal: SEQUENCING + PLANNING —
   the moves run in the EXACT order you place them, and now the child must really
   PLAN the route across THREE rounds of growing challenge. A chick 🐥 starts on a
   4×4 grid; a home 🏠 waits somewhere across the board. The child taps a big
   D-pad of arrow cards (⬆️⬇️⬅️➡️); each tap APPENDS to a visible plan strip. A
   huge GO ▶ runs the plan one hop per arrow.

   THE ROUNDS (deterministic, hand-authored):
     1. Two hops up — a gentle warm-up that teaches the mechanic.
     2. A bend: right, right, up, up — real ordering, no straight shot.
     3. THE TWIST: a rock 🪨 blocks the straight line between chick and home, so
        the obvious "head straight at it" plan bonks. The child must look, spot
        the rock, and plan a DETOUR around it. Brute-force / repeating the last
        round's path fails — you have to reason about the route.

   Reach home → that round is won and the next, harder one slides in. Solve all
   three → big celebration + ⭐⭐⭐ and onComplete({passed:true,stars:3}) fires once.
   Step off the grid OR bump the rock → friendly bonk 🙈, hop back to start, no
   scolding, try again. NO READING NEEDED — all emoji, colour, shape, animation.
   Touch-first, deterministic, always winnable. */

const ACCENT = "#22d3ee";
const COLS = 4;
const ROWS = 4;
const STEP_MS = 460;
const MAX_STEPS = 12;

/** Absolute directions — NO turning. 0=Up 1=Down 2=Left 3=Right. Row 0 = top. */
type Dir = 0 | 1 | 2 | 3;
const DX: readonly number[] = [0, 0, -1, 1];
const DY: readonly number[] = [-1, 1, 0, 0];
const ARROW: Record<Dir, string> = { 0: "⬆️", 1: "⬇️", 2: "⬅️", 3: "➡️" };
const DIR_WORD: Record<Dir, string> = { 0: "up", 1: "down", 2: "left", 3: "right" };
// D-pad layout: up / left+right / down.
const PAD_ORDER: readonly Dir[] = [0, 2, 3, 1];

interface Cell {
  c: number;
  r: number;
}

/** A round = where the chick starts, where home is, and any rocks to route around.
 *  Hand-authored so each is solvable and each is a fresh, harder route. */
interface Level {
  start: Cell;
  goal: Cell;
  rocks: readonly Cell[];
}

const LEVELS: readonly Level[] = [
  // 1) Warm-up: two hops straight up. Learn that order + GO move the chick.
  { start: { c: 1, r: 3 }, goal: { c: 1, r: 1 }, rocks: [] },
  // 2) A bend: right, right, up, up. Ordering matters, no straight shot.
  { start: { c: 0, r: 3 }, goal: { c: 2, r: 1 }, rocks: [] },
  // 3) TWIST: a rock sits on the straight line up. Heading straight bonks —
  //    the child must DETOUR around it (e.g. up, right, up, up, left).
  { start: { c: 1, r: 3 }, goal: { c: 1, r: 0 }, rocks: [{ c: 1, r: 1 }] },
];

// ── Simulation ───────────────────────────────────────────────────────────────
type Outcome = { type: "win" } | { type: "edge" } | { type: "rock" } | { type: "short" };

interface SimResult {
  trail: Cell[]; // cells visited in order, including the start cell
  outcome: Outcome;
}

/** Deterministically walk the arrow plan from this level's start cell. */
function simulate(level: Level, steps: Dir[]): SimResult {
  let { c, r } = level.start;
  const trail: Cell[] = [{ c, r }];
  for (const d of steps) {
    const nc = c + DX[d];
    const nr = r + DY[d];
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) {
      return { trail, outcome: { type: "edge" } };
    }
    if (level.rocks.some((k) => k.c === nc && k.r === nr)) {
      return { trail, outcome: { type: "rock" } };
    }
    c = nc;
    r = nr;
    trail.push({ c, r });
    if (c === level.goal.c && r === level.goal.r) return { trail, outcome: { type: "win" } };
  }
  return { trail, outcome: { type: "short" } };
}

// ── Layout maths (virtual SVG units; CSS scales it responsively) ──────────────
const PAD = 8;
const TILE = 64;
const VW = PAD * 2 + COLS * TILE;
const VH = PAD * 2 + ROWS * TILE;
const cx = (c: number): number => PAD + c * TILE + TILE / 2;
const cy = (r: number): number => PAD + r * TILE + TILE / 2;

type Phase = "idle" | "running" | "won" | "bonk" | "done";

interface Step {
  id: number;
  dir: Dir;
}
let UID = 1;
const nextId = (): number => UID++;

/** Soft Web-Audio blips, created on a user gesture. Never throws / autoplays. */
function useBlips(): { blip: () => void; chime: () => void } {
  const ctxRef = useRef<AudioContext | null>(null);
  const ensure = (): AudioContext | null => {
    try {
      if (ctxRef.current === null) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        ctxRef.current = new Ctor();
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  };
  const tone = (freq: number, dur: number, delay = 0): void => {
    try {
      const ctx = ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      /* never let sound break play */
    }
  };
  const blip = useCallback((): void => tone(660, 0.09), []);
  const chime = useCallback((): void => {
    tone(523, 0.16, 0);
    tone(659, 0.16, 0.12);
    tone(784, 0.26, 0.24);
  }, []);
  useEffect(() => {
    return () => {
      try {
        ctxRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);
  return { blip, chime };
}

export default function WalkThePath({ onComplete }: ActivityProps) {
  const [level, setLevel] = useState<number>(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const lvl = LEVELS[level];
  const [pos, setPos] = useState<Cell>(LEVELS[0].start);
  const [litTrail, setLitTrail] = useState<Cell[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);
  const { blip, chime } = useBlips();

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const running = phase === "running";
  const won = phase === "won";
  const done = phase === "done";
  const bonking = phase === "bonk";
  const celebrating = won || done;
  // Once a round is won (or all done) the plan is frozen until the next slides in.
  const locked = running || celebrating;

  // Fresh round: park the chick at this level's start, clear the plan & trail.
  useEffect(() => {
    clearTimer();
    setSteps([]);
    setPhase("idle");
    setPos(LEVELS[level].start);
    setLitTrail([]);
  }, [level, clearTimer]);

  const resetChick = useCallback(() => {
    setPos(LEVELS[level].start);
    setLitTrail([]);
  }, [level]);

  const addStep = useCallback(
    (dir: Dir) => {
      if (locked) return;
      blip();
      setSteps((s) => (s.length >= MAX_STEPS ? s : [...s, { id: nextId(), dir }]));
      setPhase("idle");
      resetChick();
    },
    [locked, resetChick, blip],
  );

  const undoStep = useCallback(() => {
    if (locked) return;
    blip();
    setSteps((s) => s.slice(0, -1));
    setPhase("idle");
    resetChick();
  }, [locked, resetChick, blip]);

  // Reset = back to round one, fresh start.
  const reset = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    setSteps([]);
    setPhase("idle");
    setLevel(0);
    setPos(LEVELS[0].start);
    setLitTrail([]);
  }, [clearTimer]);

  const go = useCallback(() => {
    if (locked) return;
    if (steps.length === 0) {
      // Empty plan is not a mistake — a tiny bonk nudge, then settle.
      setPhase("bonk");
      timerRef.current = setTimeout(() => setPhase("idle"), 520);
      return;
    }

    const sim = simulate(lvl, steps.map((s) => s.dir));
    clearTimer();
    resetChick();
    setPhase("running");

    let i = 0; // index into trail (0 = start, already shown)
    const tick = (): void => {
      i += 1;
      if (i >= sim.trail.length) {
        const out = sim.outcome;
        if (out.type === "win") {
          setLitTrail(sim.trail);
          chime();
          const last = level >= LEVELS.length - 1;
          if (last) {
            setPhase("done");
            if (!reportedRef.current) {
              reportedRef.current = true;
              onComplete({ passed: true, stars: 3, detail: "Home all three times! 🏠🏠🏠" });
            }
          } else {
            // Win this round, then slide the next (harder) puzzle in.
            setPhase("won");
            timerRef.current = setTimeout(() => setLevel((l) => l + 1), 1150);
          }
        } else {
          // Friendly bonk (edge, rock, or too-short), then hop home — no harsh fail,
          // and never spam onComplete(passed:false).
          setPhase("bonk");
          timerRef.current = setTimeout(() => {
            resetChick();
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
  }, [locked, steps, lvl, level, clearTimer, resetChick, onComplete, chime]);

  const statusEmoji = useMemo<string>(() => {
    if (done) return "🏆";
    if (won) return "🎉";
    if (bonking) return "🙈";
    if (running) return "🐾";
    return "🐥";
  }, [done, won, bonking, running]);

  // Pure-visual confetti burst spec (no logic): fixed angles/colours so it is
  // deterministic and SSR-safe. Only renders while celebrating.
  const confetti = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => {
        const ang = (i / 14) * Math.PI * 2;
        const dist = 70 + (i % 3) * 26;
        const colors = ["#22d3ee", "#fbbf24", "#f472b6", "#a78bfa", "#34d399", "#f87171"];
        return {
          id: i,
          dx: Math.cos(ang) * dist,
          dy: Math.sin(ang) * dist - 20,
          color: colors[i % colors.length],
          delay: (i % 5) * 0.05,
          glyph: i % 3 === 0 ? "✨" : i % 3 === 1 ? "⭐" : "🎊",
        };
      }),
    [],
  );

  return (
    <div className="flex w-full max-w-[430px] flex-col items-center gap-3 font-mono text-ink">
      {/* ── Tiny visual status + round dots (emoji, not paragraphs) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          done
            ? "You solved all three rounds!"
            : won
              ? "Round solved! Next one coming up"
              : running
                ? "The chick is hopping"
                : bonking
                  ? "Bonk, try again"
                  : `Round ${level + 1} of 3 — plan a path around to home, then press Go`
        }
        style={{
          background: celebrating ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${celebrating ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: celebrating ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            animation: celebrating
              ? "jcsteps-cheer 0.7s cubic-bezier(.34,1.56,.64,1)"
              : bonking
                ? "jcsteps-wobble 0.5s ease-in-out"
                : running
                  ? undefined
                  : "jcsteps-breathe 2.6s ease-in-out infinite",
          }}
        >
          {statusEmoji}
        </span>

        {/* round progress: solved ● / current ◉ / upcoming ○ */}
        <span aria-hidden="true" className="inline-flex items-center gap-1.5">
          {LEVELS.map((_, i) => {
            const solved = i < level || done;
            const current = i === level && !done;
            return (
              <span
                key={i}
                className="grid place-items-center rounded-full"
                style={{
                  height: 13,
                  width: 13,
                  background: solved ? ACCENT : current ? "rgba(34,211,238,0.25)" : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                  animation: current ? "jcsteps-go-ready 1.5s ease-in-out infinite" : undefined,
                }}
              />
            );
          })}
        </span>

        {done ? (
          <span aria-hidden="true" className="text-2xl" style={{ letterSpacing: "0.05em" }}>
            {["⭐", "⭐", "⭐"].map((s, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  animation: `jcsteps-star-pop 0.5s cubic-bezier(.34,1.56,.64,1) ${0.25 + i * 0.22}s both`,
                }}
              >
                {s}
              </span>
            ))}
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            🐥→🏠
          </span>
        )}
        {done && (
          <span
            aria-hidden="true"
            className="text-2xl"
            style={{ display: "inline-block", animation: "jcsteps-float 1.4s ease-in-out infinite" }}
          >
            ✨
          </span>
        )}
      </div>

      {/* ── The 4×4 grid ── */}
      <div className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2">
        {/* BIG win confetti burst — pure visual, overlays the grid (final win only) */}
        {done && (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            aria-hidden="true"
          >
            {confetti.map((p) => (
              <span
                key={p.id}
                className="absolute text-2xl"
                style={{
                  color: p.color,
                  ["--jc-dx" as string]: `${p.dx}px`,
                  ["--jc-dy" as string]: `${p.dy}px`,
                  animation: `jcsteps-confetti 1.1s cubic-bezier(.2,.7,.3,1) ${p.delay}s both`,
                }}
              >
                {p.glyph}
              </span>
            ))}
          </div>
        )}
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A 4 by 4 grid with a chick, a home to reach, and rocks to go around"
        >
          <defs>
            <radialGradient id="jc-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.95" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* tiles */}
          {Array.from({ length: COLS * ROWS }).map((_, idx) => {
            const c = idx % COLS;
            const r = Math.floor(idx / COLS);
            const lit = litTrail.some((t) => t.c === c && t.r === r);
            return (
              <rect
                key={`t-${idx}`}
                x={PAD + c * TILE + 2}
                y={PAD + r * TILE + 2}
                width={TILE - 4}
                height={TILE - 4}
                rx={12}
                fill={lit ? "rgba(34,211,238,0.22)" : "rgba(255,255,255,0.05)"}
                stroke={lit ? ACCENT : "rgba(120,140,170,0.22)"}
                strokeWidth={lit ? 2 : 1.2}
              />
            );
          })}

          {/* a soft flag marks where the chick started this round (helps plan) */}
          <text
            x={cx(lvl.start.c)}
            y={cy(lvl.start.r) + TILE * 0.3}
            fontSize={TILE * 0.24}
            textAnchor="middle"
            dominantBaseline="central"
            opacity={0.45}
            aria-hidden="true"
          >
            🚩
          </text>

          {/* rocks / obstacles — these block the path, forcing a detour */}
          {lvl.rocks.map((k, i) => (
            <g
              key={`rock-${i}`}
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: bonking ? "jcsteps-wobble 0.5s ease-in-out" : undefined,
              }}
            >
              <rect
                x={PAD + k.c * TILE + 2}
                y={PAD + k.r * TILE + 2}
                width={TILE - 4}
                height={TILE - 4}
                rx={12}
                fill="rgba(120,140,170,0.16)"
                stroke="rgba(120,140,170,0.4)"
                strokeWidth={1.5}
              />
              <text
                x={cx(k.c)}
                y={cy(k.r) + 1}
                fontSize={TILE * 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                aria-label="rock — go around it"
              >
                🪨
              </text>
            </g>
          ))}

          {/* home / goal */}
          <circle
            cx={cx(lvl.goal.c)}
            cy={cy(lvl.goal.r)}
            r={TILE * 0.5}
            fill="url(#jc-glow)"
            opacity={celebrating ? 1 : 0.6}
            style={{
              transformOrigin: `${cx(lvl.goal.c)}px ${cy(lvl.goal.r)}px`,
              transformBox: "view-box",
              animation: celebrating
                ? "jcsteps-glow-burst 0.7s ease-out"
                : "jcsteps-glow-pulse 2.4s ease-in-out infinite",
            }}
          />
          <g
            style={{
              transformOrigin: `${cx(lvl.goal.c)}px ${cy(lvl.goal.r)}px`,
              transformBox: "fill-box",
              animation: celebrating
                ? "jcsteps-bounce-in 0.8s cubic-bezier(.34,1.56,.64,1) infinite"
                : "jcsteps-home-bob 2.8s ease-in-out infinite",
            }}
          >
            <text
              x={cx(lvl.goal.c)}
              y={cy(lvl.goal.r) + 1}
              fontSize={TILE * 0.56}
              textAnchor="middle"
              dominantBaseline="central"
              aria-label="home to reach"
            >
              🏠
            </text>
          </g>

          {/* the chick */}
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
                animation: bonking
                  ? "jcsteps-wobble 0.5s ease-in-out"
                  : running
                    ? "jcsteps-hop 0.46s ease-in-out infinite"
                    : celebrating
                      ? "jcsteps-dance 0.7s ease-in-out infinite"
                      : "jcsteps-breathe 2.6s ease-in-out infinite",
              }}
            >
              <circle
                r={TILE * 0.42}
                fill="#0b1220"
                stroke={ACCENT}
                strokeWidth={2}
                style={celebrating ? { filter: `drop-shadow(0 0 6px ${ACCENT})` } : undefined}
              />
              <text
                x={0}
                y={1}
                fontSize={TILE * 0.52}
                textAnchor="middle"
                dominantBaseline="central"
                aria-label="chick"
              >
                🐥
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* ── Plan strip: the arrows placed so far, in order ── */}
      <div
        className="flex min-h-[52px] w-full flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
        }}
        aria-label="Your planned path of arrows"
      >
        {steps.length === 0 ? (
          <span
            aria-hidden="true"
            className="text-2xl opacity-50"
            style={{ display: "inline-block", animation: "jcsteps-breathe 2.6s ease-in-out infinite" }}
          >
            🐥 …… 🏠
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
                animation: "jcsteps-snap-in 0.42s cubic-bezier(.34,1.56,.64,1) both",
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
              className={`jcsteps-springy grid h-[76px] place-items-center rounded-2xl text-4xl active:scale-90 disabled:opacity-40 ${cellClass}`}
              style={{
                touchAction: "none",
                background: "rgba(34,211,238,0.10)",
                border: `2px solid ${ACCENT}`,
                color: ACCENT,
                transition: "transform 0.26s cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              <span aria-hidden="true">{ARROW[dir]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Controls: Undo · GO · Reset ── */}
      <div className="flex w-full items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            undoStep();
          }}
          disabled={locked || steps.length === 0}
          aria-label="Remove the last arrow"
          className="jcsteps-springy grid h-[72px] w-[72px] place-items-center rounded-2xl text-3xl active:scale-90 disabled:opacity-30"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
            transition: "transform 0.26s cubic-bezier(.34,1.56,.64,1)",
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
          disabled={locked}
          aria-label="Go — make the chick hop the path"
          className="jcsteps-springy flex h-[72px] flex-1 items-center justify-center gap-2 rounded-2xl text-3xl font-bold active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#060810",
            boxShadow: `0 6px 0 0 #0e8aa0`,
            transition: "transform 0.26s cubic-bezier(.34,1.56,.64,1)",
            animation:
              steps.length > 0 && !locked
                ? "jcsteps-go-ready 1.3s ease-in-out infinite"
                : undefined,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              animation: running ? "jcsteps-hop 0.46s ease-in-out infinite" : undefined,
            }}
          >
            {running ? "🐾" : "▶"}
          </span>
          <span aria-hidden="true" className="text-2xl font-extrabold">
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
          aria-label="Start over from round one"
          className="jcsteps-springy grid h-[72px] w-[72px] place-items-center rounded-2xl text-3xl active:scale-90 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
            transition: "transform 0.26s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* celebratory floaters when all rounds solved */}
      {done && (
        <div className="pointer-events-none flex justify-center gap-2 text-3xl">
          <span style={{ animation: "jcsteps-float 1.4s ease-in-out infinite" }} aria-hidden="true">
            ✨
          </span>
          <span
            style={{ animation: "jcsteps-float 1.4s ease-in-out infinite 0.2s" }}
            aria-hidden="true"
          >
            🎉
          </span>
          <span
            style={{ animation: "jcsteps-float 1.4s ease-in-out infinite 0.4s" }}
            aria-hidden="true"
          >
            ✨
          </span>
        </div>
      )}

      <style>{`
        @keyframes jcsteps-wobble {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-13deg); }
          45% { transform: rotate(11deg); }
          70% { transform: rotate(-7deg); }
          90% { transform: rotate(4deg); }
        }
        /* Hopping with a little squash-and-stretch */
        @keyframes jcsteps-hop {
          0%   { transform: translateY(0) scaleY(0.92) scaleX(1.06); }
          30%  { transform: translateY(-7px) scaleY(1.1) scaleX(0.94); }
          55%  { transform: translateY(-7px) scaleY(1.08) scaleX(0.95); }
          80%  { transform: translateY(0) scaleY(0.9) scaleX(1.08); }
          100% { transform: translateY(0) scaleY(1) scaleX(1); }
        }
        @keyframes jcsteps-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.28); }
          100% { transform: scale(1); }
        }
        @keyframes jcsteps-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        /* Idle "breathing" — slow, never-static gentle bob + breath */
        @keyframes jcsteps-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.05); }
        }
        /* Home gently bobs while waiting */
        @keyframes jcsteps-home-bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-4px) rotate(2deg); }
        }
        /* Goal glow softly pulses while waiting / bursts on win */
        @keyframes jcsteps-glow-pulse {
          0%, 100% { transform: scale(0.92); opacity: 0.5; }
          50% { transform: scale(1.06); opacity: 0.78; }
        }
        @keyframes jcsteps-glow-burst {
          0% { transform: scale(0.6); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 1; }
          100% { transform: scale(1.1); opacity: 0.9; }
        }
        /* Winning chick does a happy squash-stretch dance */
        @keyframes jcsteps-dance {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateY(-8px) rotate(-9deg) scale(1.08, 0.95); }
          50% { transform: translateY(0) rotate(0deg) scale(0.96, 1.08); }
          75% { transform: translateY(-8px) rotate(9deg) scale(1.08, 0.95); }
        }
        /* Home does a celebratory bounce on win */
        @keyframes jcsteps-bounce-in {
          0%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-10px) scale(1.14, 0.9); }
          60% { transform: translateY(0) scale(0.94, 1.1); }
        }
        /* Status emoji cheers on win */
        @keyframes jcsteps-cheer {
          0% { transform: scale(0.5) rotate(-12deg); }
          60% { transform: scale(1.35) rotate(8deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        /* Each star pops in one at a time */
        @keyframes jcsteps-star-pop {
          0% { transform: scale(0) rotate(-40deg); opacity: 0; }
          70% { transform: scale(1.4) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        /* Placed plan arrows drop & spring into their slot */
        @keyframes jcsteps-snap-in {
          0% { transform: translateY(-14px) scale(0.4); opacity: 0; }
          60% { transform: translateY(2px) scale(1.18); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        /* GO button + current-round dot invite a tap when a plan is ready */
        @keyframes jcsteps-go-ready {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        /* Confetti flies outward from the win, then drifts down */
        @keyframes jcsteps-confetti {
          0% { transform: translate(0, 0) scale(0.4) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          60% { transform: translate(var(--jc-dx), var(--jc-dy)) scale(1.1) rotate(160deg); opacity: 1; }
          100% { transform: translate(calc(var(--jc-dx) * 1.1), calc(var(--jc-dy) + 90px)) scale(0.9) rotate(300deg); opacity: 0; }
        }
        /* Springy tap pop with toy-like overshoot */
        .jcsteps-springy:not(:disabled):active {
          transform: scale(0.9);
        }
        @media (prefers-reduced-motion: reduce) {
          /* Stop only the looping idle animations; keep brief celebratory pops. */
          [style*="jcsteps-breathe"],
          [style*="jcsteps-home-bob"],
          [style*="jcsteps-glow-pulse"],
          [style*="jcsteps-dance"],
          [style*="jcsteps-bounce-in"],
          [style*="jcsteps-hop"],
          [style*="jcsteps-float"],
          [style*="jcsteps-go-ready"],
          [style*="jcsteps-glow-burst"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
