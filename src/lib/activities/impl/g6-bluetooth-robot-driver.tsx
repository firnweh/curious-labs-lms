"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Bluetooth Robot Driver — wireless commands → motor actions        */
/*  CLASS 4-6 (explorer). ONE concept: a wireless message sends a      */
/*  single CHARACTER that the robot reads as ONE motor action, so a    */
/*  SEQUENCE of letters becomes a path. The HARD part for this age is  */
/*  that turns are RELATIVE: after you turn, "Forward" points a new    */
/*  way — so you must track the robot's heading in your head.          */
/*                                                                     */
/*  Why it's a real problem, not a toy (THREE escalating rounds):      */
/*  • R1 — tidy S-bend, robot faces UP. Learn relative F/L/R/S.        */
/*  • R2 — longer route with a DECOY fork + a blocked cell: the only   */
/*    lit dashes are no longer a single obvious line, so you must read  */
/*    the turns, not trace the one path.                               */
/*  • R3 — the TWIST: the robot boots facing RIGHT, so the naive       */
/*    "F = go up" guess drives straight off the route. You have to     */
/*    re-plan every turn from the new heading.                         */
/*                                                                     */
/*  OPTIMIZE for full stars: a clean win that uses no wasted commands  */
/*  (matches the shortest program) earns ⭐⭐⭐. A messy win that still  */
/*  reaches & stops on the flag — e.g. spinning L+L+L instead of R —   */
/*  still passes, but with fewer stars. Always winnable; gentle retry. */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const RED = "#f87171";
const CYAN = "#67e8f9";
const AMBER = "#fbbf24";

const COLS = 6;
const ROWS = 6;
const CELL = 46;
const PAD = 14;
const VIEW_W = PAD * 2 + COLS * CELL;
const VIEW_H = PAD * 2 + ROWS * CELL;

/** Letter that gets "transmitted" over Bluetooth for each control. */
type Cmd = "F" | "B" | "L" | "R" | "S";
/** Only these tiles can be dragged into the queue (B is a decoy press). */
type QueueCmd = "F" | "L" | "R" | "S";

type Heading = 0 | 1 | 2 | 3; // 0=up, 1=right, 2=down, 3=left
type Phase = "idle" | "playing" | "roundWon" | "won" | "crashed";

interface Cell {
  c: number;
  r: number;
}

interface Level {
  start: Cell;
  startHeading: Heading;
  /** The route the robot must trace, in order. START is implicit (not listed). */
  route: Cell[];
  /** Extra dashed cells that look like a path but are NOT on the route (decoys). */
  decoys: Cell[];
  /** Blocked cells (walls) drawn as hazards; never part of the route. */
  blocks: Cell[];
  /** The single shortest correct program (revealed as a ghost after misses). */
  solution: QueueCmd[];
}

const MAX_SLOTS = 12;

const DELTA: Record<Heading, Cell> = {
  0: { c: 0, r: -1 },
  1: { c: 1, r: 0 },
  2: { c: 0, r: 1 },
  3: { c: -1, r: 0 },
};

const HEADING_WORD: Record<Heading, string> = {
  0: "up",
  1: "right",
  2: "down",
  3: "left",
};

/* ── Three fixed, hand-authored, escalating routes ────────────────── */
/* Every solution is verified by simulate() in a dev assertion below.  */
const LEVELS: Level[] = [
  // R1 — tidy S-bend, robot faces UP. (1,5)→F F →R→F →L→F F. 8 commands.
  {
    start: { c: 1, r: 5 },
    startHeading: 0,
    route: [
      { c: 1, r: 4 },
      { c: 1, r: 3 },
      { c: 2, r: 3 },
      { c: 2, r: 2 },
      { c: 2, r: 1 },
    ],
    decoys: [],
    blocks: [],
    solution: ["F", "F", "R", "F", "L", "F", "F", "S"],
  },
  // R2 — longer route + a DECOY fork branching off at (1,3), plus a block.
  // Robot faces UP. Correct: F F R F F L F F S (the route bends right then up).
  // (1,5)→(1,4)→(1,3) [decoy goes LEFT to (0,3)] →turn R→(2,3)→(3,3)
  // →turn L→(3,2)→(3,1). 9 commands.
  {
    start: { c: 1, r: 5 },
    startHeading: 0,
    route: [
      { c: 1, r: 4 },
      { c: 1, r: 3 },
      { c: 2, r: 3 },
      { c: 3, r: 3 },
      { c: 3, r: 2 },
      { c: 3, r: 1 },
    ],
    decoys: [
      // a tempting fork left at the first junction — looks like part of the trail
      { c: 0, r: 3 },
      { c: 0, r: 2 },
    ],
    blocks: [{ c: 2, r: 2 }],
    solution: ["F", "F", "R", "F", "F", "L", "F", "F", "S"],
  },
  // R3 — the TWIST: robot BOOTS facing RIGHT. "F = up" guess fails instantly.
  // Start (1,4) facing right. Route climbs and hooks. Correct from heading RIGHT:
  // L (now up) F F → R (now right) F → L (now up) F → R (now right) F S.
  // (1,4)→up(1,3)→up(1,2)→right(2,2)→up(2,1)→right(3,1). 9 commands.
  {
    start: { c: 1, r: 4 },
    startHeading: 1,
    route: [
      { c: 1, r: 3 },
      { c: 1, r: 2 },
      { c: 2, r: 2 },
      { c: 2, r: 1 },
      { c: 3, r: 1 },
    ],
    decoys: [
      // a decoy continuing straight right from the start (the naive heading)
      { c: 2, r: 4 },
      { c: 3, r: 4 },
    ],
    blocks: [{ c: 3, r: 2 }],
    solution: ["L", "F", "F", "R", "F", "L", "F", "R", "F", "S"],
  },
];

const cx = (c: number): number => PAD + c * CELL + CELL / 2;
const cy = (r: number): number => PAD + r * CELL + CELL / 2;
const sameCell = (a: Cell, b: Cell): boolean => a.c === b.c && a.r === b.r;

const turnLeft = (h: Heading): Heading => ((h + 3) % 4) as Heading;
const turnRight = (h: Heading): Heading => ((h + 1) % 4) as Heading;

/* ── Deterministic simulation (no randomness, no clock) ───────────── */
type Outcome = "win" | "offroute" | "block" | "short" | "stopEarly";

interface SimResult {
  /** Cells the robot occupies, in order, starting at the level's start cell. */
  trail: Cell[];
  outcome: Outcome;
  /** Index of the queued command that failed (for highlighting), or -1. */
  badIndex: number;
  /** How many distinct route checkpoints were reached, in order. */
  reached: number;
}

function buildRouteSet(level: Level): (cell: Cell) => boolean {
  const onRoute = (cell: Cell): boolean =>
    sameCell(cell, level.start) || level.route.some((p) => sameCell(p, cell));
  return onRoute;
}

/** Walk the queued program from the level start. Stops on win/off-route/block. */
function simulate(level: Level, queue: QueueCmd[]): SimResult {
  const onRoute = buildRouteSet(level);
  const finish = level.route[level.route.length - 1];
  let pos: Cell = level.start;
  let h: Heading = level.startHeading;
  let reached = 0;
  const trail: Cell[] = [pos];

  for (let i = 0; i < queue.length; i++) {
    const cmd = queue[i];
    if (cmd === "L") {
      h = turnLeft(h);
      continue;
    }
    if (cmd === "R") {
      h = turnRight(h);
      continue;
    }
    if (cmd === "S") {
      if (sameCell(pos, finish)) return { trail, outcome: "win", badIndex: -1, reached };
      return { trail, outcome: "stopEarly", badIndex: i, reached };
    }
    // cmd === "F"
    const d = DELTA[h];
    const next: Cell = { c: pos.c + d.c, r: pos.r + d.r };
    const inBounds = next.c >= 0 && next.c < COLS && next.r >= 0 && next.r < ROWS;
    if (level.blocks.some((b) => sameCell(b, next))) {
      return { trail, outcome: "block", badIndex: i, reached };
    }
    if (!inBounds || !onRoute(next)) {
      return { trail, outcome: "offroute", badIndex: i, reached };
    }
    pos = next;
    trail.push(pos);
    // count route checkpoints reached in order
    if (reached < level.route.length && sameCell(pos, level.route[reached])) {
      reached += 1;
    }
  }
  return { trail, outcome: "short", badIndex: -1, reached };
}

// Dev-only assertion: each authored solution actually wins (deterministic).
if (process.env.NODE_ENV !== "production") {
  for (let i = 0; i < LEVELS.length; i++) {
    const res = simulate(LEVELS[i], LEVELS[i].solution);
    if (res.outcome !== "win") {
      // eslint-disable-next-line no-console
      console.error(`g6-bluetooth-robot-driver: level ${i + 1} solution does not win`, res);
    }
  }
}

const PAD_BUTTONS: { id: Cmd; glyph: string; label: string }[] = [
  { id: "F", glyph: "▲", label: "Forward" },
  { id: "L", glyph: "◀", label: "Turn left" },
  { id: "S", glyph: "■", label: "Stop" },
  { id: "R", glyph: "▶", label: "Turn right" },
  { id: "B", glyph: "▼", label: "Back" },
];

const STEP_MS = 400;

export default function BluetoothRobotDriver({ onComplete }: ActivityProps) {
  const [levelIdx, setLevelIdx] = useState<number>(0);
  const [queue, setQueue] = useState<QueueCmd[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const level = LEVELS[levelIdx];
  const [robot, setRobot] = useState<Cell>(level.start);
  const [heading, setHeading] = useState<Heading>(level.startHeading);
  const [trail, setTrail] = useState<Cell[]>([level.start]);
  const [litCheckpoints, setLit] = useState<number>(0);
  const [badTile, setBadTile] = useState<number | null>(null);
  const [pulse, setPulse] = useState<Cmd | null>(null);
  const [latency, setLatency] = useState<number>(0);
  const [misses, setMisses] = useState<number>(0);
  const [hint, setHint] = useState<string>("");
  // Across the whole 3-round run, did EVERY round get a clean (optimal) win?
  const [allClean, setAllClean] = useState<boolean>(true);

  const reportedRef = useRef<boolean>(false);
  const timersRef = useRef<number[]>([]);
  const pulseTimerRef = useRef<number | null>(null);

  const playing = phase === "playing";
  const finished = phase === "won";
  const showGhost = misses >= 2 && phase !== "won" && phase !== "roundWon";

  const finishCell = level.route[level.route.length - 1];

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
    },
    [],
  );

  /** Animate a Bluetooth "pulse" on the matching pad button + bump latency. */
  const flashPulse = useCallback((id: Cmd) => {
    setPulse(id);
    setLatency((ms) => Math.min(ms + 18, 240));
    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => setPulse(null), 340);
  }, []);

  const parkAtStart = useCallback((lvl: Level) => {
    setRobot(lvl.start);
    setHeading(lvl.startHeading);
    setTrail([lvl.start]);
    setLit(0);
    setBadTile(null);
  }, []);

  const addTile = useCallback(
    (id: QueueCmd) => {
      if (playing || finished) return;
      flashPulse(id);
      setQueue((q) => (q.length >= MAX_SLOTS ? q : [...q, id]));
      setBadTile(null);
      setHint("");
    },
    [playing, finished, flashPulse],
  );

  const padPress = useCallback(
    (id: Cmd) => {
      if (finished) return;
      flashPulse(id);
      if (id === "B") {
        setHint("Tip: this robot never needs to reverse — use F, L, R and S.");
        return;
      }
      addTile(id);
    },
    [finished, flashPulse, addTile],
  );

  const popTile = useCallback(() => {
    if (playing || finished) return;
    setQueue((q) => q.slice(0, -1));
    setBadTile(null);
    setHint("");
  }, [playing, finished]);

  /** Clear the QUEUE only (stay on the same round). */
  const clearQueue = useCallback(() => {
    if (playing) return;
    clearTimers();
    setQueue([]);
    setPhase("idle");
    parkAtStart(level);
    setHint("");
  }, [playing, clearTimers, parkAtStart, level]);

  /** Full restart back to round 1. */
  const restartAll = useCallback(() => {
    clearTimers();
    reportedRef.current = false;
    setLevelIdx(0);
    setQueue([]);
    setPhase("idle");
    setMisses(0);
    setAllClean(true);
    setLatency(0);
    setHint("");
    parkAtStart(LEVELS[0]);
  }, [clearTimers, parkAtStart]);

  /** Advance to the next round (called after a roundWon pause). */
  const goNextRound = useCallback(() => {
    setLevelIdx((i) => {
      const next = i + 1;
      parkAtStart(LEVELS[next]);
      return next;
    });
    setQueue([]);
    setPhase("idle");
    setHint("");
  }, [parkAtStart]);

  /** Run the queued program one command at a time. Deterministic stepping. */
  const play = useCallback(() => {
    if (playing || finished || queue.length === 0) return;
    clearTimers();

    const sim = simulate(level, queue);
    // A "clean" win uses no wasted commands: program length == shortest length.
    const optimal = queue.length === level.solution.length;

    setPhase("playing");
    parkAtStart(level);
    setHint("");

    // Replay the trail + heading frame-by-frame so kids SEE each letter act.
    let pos: Cell = level.start;
    let h: Heading = level.startHeading;
    let lit = 0;

    for (let i = 0; i < queue.length; i++) {
      const idx = i;
      const cmd = queue[i];
      const t = window.setTimeout(
        () => {
          flashPulse(cmd);

          if (cmd === "L" || cmd === "R") {
            h = cmd === "L" ? turnLeft(h) : turnRight(h);
            setHeading(h);
            return;
          }

          if (cmd === "S") {
            if (sameCell(pos, finishCell)) {
              // Reached & stopped on the flag — this round is solved.
              setLit(level.route.length);
              const isLast = levelIdx >= LEVELS.length - 1;
              const cleanSoFar = allClean && optimal;
              setAllClean(cleanSoFar);

              if (isLast) {
                setPhase("won");
                if (!reportedRef.current) {
                  reportedRef.current = true;
                  const stars: 1 | 2 | 3 = cleanSoFar ? 3 : 2;
                  onComplete({
                    passed: true,
                    stars,
                    detail: cleanSoFar
                      ? "Drove all three routes with the shortest program — perfect telemetry!"
                      : "Drove all three routes and parked on every flag.",
                  });
                }
              } else {
                setPhase("roundWon");
                const tt = window.setTimeout(goNextRound, 1150);
                timersRef.current.push(tt);
              }
            } else {
              setMisses((m) => m + 1);
              setPhase("crashed");
              setBadTile(idx);
              setHint(
                "It stopped early. Add Forward steps so it reaches the flag before S.",
              );
            }
            return;
          }

          // cmd === "F"
          const d = DELTA[h];
          const next: Cell = { c: pos.c + d.c, r: pos.r + d.r };
          const inBounds =
            next.c >= 0 && next.c < COLS && next.r >= 0 && next.r < ROWS;
          const onRoute = buildRouteSet(level)(next);
          const blocked = level.blocks.some((b) => sameCell(b, next));

          if (blocked) {
            setMisses((m) => m + 1);
            setPhase("crashed");
            setBadTile(idx);
            setHint("It drove into a blocked tile ⛔ — steer around it.");
            return;
          }
          if (!inBounds || !onRoute) {
            setMisses((m) => m + 1);
            setPhase("crashed");
            setBadTile(idx);
            setHint(
              levelIdx === LEVELS.length - 1
                ? "Remember: this robot starts facing RIGHT, not up — replan your first turn."
                : "It left the route here — check which way it's facing after each turn.",
            );
            return;
          }

          pos = next;
          setRobot(pos);
          setTrail((prev) => [...prev, next]);
          if (lit < level.route.length && sameCell(pos, level.route[lit])) {
            lit += 1;
            setLit(lit);
          }
        },
        (i + 1) * STEP_MS,
      );
      timersRef.current.push(t);
    }
  }, [
    playing,
    finished,
    queue,
    level,
    levelIdx,
    allClean,
    finishCell,
    clearTimers,
    parkAtStart,
    flashPulse,
    goNextRound,
    onComplete,
  ]);

  const robotAngle = heading * 90;
  const solvedRounds = finished ? LEVELS.length : levelIdx;

  const status = useMemo<string>(() => {
    if (phase === "won")
      return allClean ? "All routes cleared — perfect run! ✨" : "All routes cleared! ✨";
    if (phase === "roundWon") return "Route complete — next mission incoming…";
    if (phase === "playing") return "Streaming commands over Bluetooth…";
    if (phase === "crashed") return hint || "Not there yet — adjust the queue.";
    if (queue.length === 0)
      return `Round ${levelIdx + 1}/3 — robot faces ${HEADING_WORD[level.startHeading].toUpperCase()}. Build a command queue.`;
    return `Queue: ${queue.join(" ")} — press Play ▶`;
  }, [phase, allClean, hint, queue, levelIdx, level.startHeading]);

  return (
    <div
      className="flex w-full flex-col gap-3 text-ink"
      style={{ maxWidth: 440, margin: "0 auto" }}
    >
      <style>{`
        @keyframes g6bluetoothrobotdriver-ping {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes g6bluetoothrobotdriver-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        @keyframes g6bluetoothrobotdriver-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        .g6bluetoothrobotdriver-bad {
          animation: g6bluetoothrobotdriver-shake .28s ease 2;
        }
        @media (prefers-reduced-motion: reduce) {
          .g6bluetoothrobotdriver-bad { animation: none !important; }
        }
      `}</style>

      {/* ---------------- ROUND PROGRESS ---------------- */}
      <div
        className="flex items-center justify-between gap-2 rounded-xl border border-line bg-panel/60 px-3 py-1.5"
        role="status"
        aria-live="polite"
        aria-label={
          finished
            ? "All three routes solved"
            : `Round ${levelIdx + 1} of 3`
        }
      >
        <span className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          Mission {Math.min(levelIdx + 1, LEVELS.length)} / {LEVELS.length}
        </span>
        <span className="inline-flex items-center gap-1.5" aria-hidden>
          {LEVELS.map((_, i) => {
            const solved = i < solvedRounds;
            const current = i === levelIdx && !finished;
            return (
              <span
                key={`rd${i}`}
                className="inline-block rounded-full"
                style={{
                  height: 12,
                  width: 12,
                  background: solved
                    ? ACCENT
                    : current
                      ? "rgba(52,211,153,0.25)"
                      : "transparent",
                  border: `2px solid ${solved || current ? ACCENT : "#2a3340"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                }}
              />
            );
          })}
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: allClean ? ACCENT : AMBER }}
          aria-hidden
        >
          {allClean ? "◇ optimal" : "◇ ok"}
        </span>
      </div>

      {/* ---------------- ARENA + CONTROL PAD ---------------- */}
      <div className="flex gap-2">
        {/* Arena */}
        <div className="panel relative flex-1 overflow-hidden rounded-xl p-1">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="block h-auto w-full"
            role="img"
            aria-label={`Top-down robot arena, round ${levelIdx + 1}, with a dashed route to the finish flag`}
          >
            {/* grid */}
            {Array.from({ length: COLS + 1 }, (_, i) => (
              <line
                key={`gv${i}`}
                x1={PAD + i * CELL}
                y1={PAD}
                x2={PAD + i * CELL}
                y2={PAD + ROWS * CELL}
                stroke="#1b2433"
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: ROWS + 1 }, (_, i) => (
              <line
                key={`gh${i}`}
                x1={PAD}
                y1={PAD + i * CELL}
                x2={PAD + COLS * CELL}
                y2={PAD + i * CELL}
                stroke="#1b2433"
                strokeWidth={1}
              />
            ))}

            {/* decoy dashes — look like trail but lead nowhere (guess-defeating) */}
            {level.decoys.length > 0 && (
              <polyline
                points={[level.start, ...level.decoys]
                  .map((p) => `${cx(p.c)},${cy(p.r)}`)
                  .join(" ")}
                fill="none"
                stroke={CYAN}
                strokeOpacity={0.16}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="2 7"
              />
            )}

            {/* the true dashed route */}
            <polyline
              points={[level.start, ...level.route]
                .map((p) => `${cx(p.c)},${cy(p.r)}`)
                .join(" ")}
              fill="none"
              stroke={CYAN}
              strokeOpacity={0.45}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="2 7"
            />

            {/* ghost solution path (after 2 misses) */}
            {showGhost && (
              <polyline
                points={[level.start, ...level.route]
                  .map((p) => `${cx(p.c)},${cy(p.r)}`)
                  .join(" ")}
                fill="none"
                stroke={ACCENT}
                strokeOpacity={0.25}
                strokeWidth={10}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* blocked tiles */}
            {level.blocks.map((b, i) => (
              <g key={`bk${i}`}>
                <rect
                  x={PAD + b.c * CELL + 4}
                  y={PAD + b.r * CELL + 4}
                  width={CELL - 8}
                  height={CELL - 8}
                  rx={6}
                  fill="#2a1414"
                  stroke={RED}
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                />
                <text
                  x={cx(b.c)}
                  y={cy(b.r) + 6}
                  textAnchor="middle"
                  fontSize={18}
                  aria-hidden
                >
                  ⛔
                </text>
              </g>
            ))}

            {/* checkpoints (route nodes) */}
            {level.route.map((cp, i) => {
              const done = i < litCheckpoints;
              return (
                <circle
                  key={`cp${i}`}
                  cx={cx(cp.c)}
                  cy={cy(cp.r)}
                  r={7}
                  fill={done ? ACCENT : "none"}
                  fillOpacity={done ? 0.85 : 0}
                  stroke={done ? ACCENT : CYAN}
                  strokeOpacity={done ? 1 : 0.5}
                  strokeWidth={2}
                />
              );
            })}

            {/* travelled trail */}
            {trail.length > 1 && (
              <polyline
                points={trail.map((p) => `${cx(p.c)},${cy(p.r)}`).join(" ")}
                fill="none"
                stroke={ACCENT}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* start marker */}
            <text
              x={cx(level.start.c)}
              y={cy(level.start.r) + 4}
              textAnchor="middle"
              fontSize={10}
              fill={CYAN}
              className="font-mono"
            >
              START
            </text>

            {/* finish flag */}
            <text
              x={cx(finishCell.c)}
              y={cy(finishCell.r) + 7}
              textAnchor="middle"
              fontSize={20}
            >
              🏁
            </text>

            {/* robot */}
            <g
              transform={`translate(${cx(robot.c)} ${cy(robot.r)}) rotate(${robotAngle})`}
              style={{ transition: "transform .35s ease" }}
            >
              <polygon
                points="0,-11 8,9 0,4 -8,9"
                fill={
                  phase === "won" || phase === "roundWon"
                    ? ACCENT
                    : phase === "crashed"
                      ? RED
                      : CYAN
                }
                stroke="#05070d"
                strokeWidth={1.5}
              />
            </g>
            {/* robot emoji ride-along (kept upright, not rotated) */}
            <text
              x={cx(robot.c)}
              y={cy(robot.r) - 13}
              textAnchor="middle"
              fontSize={14}
              style={{ transition: "all .35s ease" }}
            >
              🤖
            </text>
          </svg>

          {(phase === "won" || phase === "roundWon") && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl">
              {phase === "won" ? "✨🎉✨" : "✅"}
            </div>
          )}
        </div>

        {/* Phone-style control pad */}
        <div
          className="flex flex-col items-center gap-2 rounded-xl border border-line bg-panel/60 p-2"
          style={{ width: 116 }}
        >
          <div className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
            <span className="relative inline-flex h-3 w-3 items-center justify-center">
              {pulse !== null && (
                <span
                  aria-hidden
                  className="absolute inline-block h-3 w-3 rounded-full"
                  style={{
                    background: ACCENT,
                    animation: "g6bluetoothrobotdriver-ping .34s ease-out",
                  }}
                />
              )}
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: pulse !== null ? ACCENT : "#3a4658" }}
              />
            </span>
            📡 BT
          </div>

          {/* heading readout — crucial for relative-turn reasoning */}
          <div
            className="flex w-full items-center justify-center gap-1 rounded-md py-1 font-mono text-[10px]"
            style={{ background: "#11181f", color: CYAN }}
            aria-label={`Robot is facing ${HEADING_WORD[heading]}`}
          >
            <span aria-hidden>{["▲", "▶", "▼", "◀"][heading]}</span>
            <span className="uppercase">{HEADING_WORD[heading]}</span>
          </div>

          {/* 3×3 d-pad layout */}
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            {(["_", "F", "_", "L", "S", "R", "_", "B", "_"] as const).map(
              (slot, i) => {
                if (slot === "_")
                  return <span key={`sp${i}`} aria-hidden className="h-9 w-9" />;
                const btn = PAD_BUTTONS.find((b) => b.id === slot)!;
                const active = pulse === btn.id;
                const isStop = btn.id === "S";
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onPointerDown={() => padPress(btn.id)}
                    disabled={playing || finished}
                    aria-label={`${btn.label} — transmits the letter ${btn.id}`}
                    title={`${btn.label} (sends '${btn.id}')`}
                    className="flex h-9 w-9 flex-col items-center justify-center rounded-md font-mono text-[13px] leading-none transition disabled:opacity-50"
                    style={{
                      background: active
                        ? ACCENT
                        : isStop
                          ? "#2a3340"
                          : "#1b2433",
                      color: active ? "#05070d" : isStop ? RED : CYAN,
                      border: `1px solid ${active ? ACCENT : "#2a3340"}`,
                      touchAction: "manipulation",
                    }}
                  >
                    <span aria-hidden>{btn.glyph}</span>
                    <span className="text-[8px] opacity-80">{btn.id}</span>
                  </button>
                );
              },
            )}
          </div>

          {/* latency meter */}
          <div className="w-full">
            <div className="flex justify-between font-mono text-[9px] text-ink-faint">
              <span>latency</span>
              <span>{latency}ms</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min((latency / 240) * 100, 100)}%`,
                  background: latency > 180 ? RED : ACCENT,
                  transition: "width .3s ease",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- QUEUE STRIP ---------------- */}
      <div className="panel rounded-xl p-2">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          <span>
            Command queue · target {level.solution.length}
          </span>
          <span>
            {queue.length}/{MAX_SLOTS}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: MAX_SLOTS }, (_, i) => {
            const cmd = queue[i];
            const isBad = badTile === i;
            const ghost =
              showGhost && queue.length === 0 ? level.solution[i] : null;
            return (
              <div
                key={i}
                role="listitem"
                aria-label={
                  cmd ? `Slot ${i + 1}: ${cmd}` : `Slot ${i + 1}: empty`
                }
                className={isBad ? "g6bluetoothrobotdriver-bad" : undefined}
                style={{
                  width: 30,
                  height: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 14,
                  fontWeight: 600,
                  background: cmd ? "#1b2433" : "transparent",
                  color: isBad ? "#05070d" : cmd ? ACCENT : "#3a4658",
                  border: `1.5px ${cmd ? "solid" : "dashed"} ${
                    isBad ? RED : cmd ? ACCENT : "#2a3340"
                  }`,
                  ...(isBad ? { background: RED } : {}),
                  ...(cmd
                    ? { animation: "g6bluetoothrobotdriver-pop .22s ease" }
                    : {}),
                }}
              >
                {cmd ?? (
                  <span style={{ opacity: 0.5, fontSize: 11 }}>
                    {ghost ?? i + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- STATUS ---------------- */}
      <div
        role="status"
        aria-live="polite"
        className="font-mono text-[12px]"
        style={{
          color:
            phase === "won" || phase === "roundWon"
              ? ACCENT
              : phase === "crashed"
                ? RED
                : "#9aa6b2",
          minHeight: 18,
        }}
      >
        {status}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onPointerDown={popTile}
          disabled={playing || finished || queue.length === 0}
          className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm font-medium text-ink-dim disabled:opacity-40"
          style={{ touchAction: "manipulation" }}
          aria-label="Remove the last queued command"
        >
          ⌫ Undo
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onPointerDown={finished ? restartAll : clearQueue}
            disabled={playing}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim disabled:opacity-40"
            style={{ touchAction: "manipulation" }}
            aria-label={
              finished ? "Play again from round one" : "Clear the command queue"
            }
          >
            {finished ? "Replay" : "Clear"}
          </button>
          <button
            type="button"
            onPointerDown={play}
            disabled={playing || finished || queue.length === 0}
            className="rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50"
            style={{
              background: ACCENT,
              color: "#05070d",
              touchAction: "manipulation",
            }}
            aria-label="Play the queued commands"
          >
            {playing ? "Driving…" : "Play ▶"}
          </button>
        </div>
      </div>

      {finished && (
        <div
          className="text-center text-lg font-semibold"
          style={{ color: allClean ? ACCENT : AMBER }}
        >
          {allClean ? "⭐⭐⭐ Flawless run!" : "⭐⭐ All missions complete!"}
        </div>
      )}
    </div>
  );
}
