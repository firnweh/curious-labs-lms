"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Maze Move Maker 🧭 ───────────────────────────────────────────────────────
   JUNIOR (Grade 3, age ~8) CODING lab. Single learning goal: an ALGORITHM is an
   exact, ordered list of instructions — sequencing Forward / Turn commands in
   the right order steers a robot 🤖 through a maze to the flag 🏁.
   A 5×5 SVG maze (clear walls 🧱) holds the robot at START and a flag at GOAL,
   with exactly ONE simple correct path. The child taps three big arrow chips —
   Forward ⬆️, Turn Left ↪️, Turn Right ↩️ — to append commands into a visible
   program strip (tap a chip in the strip to remove it: full, free undo). PLAY ▶
   runs the algorithm one step per command, lighting each chip as it executes so
   the learner watches the algorithm "run". Bump a wall / drive off the edge →
   soft bonk 🙈, the failing chip pulses to show WHICH step went wrong, then the
   robot returns to START to debug & edit — the write / run / fix loop. Reach the
   flag → 🎉 confetti + onComplete({passed:true,stars:3}) ONCE. Never scolds;
   always recoverable; always winnable. Big arrow tiles, no reading needed.

   The one intended algorithm (7 steps):
   Forward, Forward, Turn Right, Forward, Forward, Turn Left, Forward, Forward.
   (Up to (0,2), right to (2,2), up to (2,0)=GOAL.) */

const ACCENT = "#22d3ee";
const COLS = 5;
const ROWS = 5;
const STEP_MS = 600;
const MAX_STEPS = 18;

/** Heading the robot faces. 0=Up 1=Right 2=Down 3=Left. Row 0 = top. */
type Heading = 0 | 1 | 2 | 3;
const HX: readonly number[] = [0, 1, 0, -1];
const HY: readonly number[] = [-1, 0, 1, 0];
/** Emoji the robot points, per heading, so the facing is readable visually. */
const FACE: Record<Heading, string> = { 0: "⬆️", 1: "➡️", 2: "⬇️", 3: "⬅️" };

/** The three command kinds. */
type Cmd = "fwd" | "left" | "right";
const CMD_GLYPH: Record<Cmd, string> = { fwd: "⬆️", left: "↪️", right: "↩️" };
const CMD_WORD: Record<Cmd, string> = {
  fwd: "go forward",
  left: "turn left",
  right: "turn right",
};
const TRAY: readonly Cmd[] = ["fwd", "left", "right"];

interface Cell {
  c: number;
  r: number;
}

// ── Fixed, friendly level ────────────────────────────────────────────────────
// Robot starts bottom-left facing Up. Intended trail:
// (0,4)→(0,2) up, →(2,2) right, →(2,0) up = GOAL. Walls fence off wrong turns.
const START: Cell = { c: 0, r: 4 };
const START_HEADING: Heading = 0; // facing Up
const GOAL: Cell = { c: 2, r: 0 };
const WALLS: readonly Cell[] = [
  { c: 1, r: 4 },
  { c: 1, r: 3 },
  { c: 1, r: 1 },
  { c: 0, r: 1 },
  { c: 0, r: 0 },
  { c: 3, r: 2 },
  { c: 3, r: 1 },
];

const isWall = (c: number, r: number): boolean =>
  WALLS.some((w) => w.c === c && w.r === r);

// ── Simulation ───────────────────────────────────────────────────────────────
/** A frame of the run: where the robot is, which way it faces, and the chip
 *  index that produced this frame (-1 = the starting frame). */
interface Frame {
  cell: Cell;
  heading: Heading;
  cmdIndex: number;
}

type Outcome =
  | { type: "win" }
  | { type: "wall"; cmdIndex: number }
  | { type: "edge"; cmdIndex: number }
  | { type: "short" }; // ran out of commands before the flag (no harm)

interface SimResult {
  frames: Frame[];
  outcome: Outcome;
}

/** Deterministically run the command list from the fixed start state. */
function simulate(cmds: Cmd[]): SimResult {
  let { c, r } = START;
  let h: Heading = START_HEADING;
  const frames: Frame[] = [{ cell: { c, r }, heading: h, cmdIndex: -1 }];
  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i];
    if (cmd === "left") {
      h = ((h + 3) % 4) as Heading;
      frames.push({ cell: { c, r }, heading: h, cmdIndex: i });
      continue;
    }
    if (cmd === "right") {
      h = ((h + 1) % 4) as Heading;
      frames.push({ cell: { c, r }, heading: h, cmdIndex: i });
      continue;
    }
    // forward
    const nc = c + HX[h];
    const nr = r + HY[h];
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) {
      return { frames, outcome: { type: "edge", cmdIndex: i } };
    }
    if (isWall(nc, nr)) {
      return { frames, outcome: { type: "wall", cmdIndex: i } };
    }
    c = nc;
    r = nr;
    frames.push({ cell: { c, r }, heading: h, cmdIndex: i });
    if (c === GOAL.c && r === GOAL.r) return { frames, outcome: { type: "win" } };
  }
  return { frames, outcome: { type: "short" } };
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
  cmd: Cmd;
}
let UID = 1;
const nextId = (): number => UID++;

export default function MazeMoveMaker({ onComplete }: ActivityProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pos, setPos] = useState<Cell>(START);
  const [heading, setHeading] = useState<Heading>(START_HEADING);
  const [activeChip, setActiveChip] = useState<number>(-1); // chip lit while running
  const [badChip, setBadChip] = useState<number>(-1); // chip that bonked
  const [litTrail, setLitTrail] = useState<Cell[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

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

  const resetRobot = useCallback(() => {
    setPos(START);
    setHeading(START_HEADING);
    setActiveChip(-1);
    setBadChip(-1);
    setLitTrail([{ c: START.c, r: START.r }]);
  }, []);

  const addStep = useCallback(
    (cmd: Cmd) => {
      if (running || won) return;
      setSteps((s) => (s.length >= MAX_STEPS ? s : [...s, { id: nextId(), cmd }]));
      setPhase("idle");
      resetRobot();
    },
    [running, won, resetRobot],
  );

  const removeStep = useCallback(
    (id: number) => {
      if (running || won) return;
      setSteps((s) => s.filter((step) => step.id !== id));
      setPhase("idle");
      resetRobot();
    },
    [running, won, resetRobot],
  );

  const reset = useCallback(() => {
    clearTimer();
    reportedRef.current = false;
    setSteps([]);
    setPhase("idle");
    resetRobot();
  }, [clearTimer, resetRobot]);

  const play = useCallback(() => {
    if (running || won) return;
    if (steps.length === 0) {
      setPhase("bonk");
      timerRef.current = setTimeout(() => setPhase("idle"), 520);
      return;
    }

    const sim = simulate(steps.map((s) => s.cmd));
    clearTimer();
    setBadChip(-1);
    setPhase("running");

    let i = 0; // index into frames (0 = start frame, already shown)
    const tick = (): void => {
      i += 1;
      if (i >= sim.frames.length) {
        const out = sim.outcome;
        if (out.type === "win") {
          setActiveChip(steps.length - 1);
          setPhase("won");
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({
              passed: true,
              stars: 3,
              detail: "You reached the goal! 🏁",
            });
          }
        } else if (out.type === "wall" || out.type === "edge") {
          // Soft bonk: show WHICH step went wrong, then return to START to debug.
          setActiveChip(out.cmdIndex);
          setBadChip(out.cmdIndex);
          setPhase("bonk");
          onComplete({
            passed: false,
            detail:
              out.type === "wall"
                ? "Bonk! That step hit a wall — fix it and try again."
                : "Oops — that step drove off the maze. Tweak it and replay!",
          });
          timerRef.current = setTimeout(() => {
            resetRobot();
            setPhase("idle");
          }, 1100);
        } else {
          // Ran out of steps short of the flag — gentle nudge, no fail.
          setPhase("bonk");
          onComplete({
            passed: false,
            detail: "Almost! Add a few more steps to reach the flag.",
          });
          timerRef.current = setTimeout(() => {
            resetRobot();
            setPhase("idle");
          }, 1000);
        }
        return;
      }
      const f = sim.frames[i];
      setPos(f.cell);
      setHeading(f.heading);
      setActiveChip(f.cmdIndex);
      setLitTrail((prev) =>
        prev.some((t) => t.c === f.cell.c && t.r === f.cell.r)
          ? prev
          : [...prev, { c: f.cell.c, r: f.cell.r }],
      );
      timerRef.current = setTimeout(tick, STEP_MS);
    };

    // Reset to the start frame, then begin stepping.
    setPos(START);
    setHeading(START_HEADING);
    setActiveChip(-1);
    setLitTrail([{ c: START.c, r: START.r }]);
    timerRef.current = setTimeout(tick, STEP_MS);
  }, [running, won, steps, clearTimer, resetRobot, onComplete]);

  const statusEmoji = useMemo<string>(() => {
    if (won) return "🎉";
    if (bonking) return "🙈";
    if (running) return "⚙️";
    return "🤖";
  }, [won, bonking, running]);

  const statusLabel = won
    ? "You reached the flag!"
    : running
      ? "The robot is running your algorithm"
      : bonking
        ? "Bonk — fix the highlighted step and try again"
        : "Build the steps, then press Play";

  return (
    <div className="flex w-full max-w-[440px] flex-col items-center gap-3 font-mono text-ink">
      {/* ── Visual status (emoji, not paragraphs) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
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
            🤖→🏁
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The maze grid ── */}
      <div className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A 5 by 5 maze with a robot and a flag to reach"
        >
          <defs>
            <radialGradient id="mmm-glow" cx="50%" cy="50%" r="50%">
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
            const isStart = c === START.c && r === START.r;
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
                      : isStart
                        ? "rgba(34,211,238,0.08)"
                        : "rgba(255,255,255,0.05)"
                }
                stroke={
                  wall ? "#3a4866" : lit ? ACCENT : "rgba(120,140,170,0.22)"
                }
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

          {/* flag / goal */}
          <circle
            cx={cx(GOAL.c)}
            cy={cy(GOAL.r)}
            r={TILE * 0.5}
            fill="url(#mmm-glow)"
            opacity={won ? 1 : 0.6}
          />
          <g
            style={{
              transformOrigin: `${cx(GOAL.c)}px ${cy(GOAL.r)}px`,
              transformBox: "fill-box",
              animation: won ? "g3mazealgorithmpath-pop 0.7s ease-out" : undefined,
            }}
          >
            <text
              x={cx(GOAL.c)}
              y={cy(GOAL.r) + 1}
              fontSize={TILE * 0.56}
              textAnchor="middle"
              dominantBaseline="central"
              aria-label="flag to reach"
            >
              🏁
            </text>
          </g>

          {/* the robot */}
          <g
            style={{
              transform: `translate(${cx(pos.c)}px, ${cy(pos.r)}px)`,
              transition: running
                ? `transform ${STEP_MS}ms ease-in-out`
                : "transform 160ms ease-out",
            }}
          >
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: bonking
                  ? "g3mazealgorithmpath-wobble 0.5s ease-in-out"
                  : running
                    ? "g3mazealgorithmpath-hum 0.6s ease-in-out infinite"
                    : won
                      ? "g3mazealgorithmpath-pop 0.6s ease-out"
                      : undefined,
              }}
            >
              <circle
                r={TILE * 0.42}
                fill="#0b1220"
                stroke={ACCENT}
                strokeWidth={2}
                style={
                  won ? { filter: `drop-shadow(0 0 6px ${ACCENT})` } : undefined
                }
              />
              <text
                x={0}
                y={1}
                fontSize={TILE * 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                aria-label="robot"
              >
                🤖
              </text>
              {/* a small facing indicator so the heading is readable */}
              <text
                x={0}
                y={-TILE * 0.34}
                fontSize={TILE * 0.26}
                textAnchor="middle"
                dominantBaseline="central"
                aria-hidden="true"
                style={{
                  transition: running ? "all 200ms ease" : undefined,
                }}
              >
                {FACE[heading]}
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* ── Program strip: the algorithm so far (tap a chip to remove it) ── */}
      <div
        className="flex min-h-[52px] w-full flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
        }}
        aria-label="Your algorithm — the list of steps in order"
      >
        {steps.length === 0 ? (
          <span aria-hidden="true" className="text-2xl opacity-50">
            🤖 …… 🏁
          </span>
        ) : (
          steps.map((s, i) => {
            const active = i === activeChip;
            const bad = i === badChip;
            return (
              <button
                key={s.id}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  removeStep(s.id);
                }}
                disabled={running || won}
                aria-label={`Step ${i + 1}: ${CMD_WORD[s.cmd]}. Tap to remove.`}
                className="grid h-9 w-9 place-items-center rounded-lg text-xl transition active:scale-90 disabled:opacity-70"
                style={{
                  touchAction: "none",
                  background: active
                    ? "rgba(34,211,238,0.30)"
                    : "rgba(34,211,238,0.12)",
                  border: `1.5px solid ${bad ? "#f87171" : ACCENT}`,
                  boxShadow: active ? `0 0 10px ${ACCENT}` : undefined,
                  animation: bad
                    ? "g3mazealgorithmpath-pulse 0.6s ease-in-out infinite"
                    : undefined,
                }}
              >
                <span aria-hidden="true">{CMD_GLYPH[s.cmd]}</span>
              </button>
            );
          })
        )}
      </div>

      {/* ── The three big command chips ── */}
      <div className="grid w-full grid-cols-3 gap-2">
        {TRAY.map((cmd) => (
          <button
            key={cmd}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              addStep(cmd);
            }}
            disabled={running || won}
            aria-label={`Add a ${CMD_WORD[cmd]} step`}
            className="flex h-[68px] flex-col items-center justify-center gap-0.5 rounded-2xl text-3xl transition active:scale-90 disabled:opacity-40"
            style={{
              touchAction: "none",
              background: "rgba(34,211,238,0.10)",
              border: `2px solid ${ACCENT}`,
              color: ACCENT,
            }}
          >
            <span aria-hidden="true">{CMD_GLYPH[cmd]}</span>
            <span aria-hidden="true" className="text-[10px] font-bold tracking-wide">
              {cmd === "fwd" ? "GO" : cmd === "left" ? "LEFT" : "RIGHT"}
            </span>
          </button>
        ))}
      </div>

      {/* ── Controls: PLAY · Reset ── */}
      <div className="flex w-full items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            play();
          }}
          disabled={running || won}
          aria-label="Play — run your algorithm"
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#060810",
            boxShadow: "0 6px 0 0 #0e8aa0",
          }}
        >
          <span aria-hidden="true">{running ? "⚙️" : "▶"}</span>
          <span aria-hidden="true" className="text-xl font-extrabold">
            PLAY
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

      {/* celebratory floaters when solved */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span className="animate-float" aria-hidden="true">
            ✨
          </span>
          <span
            className="animate-float"
            style={{ animationDelay: "0.2s" }}
            aria-hidden="true"
          >
            🎉
          </span>
          <span
            className="animate-float"
            style={{ animationDelay: "0.4s" }}
            aria-hidden="true"
          >
            ✨
          </span>
        </div>
      )}

      <style>{`
        @keyframes g3mazealgorithmpath-wobble {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-13deg); }
          45% { transform: rotate(11deg); }
          70% { transform: rotate(-7deg); }
          90% { transform: rotate(4deg); }
        }
        @keyframes g3mazealgorithmpath-hum {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.05); }
        }
        @keyframes g3mazealgorithmpath-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.28); }
          100% { transform: scale(1); }
        }
        @keyframes g3mazealgorithmpath-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(248,113,113,0.0); }
          50% { transform: scale(1.12); box-shadow: 0 0 12px 2px rgba(248,113,113,0.8); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
