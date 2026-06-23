"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Obstacle Avoider — decision trees + sensors (Grade 4-6)           */
/*                                                                    */
/*  Learning goal: a robot decides for itself by walking a tiny       */
/*  IF / ELSE decision tree of sensor readings. The learner snaps an  */
/*  ACTION block into the YES (path blocked) branch and the NO (path  */
/*  clear) branch of an ultrasonic distance check, presses RUN, and   */
/*  watches the matching branch fire step by step as the robot weaves */
/*  to the flag.                                                      */
/*                                                                    */
/*  Why it's a real problem, not a one-tap guess:                     */
/*  • THREE escalating arenas, each needing a DIFFERENT brain — so    */
/*    you can't memorise one answer.                                  */
/*      R1: the boxes step out to the RIGHT  → "STOP, turn RIGHT".    */
/*      R2: the MIRROR maze. Now the same right-turn brain wanders    */
/*          off — you must read the walls and switch to turn LEFT.    */
/*      R3: a long serpentine that needs the turn-RIGHT brain again,  */
/*          but the path is long enough that you must trace it, not   */
/*          pattern-match round 1.                                    */
/*  • Three real action blocks (forward / turn-right / turn-left) in  */
/*    each branch = 9 combinations; only one tree per arena reaches   */
/*    the flag inside the step budget. Wrong hand → it meanders into  */
/*    a wall, a friendly THUNK, fix-and-retry (never scolded).        */
/*  • OPTIMIZE: finish all three with NO collisions for ⭐⭐⭐.        */
/*    A messy win (some bumps along the way) still passes at ⭐⭐.     */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const GRID = 6; // 6 x 6 top-down arena
const CELL = 52; // px per cell
const VIEW = GRID * CELL;

type Dir = "up" | "right" | "down" | "left";
type BlockId = "forward" | "right" | "left";
type SlotId = "yes" | "no";
type Phase = "build" | "running" | "round-won" | "won" | "bump";

interface Cell {
  c: number;
  r: number;
}

/** Action blocks the learner can drop into a branch slot. */
interface Block {
  id: BlockId;
  label: string;
  glyph: string;
}

const BLOCKS: readonly Block[] = [
  { id: "forward", label: "GO FORWARD", glyph: "⬆️" },
  { id: "right", label: "STOP → TURN RIGHT", glyph: "🛑↻" },
  { id: "left", label: "STOP → TURN LEFT", glyph: "🛑↺" },
] as const;

const blockById = (id: BlockId): Block =>
  BLOCKS.find((b) => b.id === id) as Block;

interface Level {
  start: Cell;
  startDir: Dir;
  goal: Cell;
  boxes: readonly Cell[];
  /** The one brain that reaches the flag inside the budget. */
  answer: Record<SlotId, BlockId>;
  /** Hand-authored tight budget: rejects the meandering wrong-hand tree. */
  budget: number;
  /** Tiny hint shown above the arena for this round. */
  hint: string;
}

/* Three fixed, hand-authored, escalating arenas. Every solution below was
   verified by simulating all 9 YES/NO block pairings: in each arena exactly
   ONE pairing reaches the flag within `budget`, and the tempting opposite-hand
   tree times out. (See the comb / mirror / serpentine note per level.) */
const LEVELS: readonly Level[] = [
  // R1 — boxes step out to the RIGHT. Right-hand wall-follow hugs them to the
  //      flag in 10 decisions. answer: blocked→turn-right, clear→forward.
  {
    start: { c: 0, r: 4 },
    startDir: "up",
    goal: { c: 5, r: 0 },
    boxes: [
      { c: 2, r: 4 },
      { c: 2, r: 3 },
      { c: 2, r: 2 },
      { c: 4, r: 1 },
      { c: 4, r: 2 },
      { c: 4, r: 3 },
    ],
    answer: { yes: "right", no: "forward" },
    budget: 16,
    hint: "The boxes lean RIGHT — which way should it turn when blocked?",
  },
  // R2 — the MIRROR of R1. The right-turn brain from R1 now wanders off; you
  //      must read the flipped walls and switch to turn-LEFT. Clean in 10.
  {
    start: { c: 0, r: 1 },
    startDir: "down",
    goal: { c: 5, r: 5 },
    boxes: [
      { c: 2, r: 1 },
      { c: 2, r: 2 },
      { c: 2, r: 3 },
      { c: 4, r: 4 },
      { c: 4, r: 3 },
      { c: 4, r: 2 },
    ],
    answer: { yes: "left", no: "forward" },
    budget: 16,
    hint: "It's the MIRROR maze. The old brain wanders — flip the turn!",
  },
  // R3 — long serpentine: up the left edge, across the top, down the right edge.
  //      Needs the turn-RIGHT brain again, but the 17-step path must be traced,
  //      not pattern-matched from R1.
  {
    start: { c: 0, r: 5 },
    startDir: "up",
    goal: { c: 5, r: 5 },
    boxes: [
      { c: 1, r: 5 },
      { c: 1, r: 4 },
      { c: 1, r: 3 },
      { c: 1, r: 2 },
      { c: 1, r: 1 },
      { c: 3, r: 5 },
      { c: 3, r: 4 },
      { c: 3, r: 3 },
      { c: 3, r: 2 },
      { c: 3, r: 1 },
    ],
    answer: { yes: "right", no: "forward" },
    budget: 24,
    hint: "Long winding hall. Trace it to the flag — which hand hugs the wall?",
  },
] as const;

const DELTA: Record<Dir, Cell> = {
  up: { c: 0, r: -1 },
  right: { c: 1, r: 0 },
  down: { c: 0, r: 1 },
  left: { c: -1, r: 0 },
};

const RIGHT_OF: Record<Dir, Dir> = {
  up: "right",
  right: "down",
  down: "left",
  left: "up",
};

const LEFT_OF: Record<Dir, Dir> = {
  up: "left",
  left: "down",
  down: "right",
  right: "up",
};

function isBoxIn(boxes: readonly Cell[], c: number, r: number): boolean {
  return boxes.some((b) => b.c === c && b.r === r);
}

function blockedIn(
  boxes: readonly Cell[],
  cell: Cell,
  dir: Dir,
): boolean {
  const d = DELTA[dir];
  const nc = cell.c + d.c;
  const nr = cell.r + d.r;
  if (nc < 0 || nc >= GRID || nr < 0 || nr >= GRID) return true; // wall = blocked
  return isBoxIn(boxes, nc, nr);
}

interface RobotState {
  cell: Cell;
  dir: Dir;
}

interface LogLine {
  step: number;
  branch: "YES" | "NO";
  text: string;
}

type Outcome = "win" | "crash" | "timeout";

interface SimStep {
  state: RobotState;
  line: LogLine;
  branch: SlotId;
}

interface SimResult {
  steps: SimStep[];
  outcome: Outcome;
}

/** Deterministically drive the tree on a level; record every decision. */
function simulate(
  level: Level,
  yesBlock: BlockId,
  noBlock: BlockId,
): SimResult {
  let state: RobotState = { cell: level.start, dir: level.startDir };
  const steps: SimStep[] = [];

  for (let step = 1; step <= level.budget; step++) {
    const ahead = blockedIn(level.boxes, state.cell, state.dir);
    const branch: SlotId = ahead ? "yes" : "no";
    const chosen = ahead ? yesBlock : noBlock;
    const distText = ahead ? "< 20cm" : "≥ 20cm";

    if (chosen === "right") {
      state = { cell: state.cell, dir: RIGHT_OF[state.dir] };
      steps.push({
        state,
        branch,
        line: { step, branch: ahead ? "YES" : "NO", text: `dist ${distText} → STOP, turn right` },
      });
    } else if (chosen === "left") {
      state = { cell: state.cell, dir: LEFT_OF[state.dir] };
      steps.push({
        state,
        branch,
        line: { step, branch: ahead ? "YES" : "NO", text: `dist ${distText} → STOP, turn left` },
      });
    } else {
      // forward
      if (ahead) {
        steps.push({
          state,
          branch,
          line: { step, branch: "YES", text: `dist < 20cm → GO FORWARD … 💥 thunk!` },
        });
        return { steps, outcome: "crash" };
      }
      const d = DELTA[state.dir];
      const nc = state.cell.c + d.c;
      const nr = state.cell.r + d.r;
      state = { cell: { c: nc, r: nr }, dir: state.dir };
      steps.push({
        state,
        branch,
        line: { step, branch: "NO", text: `dist ≥ 20cm → forward to (${nc + 1},${nr + 1})` },
      });
    }

    if (state.cell.c === level.goal.c && state.cell.r === level.goal.r) {
      return { steps, outcome: "win" };
    }
  }
  return { steps, outcome: "timeout" };
}

export default function ObstacleAvoider({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [slots, setSlots] = useState<Record<SlotId, BlockId | null>>({
    yes: null,
    no: null,
  });
  const [held, setHeld] = useState<BlockId | null>(null);
  const [robot, setRobot] = useState<RobotState>({
    cell: LEVELS[0].start,
    dir: LEVELS[0].startDir,
  });
  const [phase, setPhase] = useState<Phase>("build");
  const [log, setLog] = useState<LogLine[]>([]);
  const [activeBranch, setActiveBranch] = useState<SlotId | null>(null);
  const [collisions, setCollisions] = useState<number>(0);
  const [path, setPath] = useState<Cell[]>([LEVELS[0].start]);

  const reportedRef = useRef<boolean>(false);
  const timersRef = useRef<number[]>([]);

  const level = LEVELS[round];
  const isFinalRound = round >= LEVELS.length - 1;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const placedIds = useMemo<BlockId[]>(
    () => [slots.yes, slots.no].filter((b): b is BlockId => b !== null),
    [slots],
  );

  const bothFilled = slots.yes !== null && slots.no !== null;

  /** Park the robot at this round's start with a clean tree & trail. */
  const setupRound = useCallback((idx: number) => {
    clearTimers();
    const lvl = LEVELS[idx];
    setSlots({ yes: null, no: null });
    setHeld(null);
    setRobot({ cell: lvl.start, dir: lvl.startDir });
    setPath([lvl.start]);
    setLog([]);
    setActiveBranch(null);
    setPhase("build");
  }, [clearTimers]);

  /** Place the held block into a slot (one block can live in one slot). */
  const placeInSlot = useCallback(
    (slot: SlotId) => {
      if (phase === "running" || held === null) return;
      setSlots((prev) => {
        const next: Record<SlotId, BlockId | null> = {
          yes: prev.yes === held ? null : prev.yes,
          no: prev.no === held ? null : prev.no,
        };
        next[slot] = held;
        return next;
      });
      setHeld(null);
      setActiveBranch(null);
    },
    [held, phase],
  );

  const clearSlot = useCallback(
    (slot: SlotId) => {
      if (phase === "running") return;
      setSlots((prev) => ({ ...prev, [slot]: null }));
    },
    [phase],
  );

  const pickBlock = useCallback(
    (id: BlockId) => {
      if (phase === "running") return;
      setHeld((cur) => (cur === id ? null : id));
    },
    [phase],
  );

  /** Send the robot home for THIS round (keep the tree so they can tweak). */
  const resetRobot = useCallback(() => {
    clearTimers();
    setRobot({ cell: level.start, dir: level.startDir });
    setPath([level.start]);
    setLog([]);
    setActiveBranch(null);
    setPhase("build");
  }, [clearTimers, level]);

  /** Restart the whole lab from round one. */
  const fullReset = useCallback(() => {
    reportedRef.current = false;
    setCollisions(0);
    setRound(0);
    setupRound(0);
  }, [setupRound]);

  /** Drive the current course one decision at a time, animated. */
  const run = useCallback(() => {
    if (!bothFilled || phase === "running") return;
    clearTimers();
    setLog([]);
    setPath([level.start]);
    setRobot({ cell: level.start, dir: level.startDir });
    setPhase("running");

    const yesBlock = slots.yes as BlockId;
    const noBlock = slots.no as BlockId;
    const sim = simulate(level, yesBlock, noBlock);

    sim.steps.forEach((s, i) => {
      const t = window.setTimeout(() => {
        setRobot(s.state);
        setActiveBranch(s.branch);
        setLog((prev) => [...prev, s.line]);
        setPath((prev) =>
          prev.some((p) => p.c === s.state.cell.c && p.r === s.state.cell.r)
            ? prev
            : [...prev, s.state.cell],
        );

        const last = i === sim.steps.length - 1;
        if (!last) return;

        const end = window.setTimeout(() => {
          setActiveBranch(null);
          if (sim.outcome === "win") {
            if (isFinalRound) {
              setPhase("won");
              if (!reportedRef.current) {
                reportedRef.current = true;
                // OPTIMIZE: a flawless run (no bumps anywhere) earns all 3 stars.
                const clean = collisions === 0;
                onComplete({
                  passed: true,
                  stars: clean ? 3 : 2,
                  detail: clean
                    ? "All three robots read their own sensors and wove to the flag — flawless!"
                    : "All three arenas solved! Run them without a single bump for ⭐⭐⭐.",
                });
              }
            } else {
              setPhase("round-won");
              const adv = window.setTimeout(() => {
                setRound((r) => r + 1);
                setupRound(round + 1);
              }, 1100);
              timersRef.current.push(adv);
            }
          } else {
            // Friendly THUNK. Count the bump (it costs the optimize star) but
            // never scold and never spam onComplete(passed:false). Fix & retry.
            setCollisions((c) => c + 1);
            setPhase("bump");
          }
        }, 380);
        timersRef.current.push(end);
      }, 460 * i);
      timersRef.current.push(t);
    });
  }, [
    bothFilled,
    phase,
    slots,
    level,
    isFinalRound,
    collisions,
    round,
    onComplete,
    clearTimers,
    setupRound,
  ]);

  const robotBlocked = useMemo(
    () => blockedIn(level.boxes, robot.cell, robot.dir),
    [level, robot],
  );

  const status = useMemo(() => {
    if (phase === "won") return "All three solved! 🎉";
    if (phase === "round-won") return "Arena cleared! Next robot loading…";
    if (phase === "bump") return "Thunk! Tweak a branch and run again.";
    if (phase === "running")
      return activeBranch === "yes"
        ? "Sensor: path BLOCKED → running YES branch"
        : "Sensor: path CLEAR → running NO branch";
    if (!bothFilled) return "Drop a block into each branch, then press Run ▶";
    return "Brain ready — press Run ▶";
  }, [phase, activeBranch, bothFilled]);

  const rotForDir: Record<Dir, number> = { up: -90, right: 0, down: 90, left: 180 };

  const cx = robot.cell.c * CELL + CELL / 2;
  const cy = robot.cell.r * CELL + CELL / 2;
  const coneOn = phase === "running" && robotBlocked;

  const pathD = path
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${p.c * CELL + CELL / 2} ${p.r * CELL + CELL / 2}`,
    )
    .join(" ");

  const celebrating = phase === "won";

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 text-ink">
      <style>{`
        @keyframes g4obstaclebot-pulse {
          0%,100% { opacity: .85; } 50% { opacity: .35; }
        }
        @keyframes g4obstaclebot-pop {
          0% { transform: scale(.4); opacity: 0; }
          60% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g4obstaclebot-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .g4ob-anim { animation: none !important; }
        }
      `}</style>

      {/* ---------------- ROUND PROGRESS + HINT ---------------- */}
      <div className="panel flex items-center justify-between gap-2 rounded-xl px-3 py-2">
        <span
          className="inline-flex items-center gap-1.5"
          role="status"
          aria-live="polite"
          aria-label={`Arena ${round + 1} of ${LEVELS.length}`}
        >
          {LEVELS.map((_, i) => {
            const solved = i < round || phase === "won";
            const current = i === round && phase !== "won";
            return (
              <span
                key={`rd-${i}`}
                aria-hidden
                className="grid place-items-center rounded-full"
                style={{
                  height: 13,
                  width: 13,
                  background: solved
                    ? ACCENT
                    : current
                      ? "rgba(52,211,153,0.25)"
                      : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                }}
              />
            );
          })}
        </span>
        <span className="flex-1 text-right font-mono text-[11px] text-ink-dim">
          {phase === "won" ? "Self-driving champion!" : level.hint}
        </span>
      </div>

      {/* ---------------- ARENA ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl"
        style={{
          boxShadow: celebrating
            ? `0 0 0 1px ${ACCENT}, 0 0 26px -4px ${ACCENT}`
            : undefined,
          transition: "box-shadow .3s ease",
          animation: phase === "bump" ? "g4obstaclebot-shake .25s 2" : undefined,
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Top-down arena with a robot, cardboard boxes and a goal flag"
        >
          {/* grid */}
          {Array.from({ length: GRID + 1 }, (_, i) => (
            <line
              key={`gx${i}`}
              x1={i * CELL}
              y1={0}
              x2={i * CELL}
              y2={VIEW}
              stroke="#1b2433"
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: GRID + 1 }, (_, i) => (
            <line
              key={`gy${i}`}
              x1={0}
              y1={i * CELL}
              x2={VIEW}
              y2={i * CELL}
              stroke="#1b2433"
              strokeWidth={1}
            />
          ))}

          {/* travelled path */}
          {path.length > 1 && (
            <path
              d={pathD}
              fill="none"
              stroke={ACCENT}
              strokeOpacity={0.5}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* start marker (helps the learner read the route before running) */}
          <text
            x={level.start.c * CELL + CELL / 2}
            y={level.start.r * CELL + CELL / 2 + 7}
            textAnchor="middle"
            fontSize={18}
            opacity={0.4}
            aria-hidden
          >
            🏁
          </text>

          {/* cardboard boxes */}
          {level.boxes.map((b, i) => (
            <g key={`box${round}-${i}`}>
              <rect
                x={b.c * CELL + 6}
                y={b.r * CELL + 6}
                width={CELL - 12}
                height={CELL - 12}
                rx={4}
                fill="#7c5a36"
                stroke="#a9763f"
                strokeWidth={2}
              />
              <text
                x={b.c * CELL + CELL / 2}
                y={b.r * CELL + CELL / 2 + 6}
                textAnchor="middle"
                fontSize={18}
              >
                📦
              </text>
            </g>
          ))}

          {/* goal flag */}
          <text
            x={level.goal.c * CELL + CELL / 2}
            y={level.goal.r * CELL + CELL / 2 + 8}
            textAnchor="middle"
            fontSize={26}
            className="g4ob-anim"
            style={{
              animation: celebrating ? "g4obstaclebot-pop .5s ease-out" : undefined,
            }}
          >
            🚩
          </text>

          {/* ultrasonic cone */}
          <g transform={`translate(${cx} ${cy}) rotate(${rotForDir[robot.dir]})`}>
            <path
              d={`M0 0 L${CELL * 1.05} -16 L${CELL * 1.05} 16 Z`}
              fill={coneOn ? "#f87171" : ACCENT}
              opacity={phase === "running" ? 0.32 : 0.16}
              className="g4ob-anim"
              style={{
                animation: coneOn ? "g4obstaclebot-pulse .6s infinite" : undefined,
              }}
            />
          </g>

          {/* robot */}
          <g transform={`translate(${cx} ${cy})`}>
            <circle
              r={15}
              fill={celebrating ? ACCENT : "#67e8f9"}
              stroke="#05070d"
              strokeWidth={2}
            />
            <text textAnchor="middle" y={6} fontSize={17}>
              🤖
            </text>
          </g>

          {/* win sparkle */}
          {celebrating && (
            <text
              x={level.goal.c * CELL + CELL / 2}
              y={level.goal.r * CELL + CELL / 2 - 14}
              textAnchor="middle"
              fontSize={16}
              className="g4ob-anim"
              style={{ animation: "g4obstaclebot-pop .5s ease-out" }}
            >
              ✨
            </text>
          )}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-1.5">
          <span
            className="font-mono text-[11px] text-ink-dim"
            role="status"
            aria-live="polite"
          >
            {status}
          </span>
          <span className="font-mono text-[11px]" style={{ color: "#f87171" }}>
            💥 {collisions}
          </span>
        </div>
      </div>

      {/* ---------------- DECISION TREE ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          Robot brain · decision tree
        </p>
        <div
          className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-center font-mono text-xs"
          style={{ color: ACCENT }}
        >
          IF distance &lt; 20&nbsp;cm ?
        </div>

        <div className="flex gap-2">
          {(["yes", "no"] as SlotId[]).map((slot) => {
            const filled = slots[slot];
            const firing = activeBranch === slot && phase === "running";
            return (
              <div key={slot} className="flex flex-1 flex-col gap-1">
                <span className="text-center font-mono text-[11px] text-ink-faint">
                  {slot === "yes" ? "YES → blocked" : "NO → clear"}
                </span>
                <button
                  type="button"
                  onPointerDown={() => (filled ? clearSlot(slot) : placeInSlot(slot))}
                  disabled={phase === "running"}
                  aria-label={
                    filled
                      ? `${slot === "yes" ? "Blocked" : "Clear"} branch holds ${blockById(filled).label}. Tap to remove.`
                      : `Empty ${slot === "yes" ? "blocked" : "clear"} branch. Tap to drop the held block.`
                  }
                  className="flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed px-2 py-2 text-center font-mono text-[11px] transition disabled:opacity-90"
                  style={{
                    touchAction: "manipulation",
                    borderColor: filled
                      ? firing
                        ? ACCENT
                        : "#64748b"
                      : held
                        ? ACCENT
                        : "#334155",
                    background: filled
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(255,255,255,0.02)",
                    boxShadow: firing
                      ? `0 0 0 2px ${ACCENT}, 0 0 16px -4px ${ACCENT}`
                      : undefined,
                    color: filled ? "var(--color-ink, #e6edf3)" : "#64748b",
                  }}
                >
                  {filled ? (
                    <>
                      <span aria-hidden className="text-base">
                        {blockById(filled).glyph}
                      </span>
                      <span>{blockById(filled).label}</span>
                    </>
                  ) : (
                    <span>drop block here</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- PALETTE ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          Blocks · tap one, then tap a branch
        </p>
        <div className="grid grid-cols-1 gap-2" role="group" aria-label="Action blocks">
          {BLOCKS.map((b) => {
            const placed = placedIds.includes(b.id);
            const picked = held === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onPointerDown={() => pickBlock(b.id)}
                disabled={phase === "running" || placed}
                aria-pressed={picked}
                aria-label={`Block: ${b.label}${placed ? " (placed)" : ""}`}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left font-mono text-[11px] transition disabled:opacity-40"
                style={{
                  touchAction: "manipulation",
                  borderColor: picked ? ACCENT : "#334155",
                  background: picked ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.02)",
                  color: "var(--color-ink, #e6edf3)",
                }}
              >
                <span aria-hidden className="text-base">
                  {b.glyph}
                </span>
                <span>{b.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- STEP LOG ---------------- */}
      {log.length > 0 && (
        <div className="panel flex flex-col gap-1 rounded-xl p-3" aria-label="Step log">
          <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
            Step log
          </p>
          <ol className="flex flex-col gap-0.5">
            {log.map((l) => (
              <li
                key={l.step}
                className="flex items-center gap-2 font-mono text-[11px] text-ink-dim"
              >
                <span
                  className="rounded px-1"
                  style={{
                    background: l.branch === "YES" ? "rgba(248,113,113,0.18)" : "rgba(52,211,153,0.18)",
                    color: l.branch === "YES" ? "#f87171" : ACCENT,
                  }}
                >
                  {l.branch}
                </span>
                <span>{l.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ---------------- WIN BANNER ---------------- */}
      {phase === "won" && (
        <div
          className="rounded-xl border px-3 py-2 text-center font-mono text-sm"
          style={{ borderColor: ACCENT, color: ACCENT, background: "rgba(52,211,153,0.1)" }}
        >
          {collisions === 0
            ? "🎉 Flawless self-driver! ⭐⭐⭐ ✨"
            : "🎉 All three solved! ⭐⭐ — zero bumps next time for ⭐⭐⭐"}
        </div>
      )}

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onPointerDown={fullReset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          style={{ touchAction: "manipulation" }}
          aria-label="Reset the whole lab from arena one"
        >
          Reset
        </button>
        <div className="flex gap-2">
          {phase === "bump" && (
            <button
              type="button"
              onPointerDown={resetRobot}
              className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
              style={{ touchAction: "manipulation" }}
              aria-label="Send the robot back to start"
            >
              Back to start
            </button>
          )}
          <button
            type="button"
            onPointerDown={run}
            disabled={!bothFilled || phase === "running" || phase === "round-won" || phase === "won"}
            className="rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d", touchAction: "manipulation" }}
            aria-label="Run the robot through the course"
          >
            {phase === "running" ? "Running…" : "Run ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}
