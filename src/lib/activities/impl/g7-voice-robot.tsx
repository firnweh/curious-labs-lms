"use client";
// Learning goal: messy spoken phrases are RECOGNISED into clean tokens, then a
// command dictionary maps each token to a robot action — building the speech →
// text → command → motion pipeline behind every voice assistant.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#a855f7";
const GRID = 4;

/** Canonical command tokens the recogniser can ever resolve to. */
type Token = "forward" | "back" | "left" | "right" | "spin";

/** Heading the robot faces. 0=up, 1=right, 2=down, 3=left (clockwise). */
type Facing = 0 | 1 | 2 | 3;

interface Cell {
  col: number;
  row: number;
}

/** A spoken bubble: the messy phrase a learner taps, and the clean token it
 *  is RECOGNISED as. Teaches that fuzzy speech maps to one canonical word. */
interface Bubble {
  phrase: string;
  token: Token;
}

/** The five tappable mic bubbles — deliberately misspelled "speech". */
const BUBBLES: readonly Bubble[] = [
  { phrase: "go forwrd", token: "forward" },
  { phrase: "spin arnd", token: "spin" },
  { phrase: "turn rite", token: "right" },
  { phrase: "back up", token: "back" },
  { phrase: "turn lft", token: "left" },
] as const;

/** The visible command dictionary: token → serial byte the robot receives. */
const DICT: Record<Token, string> = {
  forward: "F",
  back: "B",
  left: "L",
  right: "R",
  spin: "S",
};

const TOKEN_LABEL: Record<Token, string> = {
  forward: "forward",
  back: "back",
  left: "left",
  right: "right",
  spin: "spin",
};

const START: Cell = { col: 0, row: 3 };
const START_FACING: Facing = 0; // up
const FLAG: Cell = { col: 2, row: 1 };

/** The one fixed L-shaped solution: up, up, turn right, right, right. */
const SOLUTION: readonly Token[] = ["forward", "forward", "right", "forward", "forward"];

/** Unit step vector for a facing (grid rows grow downward). */
function step(f: Facing): { dc: number; dr: number } {
  if (f === 0) return { dc: 0, dr: -1 };
  if (f === 1) return { dc: 1, dr: 0 };
  if (f === 2) return { dc: 0, dr: 1 };
  return { dc: -1, dr: 0 };
}

interface RobotState {
  cell: Cell;
  facing: Facing;
}

interface RunOutcome {
  state: RobotState;
  trail: Cell[];
  offGrid: boolean;
}

/** Deterministically execute a queue of tokens from the start pose. */
function simulate(queue: readonly Token[]): RunOutcome {
  let cell: Cell = { ...START };
  let facing: Facing = START_FACING;
  const trail: Cell[] = [{ ...cell }];
  for (const t of queue) {
    if (t === "left") {
      facing = (((facing - 1) % 4) + 4) % 4 as Facing;
    } else if (t === "right") {
      facing = ((facing + 1) % 4) as Facing;
    } else if (t === "spin") {
      // full 360° in place — no net change, pure flair
    } else {
      const dir = t === "forward" ? 1 : -1;
      const s = step(facing);
      const nc = cell.col + s.dc * dir;
      const nr = cell.row + s.dr * dir;
      if (nc < 0 || nc >= GRID || nr < 0 || nr >= GRID) {
        return { state: { cell, facing }, trail, offGrid: true };
      }
      cell = { col: nc, row: nr };
      trail.push({ ...cell });
    }
  }
  return { state: { cell, facing }, trail, offGrid: false };
}

const ROBOT_GLYPH: Record<Facing, string> = { 0: "⬆️", 1: "➡️", 2: "⬇️", 3: "⬅️" };

export default function VoiceRobot({ onComplete }: ActivityProps) {
  const [queue, setQueue] = useState<Token[]>([]);
  const [robot, setRobot] = useState<RobotState>({ cell: { ...START }, facing: START_FACING });
  const [trail, setTrail] = useState<Cell[]>([]);
  const [running, setRunning] = useState<boolean>(false);
  const [solved, setSolved] = useState<boolean>(false);
  const [toast, setToast] = useState<string>("");
  const [heard, setHeard] = useState<Token | null>(null);
  const firedRef = useRef<boolean>(false);

  const cellPx = 64;
  const boardPx = cellPx * GRID;

  // The next token the SOLUTION expects — drives the gentle hint highlight.
  const nextNeeded: Token | null = useMemo(() => {
    if (queue.length >= SOLUTION.length) return null;
    // only suggest if the queue so far is a correct prefix
    for (let i = 0; i < queue.length; i++) {
      if (queue[i] !== SOLUTION[i]) return null;
    }
    return SOLUTION[queue.length];
  }, [queue]);

  const status: string = solved
    ? "Robot reached the flag! ✨"
    : running
      ? "Running serial commands…"
      : toast || "Tap spoken commands, then press RUN.";

  const tapBubble = useCallback(
    (b: Bubble): void => {
      if (running || solved) return;
      if (queue.length >= 8) return;
      setHeard(b.token);
      setToast(`Recognised “${b.phrase}” → ${TOKEN_LABEL[b.token]}`);
      setQueue((q) => [...q, b.token]);
    },
    [running, solved, queue.length],
  );

  const clearQueue = useCallback((): void => {
    if (running) return;
    setQueue([]);
    setToast("");
    setHeard(null);
    setRobot({ cell: { ...START }, facing: START_FACING });
    setTrail([]);
  }, [running]);

  const reset = useCallback((): void => {
    setQueue([]);
    setRobot({ cell: { ...START }, facing: START_FACING });
    setTrail([]);
    setRunning(false);
    setSolved(false);
    setToast("");
    setHeard(null);
  }, []);

  const run = useCallback((): void => {
    if (running || solved || queue.length === 0) return;
    setRunning(true);
    setToast("");
    setRobot({ cell: { ...START }, facing: START_FACING });
    setTrail([{ ...START }]);

    // Step through the queue one beat at a time for readable motion.
    let cell: Cell = { ...START };
    let facing: Facing = START_FACING;
    let i = 0;
    let bumped = false;

    const tick = (): void => {
      if (i >= queue.length || bumped) {
        setRunning(false);
        const reached = cell.col === FLAG.col && cell.row === FLAG.row;
        if (reached) {
          setSolved(true);
          if (!firedRef.current) {
            firedRef.current = true;
            onComplete({
              passed: true,
              stars: 3,
              detail: "Speech → token → command → motion: robot reached the flag!",
            });
          }
        } else if (bumped) {
          // recoverable nudge — never scold
          onComplete({ passed: false, detail: "That command drove off the grid — clear the queue and try a shorter path." });
        } else {
          onComplete({ passed: false, detail: "Close! The robot stopped short of the flag — add or swap a command." });
        }
        return;
      }
      const t = queue[i];
      i += 1;
      if (t === "left") {
        facing = (((facing - 1) % 4) + 4) % 4 as Facing;
        setRobot({ cell: { ...cell }, facing });
      } else if (t === "right") {
        facing = ((facing + 1) % 4) as Facing;
        setRobot({ cell: { ...cell }, facing });
      } else if (t === "spin") {
        setRobot({ cell: { ...cell }, facing });
      } else {
        const dir = t === "forward" ? 1 : -1;
        const s = step(facing);
        const nc = cell.col + s.dc * dir;
        const nr = cell.row + s.dr * dir;
        if (nc < 0 || nc >= GRID || nr < 0 || nr >= GRID) {
          bumped = true;
          setToast("⚠️ unknown move — robot bumped the wall!");
          setRobot({ cell: { ...cell }, facing });
          window.setTimeout(tick, 360);
          return;
        }
        cell = { col: nc, row: nr };
        setRobot({ cell: { ...cell }, facing });
        setTrail((tr) => [...tr, { ...cell }]);
      }
      window.setTimeout(tick, 360);
    };

    window.setTimeout(tick, 200);
  }, [running, solved, queue, onComplete]);

  const trailSet = useMemo(
    () => new Set(trail.map((c) => `${c.col},${c.row}`)),
    [trail],
  );

  const robotPreview = useMemo(() => simulate(queue), [queue]);

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g7voicerobot-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.12);opacity:.7} }
        @keyframes g7voicerobot-byte { 0%{transform:translateY(-6px);opacity:0} 30%{opacity:1} 100%{transform:translateY(18px);opacity:0} }
        @keyframes g7voicerobot-pop { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes g7voicerobot-win { 0%{transform:scale(.7);opacity:0} 100%{transform:scale(1);opacity:1} }
      `}</style>

      {/* Header */}
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: ACCENT }}>
          🎙️ Voice-Controlled Robot
        </p>
        <p className="text-[11px] leading-tight text-ink-faint">
          Speech → text token → dictionary byte → robot motion.
        </p>
      </div>

      {/* Arena */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={solved ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` } : undefined}
      >
        <svg
          viewBox={`0 0 ${boardPx} ${boardPx}`}
          className="mx-auto block w-full max-w-[256px]"
          role="img"
          aria-label={`A ${GRID} by ${GRID} grid. Robot facing ${["up", "right", "down", "left"][robot.facing]} at column ${robot.cell.col + 1}, row ${robot.cell.row + 1}. Flag at column ${FLAG.col + 1}, row ${FLAG.row + 1}.`}
        >
          {Array.from({ length: GRID }).map((_, r) =>
            Array.from({ length: GRID }).map((__, c) => {
              const onTrail = trailSet.has(`${c},${r}`);
              const isFlag = c === FLAG.col && r === FLAG.row;
              return (
                <rect
                  key={`${c}-${r}`}
                  x={c * cellPx + 2}
                  y={r * cellPx + 2}
                  width={cellPx - 4}
                  height={cellPx - 4}
                  rx={8}
                  fill={onTrail ? "rgba(34,197,94,0.22)" : "rgba(168,85,247,0.06)"}
                  stroke={isFlag ? ACCENT : "rgba(168,85,247,0.18)"}
                  strokeWidth={isFlag ? 2 : 1}
                />
              );
            }),
          )}
          {/* flag */}
          <text
            x={FLAG.col * cellPx + cellPx / 2}
            y={FLAG.row * cellPx + cellPx / 2 + 9}
            textAnchor="middle"
            fontSize={26}
          >
            🚩
          </text>
          {/* robot */}
          <text
            x={robot.cell.col * cellPx + cellPx / 2}
            y={robot.cell.row * cellPx + cellPx / 2 + 10}
            textAnchor="middle"
            fontSize={30}
            style={{ transition: "x 0.25s, y 0.25s" }}
          >
            {ROBOT_GLYPH[robot.facing]}
          </text>
        </svg>

        <div
          className="mt-2 rounded-md px-2 py-1 text-center text-xs"
          role="status"
          aria-live="polite"
          style={{
            color: solved ? "#05070d" : "#cbd3ef",
            background: solved ? ACCENT : "transparent",
          }}
        >
          {status}
        </div>
      </div>

      {/* Mic bubbles */}
      <div className="panel rounded-xl p-3">
        <p className="mb-2 text-[11px] text-ink-faint">
          🎤 Spoken commands — tap to “speak”. The recogniser cleans each phrase
          into one token.
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Spoken command bubbles">
          {BUBBLES.map((b) => {
            const isNext = nextNeeded === b.token && !solved;
            return (
              <button
                key={b.phrase}
                type="button"
                onPointerDown={() => tapBubble(b)}
                disabled={running || solved}
                aria-label={`Speak "${b.phrase}", recognised as ${TOKEN_LABEL[b.token]}`}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
                style={{
                  touchAction: "manipulation",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: isNext ? ACCENT : "rgba(168,85,247,0.3)",
                  background: isNext ? "rgba(168,85,247,0.22)" : "rgba(11,16,32,0.6)",
                  color: "#e6e8f5",
                  animation: isNext ? "g7voicerobot-pulse 1.4s ease-in-out infinite" : undefined,
                }}
              >
                “{b.phrase}”
              </button>
            );
          })}
        </div>
        {heard && (
          <p className="mt-2 text-[11px]" style={{ color: ACCENT }}>
            recogniser → <span className="font-semibold">{TOKEN_LABEL[heard]}</span> →
            byte <span className="font-semibold">{DICT[heard]}</span>
          </p>
        )}
      </div>

      {/* Dictionary */}
      <div className="panel rounded-xl p-3">
        <p className="mb-2 text-[11px] text-ink-faint">📖 Command dictionary (token → serial byte)</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(DICT) as Token[]).map((t) => (
            <span
              key={t}
              className="rounded-md px-2 py-1 text-[11px]"
              style={{ background: "rgba(168,85,247,0.1)", color: "#cbd3ef" }}
            >
              {TOKEN_LABEL[t]} → <b style={{ color: ACCENT }}>{DICT[t]}</b>
            </span>
          ))}
        </div>
      </div>

      {/* Queue / serial cable */}
      <div className="panel rounded-xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] text-ink-faint">🧵 Serial queue → robot</p>
          <p className="text-[11px] text-ink-faint">
            {robotPreview.offGrid ? "⚠️ off-grid" : `${queue.length} cmd`}
          </p>
        </div>
        <div className="flex min-h-[34px] flex-wrap items-center gap-1.5">
          {queue.length === 0 && (
            <span className="text-[11px] text-ink-faint">empty — tap a bubble above</span>
          )}
          {queue.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="grid h-7 w-7 place-items-center rounded-md text-sm font-bold"
              style={{
                background: ACCENT,
                color: "#05070d",
                animation: "g7voicerobot-pop 0.3s ease",
              }}
              title={TOKEN_LABEL[t]}
            >
              {DICT[t]}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={run}
          disabled={running || solved || queue.length === 0}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d", touchAction: "manipulation" }}
          aria-label="Run the queued commands"
        >
          {running ? "Running…" : solved ? "Solved!" : "▶ RUN"}
        </button>
        <button
          type="button"
          onPointerDown={clearQueue}
          disabled={running}
          className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim disabled:opacity-50"
          style={{ touchAction: "manipulation" }}
          aria-label="Clear the command queue"
        >
          Clear
        </button>
        <button
          type="button"
          onPointerDown={reset}
          disabled={running}
          className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim disabled:opacity-50"
          style={{ touchAction: "manipulation" }}
          aria-label="Reset the whole lab"
        >
          Reset
        </button>
      </div>

      {solved && (
        <div
          className="rounded-xl p-3 text-center"
          style={{
            background: "rgba(168,85,247,0.12)",
            border: `1px solid ${ACCENT}`,
            animation: "g7voicerobot-win 0.4s ease",
          }}
        >
          <p className="text-lg">✨🎉 ⭐⭐⭐</p>
          <p className="text-xs text-ink-dim">
            You wired the whole speech pipeline — messy words became clean tokens,
            tokens became bytes, and the robot drove the L-path to the flag.
          </p>
        </div>
      )}
    </div>
  );
}
