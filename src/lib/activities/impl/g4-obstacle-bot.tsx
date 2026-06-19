"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Obstacle Avoider — decision trees + sensors (Grade 4)             */
/*  Learning goal: a robot can decide for itself by walking a small   */
/*  IF/ELSE decision tree of sensor readings. The learner snaps       */
/*  action blocks into the YES (blocked) and NO (clear) branches of   */
/*  an ultrasonic distance check, then RUNs the fixed course step by  */
/*  step and watches the matching branch fire.                        */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const GRID = 6; // 6 x 6 top-down arena
const CELL = 52; // px per cell
const VIEW = GRID * CELL;

type Dir = "up" | "right" | "down" | "left";
type BlockId = "forward" | "stop-right" | "left" | "decoy";
type SlotId = "yes" | "no";
type Phase = "build" | "running" | "won" | "bump";

interface Cell {
  c: number;
  r: number;
}

/** Action blocks the learner can drag into a branch slot. */
interface Block {
  id: BlockId;
  label: string;
  glyph: string;
  /** What the robot should do this step when this block fires. */
}

const BLOCKS: readonly Block[] = [
  { id: "stop-right", label: "STOP → TURN RIGHT", glyph: "🛑↻" },
  { id: "forward", label: "GO FORWARD", glyph: "⬆️" },
  { id: "left", label: "TURN LEFT", glyph: "↺" },
  { id: "decoy", label: "GO FORWARD", glyph: "⬆️" }, // distracter
] as const;

const CORRECT: Record<SlotId, BlockId> = {
  yes: "stop-right", // path blocked  → stop & turn right
  no: "forward", // path clear    → drive on
};

/** Fixed cardboard-box maze (cells the robot must not enter). */
const BOXES: readonly Cell[] = [
  { c: 2, r: 4 },
  { c: 2, r: 3 },
  { c: 2, r: 2 },
  { c: 4, r: 1 },
  { c: 4, r: 2 },
  { c: 4, r: 3 },
] as const;

const START: Cell = { c: 0, r: 4 };
const START_DIR: Dir = "up";
const GOAL: Cell = { c: 5, r: 0 };

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

function isBox(c: number, r: number): boolean {
  return BOXES.some((b) => b.c === c && b.r === r);
}

function blocked(cell: Cell, dir: Dir): boolean {
  const d = DELTA[dir];
  const nc = cell.c + d.c;
  const nr = cell.r + d.r;
  if (nc < 0 || nc >= GRID || nr < 0 || nr >= GRID) return true; // wall = blocked
  return isBox(nc, nr);
}

interface RobotState {
  cell: Cell;
  dir: Dir;
}

const INITIAL: RobotState = { cell: START, dir: START_DIR };

interface LogLine {
  step: number;
  branch: "YES" | "NO";
  text: string;
}

const blockById = (id: BlockId): Block =>
  BLOCKS.find((b) => b.id === id) as Block;

export default function ObstacleAvoider({ onComplete }: ActivityProps) {
  const [slots, setSlots] = useState<Record<SlotId, BlockId | null>>({
    yes: null,
    no: null,
  });
  const [held, setHeld] = useState<BlockId | null>(null);
  const [robot, setRobot] = useState<RobotState>(INITIAL);
  const [phase, setPhase] = useState<Phase>("build");
  const [log, setLog] = useState<LogLine[]>([]);
  const [activeBranch, setActiveBranch] = useState<SlotId | null>(null);
  const [collisions, setCollisions] = useState<number>(0);
  const [path, setPath] = useState<Cell[]>([START]);

  const doneRef = useRef<boolean>(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  const placedIds = useMemo<BlockId[]>(
    () => [slots.yes, slots.no].filter((b): b is BlockId => b !== null),
    [slots],
  );

  const bothFilled = slots.yes !== null && slots.no !== null;

  /** Place the held / tapped block into a slot. */
  const placeInSlot = useCallback(
    (slot: SlotId) => {
      if (phase === "running" || held === null) return;
      setSlots((prev) => {
        // a block can only live in one slot — remove it elsewhere
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

  const resetRun = useCallback(() => {
    clearTimers();
    setRobot(INITIAL);
    setPath([START]);
    setLog([]);
    setActiveBranch(null);
    setPhase("build");
  }, [clearTimers]);

  const fullReset = useCallback(() => {
    clearTimers();
    setSlots({ yes: null, no: null });
    setHeld(null);
    setRobot(INITIAL);
    setPath([START]);
    setLog([]);
    setActiveBranch(null);
    setCollisions(0);
    setPhase("build");
  }, [clearTimers]);

  /** Drive the fixed course one decision at a time, animated. */
  const run = useCallback(() => {
    if (!bothFilled || phase === "running") return;
    clearTimers();
    setLog([]);
    setPath([START]);
    setRobot(INITIAL);
    setPhase("running");

    const yesBlock = slots.yes as BlockId;
    const noBlock = slots.no as BlockId;

    let state: RobotState = { cell: START, dir: START_DIR };
    const steps: { state: RobotState; line: LogLine; branch: SlotId }[] = [];
    let crashed = false;
    let reached = false;

    // Simulate the course. The tidy STOP→TURN-RIGHT path reaches the flag in
    // 10 decisions; this budget rejects meandering / wrong trees.
    const STEP_BUDGET = 16;
    for (let step = 1; step <= STEP_BUDGET; step++) {
      const ahead = blocked(state.cell, state.dir);
      const branch: SlotId = ahead ? "yes" : "no";
      const chosen = ahead ? yesBlock : noBlock;

      let line: LogLine;
      if (chosen === "stop-right") {
        state = { cell: state.cell, dir: RIGHT_OF[state.dir] };
        line = {
          step,
          branch: ahead ? "YES" : "NO",
          text: `dist ${ahead ? "< 20cm" : "≥ 20cm"} → STOP, turn right`,
        };
      } else if (chosen === "left") {
        state = { cell: state.cell, dir: ({ up: "left", left: "down", down: "right", right: "up" } as Record<Dir, Dir>)[state.dir] };
        line = {
          step,
          branch: ahead ? "YES" : "NO",
          text: `dist ${ahead ? "< 20cm" : "≥ 20cm"} → turn left`,
        };
      } else {
        // forward or decoy → step ahead
        const d = DELTA[state.dir];
        const nc = state.cell.c + d.c;
        const nr = state.cell.r + d.r;
        if (ahead) {
          // forward into a wall/box → THUNK
          crashed = true;
          line = {
            step,
            branch: ahead ? "YES" : "NO",
            text: `dist < 20cm → GO FORWARD … 💥 thunk!`,
          };
          steps.push({ state, line, branch });
          break;
        }
        state = { cell: { c: nc, r: nr }, dir: state.dir };
        line = {
          step,
          branch: "NO",
          text: `dist ≥ 20cm → forward to (${nc + 1},${nr + 1})`,
        };
      }

      steps.push({ state, line, branch });

      if (state.cell.c === GOAL.c && state.cell.r === GOAL.r) {
        reached = true;
        break;
      }
    }

    // Animate the simulated steps so the learner SEES the logic fire.
    steps.forEach((s, i) => {
      const t = window.setTimeout(() => {
        setRobot(s.state);
        setActiveBranch(s.branch);
        setLog((prev) => [...prev, s.line]);
        setPath((prev) =>
          prev.some((p) => p.c === s.state.cell.c && p.r === s.state.cell.r)
            ? prev
            : [...prev, s.state.cell],
        );

        const last = i === steps.length - 1;
        if (last) {
          const end = window.setTimeout(() => {
            setActiveBranch(null);
            if (reached && !crashed) {
              setPhase("won");
              if (!doneRef.current) {
                doneRef.current = true;
                onComplete({
                  passed: true,
                  stars: 3,
                  detail: "The robot read its own sensors and wove to the flag!",
                });
              }
            } else {
              setCollisions((c) => c + 1);
              setPhase("bump");
              onComplete({
                passed: false,
                detail: crashed
                  ? "It drove into a box. What should it do when the path ahead is blocked?"
                  : "It wandered off course — check both branches.",
              });
            }
          }, 380);
          timersRef.current.push(end);
        }
      }, 460 * i);
      timersRef.current.push(t);
    });
  }, [bothFilled, phase, slots, onComplete, clearTimers]);

  const robotBlocked = useMemo(
    () => blocked(robot.cell, robot.dir),
    [robot],
  );

  const status = useMemo(() => {
    if (phase === "won") return "Reached the flag with zero collisions! 🎉";
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

  const slotOk = (slot: SlotId): boolean => slots[slot] === CORRECT[slot];

  const pathD = path
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${p.c * CELL + CELL / 2} ${p.r * CELL + CELL / 2}`,
    )
    .join(" ");

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
        @keyframes g4obstaclebot-dash { to { stroke-dashoffset: 0; } }
      `}</style>

      {/* ---------------- ARENA ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl"
        style={{
          boxShadow:
            phase === "won"
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

          {/* cardboard boxes */}
          {BOXES.map((b, i) => (
            <g key={`box${i}`}>
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
            x={GOAL.c * CELL + CELL / 2}
            y={GOAL.r * CELL + CELL / 2 + 8}
            textAnchor="middle"
            fontSize={26}
            style={{
              animation:
                phase === "won" ? "g4obstaclebot-pop .5s ease-out" : undefined,
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
              style={{
                animation: coneOn ? "g4obstaclebot-pulse .6s infinite" : undefined,
              }}
            />
          </g>

          {/* robot */}
          <g transform={`translate(${cx} ${cy})`}>
            <circle
              r={15}
              fill={phase === "won" ? ACCENT : "#67e8f9"}
              stroke="#05070d"
              strokeWidth={2}
            />
            <text textAnchor="middle" y={6} fontSize={17}>
              🤖
            </text>
          </g>

          {/* win sparkle */}
          {phase === "won" && (
            <text
              x={GOAL.c * CELL + CELL / 2}
              y={GOAL.r * CELL + CELL / 2 - 14}
              textAnchor="middle"
              fontSize={16}
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
            const ok = slotOk(slot);
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
                      ? ok
                        ? ACCENT
                        : "#64748b"
                      : held
                        ? ACCENT
                        : "#334155",
                    background: ok
                      ? "rgba(52,211,153,0.12)"
                      : "rgba(255,255,255,0.02)",
                    boxShadow: firing
                      ? `0 0 0 2px ${ACCENT}, 0 0 16px -4px ${ACCENT}`
                      : ok
                        ? `0 0 0 1px ${ACCENT}`
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
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Action blocks">
          {BLOCKS.map((b, i) => {
            const placed = placedIds.includes(b.id);
            const picked = held === b.id;
            return (
              <button
                key={`${b.id}${i}`}
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
          🎉 Self-driving success! ⭐⭐⭐ ✨
        </div>
      )}

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onPointerDown={fullReset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          style={{ touchAction: "manipulation" }}
          aria-label="Reset the whole lab"
        >
          Reset
        </button>
        <div className="flex gap-2">
          {(phase === "bump" || phase === "won") && (
            <button
              type="button"
              onPointerDown={resetRun}
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
            disabled={!bothFilled || phase === "running"}
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
