"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Robot Runner — a CODING activity (sequencing + loops + debugging).
 * CLASS 4-6 (explorer, age ~9-11). Drive a bot across a 6×6 maze to its
 * battery by assembling a program of command blocks.
 *
 * This is a REAL problem across THREE escalating rounds, not a one-shot toy:
 *
 *  ROUND 1 — SEQUENCE. A short staircase. Learn the controls & facing.
 *
 *  ROUND 2 — LOOP IT (optimization). A LONG staircase. You CAN win by stacking
 *    forwards and turns by hand — but that blows the BLOCK BUDGET, so a sloppy
 *    win earns fewer stars. To earn full stars you must spot the repeating
 *    [Forward, turn, Forward, turn] pattern and fold it into one Repeat block.
 *    This is what makes the loop genuinely worth using, not decoration.
 *
 *  ROUND 3 — DEBUG + TWIST. We hand the child an ALMOST-right program that
 *    bonks into a wall. They must find the bug and fix it. The maze also has a
 *    mirrored detour so "just copy round 2" fails — they have to read the path.
 *
 * Grading is fully deterministic (no random / time). onComplete fires EXACTLY
 * ONCE on the final win, guarded by reportedRef. Wrong runs NEVER call
 * onComplete — the bot gives a friendly bonk and the program is kept so the
 * child can fix it. Always winnable. Preserves the original SVG, robot,
 * trail-lighting, repeat-block editor, accessibility and reduced-motion care.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#22d3ee";
const GRID = 6; // 6×6
const STEP_MS = 240;

/** Compass: 0=North, 1=East, 2=South, 3=West. Row 0 is the TOP of the grid. */
type Dir = 0 | 1 | 2 | 3;
const DX: readonly number[] = [0, 1, 0, -1];
const DY: readonly number[] = [-1, 0, 1, 0];

interface Cell {
  c: number;
  r: number;
}

// Command model -----------------------------------------------------------
type Atom = "FWD" | "LEFT" | "RIGHT";
interface AtomBlock {
  kind: "atom";
  id: number;
  op: Atom;
}
interface RepeatBlock {
  kind: "repeat";
  id: number;
  count: number; // 2..6
  body: Atom[];
}
type Block = AtomBlock | RepeatBlock;

// Level model -------------------------------------------------------------
interface Level {
  title: string;
  goalHint: string; // short, kid-readable goal for this round
  start: Cell;
  startDir: Dir;
  goal: Cell;
  walls: readonly Cell[];
  /** Earn the 3rd star for THIS round by using at most this many program
   *  BLOCKS (not flattened steps). null = no budget (sequence round). */
  blockBudget: number | null;
  /** Optional starter program (used for the debugging round). */
  seed?: () => Block[];
  /** Coaching line shown when a child wins this round under-budget vs over. */
  tidyPraise: string;
}

const sameCell = (a: Cell, b: Cell): boolean => a.c === b.c && a.r === b.r;
const isWallIn = (walls: readonly Cell[], c: number, r: number): boolean =>
  walls.some((w) => w.c === c && w.r === r);

let UID = 1;
const nextId = (): number => UID++;

// ── Three hand-authored, escalating levels ───────────────────────────────────
// All verified solvable; the staircase pattern is the loop lesson.

// R1 — short staircase (sequence). 4 hops up-stairs to the battery.
// Start (1,4) facing East. Path: FWD→LEFT→FWD→RIGHT→FWD→LEFT→FWD → goal (3,2).
// Trail cells: (1,4)→(2,4)→(2,3)→(3,3)→(3,2). Walls sit OFF the trail and
// block the tempting straight-line guesses (e.g. driving east bonks at (3,4)).
const L1_WALLS: readonly Cell[] = [
  { c: 0, r: 4 },
  { c: 3, r: 4 },
  { c: 0, r: 3 },
  { c: 1, r: 3 },
  { c: 4, r: 3 },
  { c: 1, r: 2 },
  { c: 2, r: 2 },
  { c: 4, r: 2 },
  { c: 3, r: 1 },
];

// R2 — LONG staircase (loop optimization). Same repeating motif, 5 stairs.
// Starts (0,5) facing East. The repeating unit is FWD,LEFT,FWD,RIGHT.
// One Repeat ×5 of [FWD,LEFT,FWD,RIGHT] climbs the whole staircase to (5,0).
const L2_WALLS: readonly Cell[] = (() => {
  // Block everything that ISN'T on the staircase trail so brute L-paths fail.
  const trail = new Set<string>();
  // Reconstruct the staircase cells the loop walks through:
  // (0,5)->(1,5)->(1,4)->(2,4)->(2,3)->(3,3)->(3,2)->(4,2)->(4,1)->(5,1)->(5,0)
  const cells: Cell[] = [
    { c: 0, r: 5 },
    { c: 1, r: 5 },
    { c: 1, r: 4 },
    { c: 2, r: 4 },
    { c: 2, r: 3 },
    { c: 3, r: 3 },
    { c: 3, r: 2 },
    { c: 4, r: 2 },
    { c: 4, r: 1 },
    { c: 5, r: 1 },
    { c: 5, r: 0 },
  ];
  for (const c of cells) trail.add(`${c.c},${c.r}`);
  const walls: Cell[] = [];
  // Place a few targeted walls that block the tempting straight shortcuts,
  // all OFF the trail. (Hand-picked so the maze reads clearly, not a full fill.)
  const candidates: Cell[] = [
    { c: 0, r: 4 },
    { c: 2, r: 5 },
    { c: 3, r: 4 },
    { c: 4, r: 3 },
    { c: 5, r: 2 },
    { c: 4, r: 0 },
    { c: 2, r: 2 },
    { c: 0, r: 0 },
  ];
  for (const w of candidates) if (!trail.has(`${w.c},${w.r}`)) walls.push(w);
  return walls;
})();

// R3 — DEBUG + mirrored twist. The motif is now FWD,RIGHT,FWD,LEFT (mirrored),
// so a child who memorised round 2 will turn the wrong way and bonk.
// Start (0,0) facing East, battery at (5,5).
// Correct loop body: [FWD, RIGHT, FWD, LEFT] ×5.
// (0,0)->(1,0)->(1,1)->(2,1)->(2,2)->(3,2)->(3,3)->(4,3)->(4,4)->(5,4)->(5,5)
const L3_WALLS: readonly Cell[] = (() => {
  const cells: Cell[] = [
    { c: 0, r: 0 },
    { c: 1, r: 0 },
    { c: 1, r: 1 },
    { c: 2, r: 1 },
    { c: 2, r: 2 },
    { c: 3, r: 2 },
    { c: 3, r: 3 },
    { c: 4, r: 3 },
    { c: 4, r: 4 },
    { c: 5, r: 4 },
    { c: 5, r: 5 },
  ];
  const trail = new Set(cells.map((c) => `${c.c},${c.r}`));
  const candidates: Cell[] = [
    { c: 2, r: 0 },
    { c: 3, r: 1 },
    { c: 1, r: 2 },
    { c: 4, r: 2 },
    { c: 2, r: 3 },
    { c: 5, r: 3 },
    { c: 3, r: 4 },
    { c: 0, r: 5 },
  ];
  const walls: Cell[] = [];
  for (const w of candidates) if (!trail.has(`${w.c},${w.r}`)) walls.push(w);
  return walls;
})();

const LEVELS: readonly Level[] = [
  {
    title: "Climb the stairs",
    goalHint: "Drive up the little staircase to the battery.",
    start: { c: 1, r: 4 },
    startDir: 1, // East
    goal: { c: 3, r: 2 },
    walls: L1_WALLS,
    blockBudget: null, // pure sequence round — no budget
    tidyPraise: "Nice driving!",
  },
  {
    title: "Loop the long staircase",
    goalHint:
      "A LONG staircase! Spot the repeating move and use ONE Repeat block.",
    start: { c: 0, r: 5 },
    startDir: 1, // East
    goal: { c: 5, r: 0 },
    walls: L2_WALLS,
    blockBudget: 1, // full stars only if solved with a single (Repeat) block
    tidyPraise: "One loop did all the work — that's the power of a loop!",
  },
  {
    title: "Fix the buggy bot",
    goalHint:
      "This program is ALMOST right but it bonks. Find the bug and fix it!",
    start: { c: 0, r: 0 },
    startDir: 1, // East
    goal: { c: 5, r: 5 },
    walls: L3_WALLS,
    blockBudget: 1,
    // Buggy seed: a Repeat with the WRONG turn order (LEFT,RIGHT from round 2)
    // instead of the mirrored RIGHT,LEFT this maze needs. Count is right (5).
    seed: () => [
      { kind: "repeat", id: nextId(), count: 5, body: ["FWD", "LEFT", "FWD", "RIGHT"] },
    ],
    tidyPraise: "Debugged it — you read the maze and fixed the turns!",
  },
];

const ATOM_LABEL: Record<Atom, string> = {
  FWD: "Forward",
  LEFT: "Turn Left",
  RIGHT: "Turn Right",
};
const ATOM_GLYPH: Record<Atom, string> = { FWD: "▲", LEFT: "↰", RIGHT: "↱" };
const ATOM_SPEAK: Record<Atom, string> = {
  FWD: "forward",
  LEFT: "turn left",
  RIGHT: "turn right",
};

/** Flatten the program into a linear list of atomic ops the runner executes. */
function flatten(prog: Block[]): Atom[] {
  const out: Atom[] = [];
  for (const b of prog) {
    if (b.kind === "atom") out.push(b.op);
    else for (let i = 0; i < b.count; i++) out.push(...b.body);
  }
  return out;
}

/** How many program BLOCKS the child used (the thing the budget measures). */
const blockCount = (prog: Block[]): number => prog.length;

type Outcome =
  | { type: "win" }
  | { type: "wall"; at: Cell }
  | { type: "edge"; at: Cell }
  | { type: "short" }; // ran out of moves before reaching goal

interface SimResult {
  trail: Cell[]; // cells visited in order (incl. start)
  dirs: Dir[]; // facing after each step (incl. start)
  outcome: Outcome;
}

/** Deterministically simulate the flattened program from a level's start. */
function simulate(level: Level, ops: Atom[]): SimResult {
  let { c, r } = level.start;
  let d: Dir = level.startDir;
  const trail: Cell[] = [{ c, r }];
  const dirs: Dir[] = [d];
  for (const op of ops) {
    if (op === "LEFT") d = ((d + 3) % 4) as Dir;
    else if (op === "RIGHT") d = ((d + 1) % 4) as Dir;
    else {
      const nc = c + DX[d];
      const nr = r + DY[d];
      if (nc < 0 || nc >= GRID || nr < 0 || nr >= GRID) {
        return { trail, dirs, outcome: { type: "edge", at: { c: nc, r: nr } } };
      }
      if (isWallIn(level.walls, nc, nr)) {
        return { trail, dirs, outcome: { type: "wall", at: { c: nc, r: nr } } };
      }
      c = nc;
      r = nr;
    }
    trail.push({ c, r });
    dirs.push(d);
    if (c === level.goal.c && r === level.goal.r)
      return { trail, dirs, outcome: { type: "win" } };
  }
  return { trail, dirs, outcome: { type: "short" } };
}

// Layout maths (SVG viewBox is virtual; CSS makes it responsive) -----------
const PAD = 6;
const VIEW = 240;
const TILE = (VIEW - PAD * 2) / GRID;
const cx = (c: number): number => PAD + c * TILE + TILE / 2;
const cy = (r: number): number => PAD + r * TILE + TILE / 2;
const dirDeg: Record<Dir, number> = { 0: 0, 1: 90, 2: 180, 3: 270 };

type Phase = "idle" | "running" | "won" | "failed" | "done";

export default function RobotRunner({ onComplete }: ActivityProps) {
  const [level, setLevel] = useState<number>(0);
  const [program, setProgram] = useState<Block[]>([]);
  const [repeatCount, setRepeatCount] = useState<number>(5);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<string>("");
  const [tries, setTries] = useState<number>(0);
  // Best (fewest) blocks used on a clean win this round — drives star math.
  const [roundStars, setRoundStars] = useState<number>(0);
  // Track stars earned per round so the final award reflects the whole run.
  const earnedRef = useRef<number[]>([]);

  const lvl = LEVELS[level];

  // Live bot pose during animation.
  const [pose, setPose] = useState<{ c: number; r: number; d: Dir }>({
    c: lvl.start.c,
    r: lvl.start.r,
    d: lvl.startDir,
  });
  const [litTrail, setLitTrail] = useState<Cell[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const totalSteps = useMemo<number>(() => flatten(program).length, [program]);
  const blocks = useMemo<number>(() => blockCount(program), [program]);

  const running = phase === "running";
  const won = phase === "won";
  const done = phase === "done";
  const locked = running || done;

  // Fresh round: seed (if any), park the bot at the start, clear trail.
  useEffect(() => {
    clearTimers();
    const L = LEVELS[level];
    setProgram(L.seed ? L.seed() : []);
    setPhase("idle");
    setRoundStars(0);
    setPose({ c: L.start.c, r: L.start.r, d: L.startDir });
    setLitTrail([]);
    setStatus(
      `Round ${level + 1} of ${LEVELS.length} — ${L.goalHint}`,
    );
  }, [level, clearTimers]);

  const resetBot = useCallback(() => {
    setPose({ c: lvl.start.c, r: lvl.start.r, d: lvl.startDir });
    setLitTrail([]);
  }, [lvl]);

  const addAtom = useCallback(
    (op: Atom) => {
      if (locked) return;
      setProgram((p) => [...p, { kind: "atom", id: nextId(), op }]);
      setPhase("idle");
      setStatus(`Added ${ATOM_LABEL[op]}.`);
      resetBot();
    },
    [locked, resetBot],
  );

  const addRepeat = useCallback(() => {
    if (locked) return;
    // A friendly default loop body: one staircase step.
    setProgram((p) => [
      ...p,
      {
        kind: "repeat",
        id: nextId(),
        count: repeatCount,
        body: ["FWD", "LEFT", "FWD", "RIGHT"],
      },
    ]);
    setPhase("idle");
    setStatus(`Added Repeat ×${repeatCount}.`);
    resetBot();
  }, [locked, repeatCount, resetBot]);

  const setRepeatBlockCount = useCallback(
    (id: number, count: number) => {
      if (locked) return;
      setProgram((p) =>
        p.map((b) => (b.kind === "repeat" && b.id === id ? { ...b, count } : b)),
      );
      setPhase("idle");
      resetBot();
    },
    [locked, resetBot],
  );

  const cycleRepeatBody = useCallback(
    (id: number, op: Atom) => {
      // Toggle an op in/out of the loop body (kept short & teachable).
      if (locked) return;
      setProgram((p) =>
        p.map((b) => {
          if (b.kind !== "repeat" || b.id !== id) return b;
          const body = b.body.includes(op)
            ? b.body.filter((x) => x !== op)
            : [...b.body, op];
          return { ...b, body };
        }),
      );
      setPhase("idle");
      resetBot();
    },
    [locked, resetBot],
  );

  // Move an op within a repeat body (lets the child fix turn ORDER for debug).
  const swapRepeatBody = useCallback(
    (id: number, from: number, to: number) => {
      if (locked) return;
      setProgram((p) =>
        p.map((b) => {
          if (b.kind !== "repeat" || b.id !== id) return b;
          if (to < 0 || to >= b.body.length) return b;
          const body = [...b.body];
          const [moved] = body.splice(from, 1);
          body.splice(to, 0, moved);
          return { ...b, body };
        }),
      );
      setPhase("idle");
      resetBot();
    },
    [locked, resetBot],
  );

  const removeBlock = useCallback(
    (id: number) => {
      if (locked) return;
      setProgram((p) => p.filter((b) => b.id !== id));
      setPhase("idle");
      setStatus("Removed a block.");
      resetBot();
    },
    [locked, resetBot],
  );

  const clearAll = useCallback(() => {
    clearTimers();
    setProgram([]);
    setPhase("idle");
    setStatus("Cleared. Build a fresh program!");
    resetBot();
  }, [clearTimers, resetBot]);

  const restartRun = useCallback(() => {
    // Restart the WHOLE run from round 1 (only allowed after finishing).
    clearTimers();
    reportedRef.current = false;
    earnedRef.current = [];
    setTries(0);
    setLevel(0);
  }, [clearTimers]);

  const run = useCallback(() => {
    if (locked) return;
    const ops = flatten(program);
    if (ops.length === 0) {
      setStatus("Add some blocks first, then press Run.");
      return; // never report a fail for an empty program
    }

    const sim = simulate(lvl, ops);
    clearTimers();
    resetBot();
    setPhase("running");
    setStatus("Running…");

    let i = 0; // index into trail (0 = start, already shown)
    const tick = (): void => {
      i += 1;
      if (i >= sim.trail.length) {
        const out = sim.outcome;
        if (out.type === "win") {
          setLitTrail(sim.trail);
          // ── Star math for THIS round ──────────────────────────────
          // Sequence round: a clean win = 3 stars.
          // Loop / debug rounds: 3 stars only if within the block budget
          // (i.e. you actually used the loop instead of brute-forcing).
          let stars: 1 | 2 | 3 = 3;
          const budget = lvl.blockBudget;
          if (budget !== null) {
            const used = blockCount(program);
            if (used <= budget) stars = 3;
            else if (used <= budget + 3) stars = 2;
            else stars = 1;
          }
          setRoundStars(stars);

          const last = level >= LEVELS.length - 1;
          if (last) {
            earnedRef.current = [...earnedRef.current, stars];
            setPhase("done");
            // Final award = the LOWEST round score (you must be tidy all the
            // way through for 3 stars), but a clean win is always reachable.
            const overall = Math.min(...earnedRef.current) as 1 | 2 | 3;
            setStatus(
              stars === 3
                ? `Battery reached! ${lvl.tidyPraise} ⚡`
                : `Battery reached — but a tidier loop earns more stars next time. ⚡`,
            );
            if (!reportedRef.current) {
              reportedRef.current = true;
              onComplete({
                passed: true,
                stars: overall,
                detail:
                  overall === 3
                    ? "Solved all three — clean code, great looping!"
                    : "Solved all three rounds!",
              });
            }
          } else {
            earnedRef.current = [...earnedRef.current, stars];
            setPhase("won");
            setStatus(
              stars === 3
                ? `Round ${level + 1} solved! ${lvl.tidyPraise} ⚡`
                : `Round ${level + 1} solved — but try a tidier loop for full stars. ⚡`,
            );
            // Advance to the next, harder round after a beat.
            timerRef.current = setTimeout(() => setLevel((l) => l + 1), 1400);
          }
        } else if (out.type === "wall") {
          setPhase("failed");
          setStatus("Bonk! Hit a wall. 🧱 Check your turns and try again.");
          setTries((t) => t + 1);
        } else if (out.type === "edge") {
          setPhase("failed");
          setStatus("Whoops — drove off the grid! Pull it back inside. ↩️");
          setTries((t) => t + 1);
        } else {
          setPhase("failed");
          setStatus("So close — the program ended before the battery. Add more steps!");
          setTries((t) => t + 1);
        }
        return;
      }
      const cell = sim.trail[i];
      const d = sim.dirs[i];
      setPose({ c: cell.c, r: cell.r, d });
      setLitTrail(sim.trail.slice(0, i + 1));
      timerRef.current = setTimeout(tick, STEP_MS);
    };
    // Show the very first facing immediately, then start moving.
    setPose({ c: sim.trail[0].c, r: sim.trail[0].r, d: sim.dirs[0] });
    setLitTrail([sim.trail[0]]);
    timerRef.current = setTimeout(tick, STEP_MS);
  }, [locked, program, lvl, level, clearTimers, resetBot, onComplete]);

  const celebrating = won || done;

  // Budget badge text for the program header (loop / debug rounds only).
  const budgetNote = useMemo<string | null>(() => {
    if (lvl.blockBudget === null) return null;
    return `★ Goal: solve in ${lvl.blockBudget} block${lvl.blockBudget === 1 ? "" : "s"}`;
  }, [lvl]);

  return (
    <div className="flex w-full flex-col gap-3 font-mono text-ink">
      {/* ── Round tracker + objective ── */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5" aria-label={`Round ${level + 1} of ${LEVELS.length}`}>
          {LEVELS.map((_, i) => {
            const solved = i < level || done;
            const current = i === level && !done;
            return (
              <span
                key={`rd-${i}`}
                aria-hidden="true"
                className="grid place-items-center rounded-full"
                style={{
                  height: 12,
                  width: 12,
                  background: solved
                    ? ACCENT
                    : current
                      ? "rgba(34,211,238,0.25)"
                      : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                }}
              />
            );
          })}
          <span className="ml-1 font-display tracking-tech text-ink-dim">
            {lvl.title}
          </span>
        </span>
        {budgetNote && (
          <span
            className="rounded-full px-2 py-0.5 text-[11px]"
            style={{
              color: ACCENT,
              border: `1px solid ${ACCENT}`,
              background: "rgba(34,211,238,0.08)",
            }}
          >
            {budgetNote}
          </span>
        )}
      </div>

      {/* Canvas: grid + program strip */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* ── Maze grid ── */}
        <div className="panel relative flex-1 rounded-xl p-2">
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="h-auto w-full select-none"
            role="img"
            aria-label="Robot maze grid, 6 by 6"
          >
            <defs>
              <radialGradient id="rr-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* tiles */}
            {Array.from({ length: GRID * GRID }).map((_, idx) => {
              const c = idx % GRID;
              const r = Math.floor(idx / GRID);
              const wall = isWallIn(lvl.walls, c, r);
              const lit = litTrail.some((t) => t.c === c && t.r === r);
              return (
                <rect
                  key={`t-${idx}`}
                  x={PAD + c * TILE + 1}
                  y={PAD + r * TILE + 1}
                  width={TILE - 2}
                  height={TILE - 2}
                  rx={3}
                  fill={
                    wall
                      ? "#1b2436"
                      : lit
                        ? "rgba(34,211,238,0.20)"
                        : "rgba(255,255,255,0.03)"
                  }
                  stroke={
                    wall ? "#33405c" : lit ? ACCENT : "rgba(120,140,170,0.18)"
                  }
                  strokeWidth={wall ? 1 : lit ? 1.4 : 0.8}
                />
              );
            })}

            {/* wall hatch marks */}
            {lvl.walls.map((w, i) => (
              <text
                key={`w-${i}`}
                x={cx(w.c)}
                y={cy(w.r) + 0.5}
                fontSize={TILE * 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                aria-hidden="true"
              >
                🧱
              </text>
            ))}

            {/* a soft flag marks where the bot starts this round (helps plan) */}
            <text
              x={cx(lvl.start.c)}
              y={cy(lvl.start.r) - TILE * 0.34}
              fontSize={TILE * 0.26}
              textAnchor="middle"
              dominantBaseline="central"
              opacity={0.5}
              aria-hidden="true"
            >
              🚩
            </text>

            {/* battery / goal */}
            <circle
              cx={cx(lvl.goal.c)}
              cy={cy(lvl.goal.r)}
              r={TILE * 0.46}
              fill="url(#rr-glow)"
              opacity={celebrating ? 1 : 0.55}
            />
            <text
              x={cx(lvl.goal.c)}
              y={cy(lvl.goal.r) + 0.5}
              fontSize={TILE * 0.5}
              textAnchor="middle"
              dominantBaseline="central"
              aria-label="battery goal"
            >
              🔋
            </text>

            {/* the robot */}
            <g
              style={{
                transform: `translate(${cx(pose.c)}px, ${cy(pose.r)}px) rotate(${dirDeg[pose.d]}deg)`,
                transition: running
                  ? `transform ${STEP_MS}ms ease-in-out`
                  : "transform 120ms ease-out",
              }}
            >
              <circle
                r={TILE * 0.4}
                fill="#0b1220"
                stroke={ACCENT}
                strokeWidth={1.6}
                style={
                  celebrating ? { filter: `drop-shadow(0 0 4px ${ACCENT})` } : undefined
                }
              />
              {/* facing arrow (points up = North in local space) */}
              <polygon
                points={`0,${-TILE * 0.28} ${TILE * 0.16},${TILE * 0.12} ${-TILE * 0.16},${TILE * 0.12}`}
                fill={ACCENT}
              />
              <circle cx={0} cy={TILE * 0.02} r={TILE * 0.07} fill="#0b1220" />
            </g>
          </svg>
        </div>

        {/* ── Program strip ── */}
        <div className="flex w-full flex-col gap-2 sm:w-[44%]">
          <div className="flex items-center justify-between text-xs text-ink-dim">
            <span className="font-display tracking-tech">PROGRAM</span>
            <span aria-hidden="true">
              {blocks} block{blocks === 1 ? "" : "s"} · {totalSteps} steps
            </span>
          </div>
          <ol
            className="panel flex max-h-[150px] min-h-[88px] flex-col gap-1 overflow-y-auto rounded-xl p-2 text-sm sm:max-h-[230px]"
            aria-label="Program blocks"
          >
            {program.length === 0 && (
              <li className="grid flex-1 place-items-center py-4 text-center text-xs text-ink-faint">
                Tap commands below to add steps →
              </li>
            )}
            {program.map((b, i) =>
              b.kind === "atom" ? (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-panel-2/60 px-2 py-1"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-ink-faint">{i + 1}</span>
                    <span aria-hidden="true">{ATOM_GLYPH[b.op]}</span>
                    <span>{ATOM_LABEL[b.op]}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeBlock(b.id)}
                    disabled={locked}
                    aria-label={`Remove step ${i + 1}, ${ATOM_LABEL[b.op]}`}
                    className="rounded px-1 text-ink-faint hover:text-neon-red disabled:opacity-40"
                  >
                    ✕
                  </button>
                </li>
              ) : (
                <li
                  key={b.id}
                  className="rounded-lg border px-2 py-1.5"
                  style={{ borderColor: ACCENT, background: "rgba(34,211,238,0.07)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="text-ink-faint">{i + 1}</span>
                      <span style={{ color: ACCENT }}>↻ Repeat</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {[2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRepeatBlockCount(b.id, n)}
                          disabled={locked}
                          aria-label={`Repeat ${n} times`}
                          aria-pressed={b.count === n}
                          className="h-5 w-5 rounded text-xs disabled:opacity-40"
                          style={
                            b.count === n
                              ? { background: ACCENT, color: "#05070d" }
                              : { border: "1px solid var(--color-line, #33405c)", color: "inherit" }
                          }
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => removeBlock(b.id)}
                        disabled={locked}
                        aria-label={`Remove repeat block, step ${i + 1}`}
                        className="rounded px-1 text-ink-faint hover:text-neon-red disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                  {/* loop body — toggle which moves repeat, in order */}
                  <div className="mt-1 flex flex-wrap items-center gap-1 pl-4 text-xs">
                    <span className="text-ink-faint">do:</span>
                    {(["FWD", "LEFT", "RIGHT"] as Atom[]).map((op) => {
                      const on = b.body.includes(op);
                      return (
                        <button
                          key={op}
                          type="button"
                          onClick={() => cycleRepeatBody(b.id, op)}
                          disabled={locked}
                          aria-pressed={on}
                          aria-label={`${on ? "Remove" : "Add"} ${ATOM_LABEL[op]} in loop`}
                          className="rounded px-1.5 py-0.5 disabled:opacity-40"
                          style={
                            on
                              ? { background: "rgba(34,211,238,0.25)", color: ACCENT }
                              : { border: "1px solid var(--color-line, #33405c)", color: "var(--color-ink-dim, #9aa6bd)" }
                          }
                        >
                          {ATOM_GLYPH[op]}
                        </button>
                      );
                    })}
                  </div>
                  {/* ordered loop body with reorder arrows (lets kids fix turn ORDER) */}
                  {b.body.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1 pl-4 text-xs">
                      <span className="text-ink-faint">order:</span>
                      {b.body.map((op, j) => (
                        <span
                          key={`${b.id}-body-${j}`}
                          className="inline-flex items-center gap-0.5 rounded border border-line px-1 py-0.5"
                        >
                          <button
                            type="button"
                            onClick={() => swapRepeatBody(b.id, j, j - 1)}
                            disabled={locked || j === 0}
                            aria-label={`Move ${ATOM_SPEAK[op]} earlier`}
                            className="text-ink-faint hover:text-ink disabled:opacity-25"
                          >
                            ‹
                          </button>
                          <span aria-label={ATOM_SPEAK[op]}>{ATOM_GLYPH[op]}</span>
                          <button
                            type="button"
                            onClick={() => swapRepeatBody(b.id, j, j + 1)}
                            disabled={locked || j === b.body.length - 1}
                            aria-label={`Move ${ATOM_SPEAK[op]} later`}
                            className="text-ink-faint hover:text-ink disabled:opacity-25"
                          >
                            ›
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ),
            )}
          </ol>
        </div>
      </div>

      {/* status line */}
      <div
        className="rounded-lg px-3 py-2 text-center text-sm"
        role="status"
        aria-live="polite"
        style={{
          background: celebrating ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${celebrating ? ACCENT : "var(--color-line, #33405c)"}`,
          color: celebrating ? ACCENT : "var(--color-ink-dim, #9aa6bd)",
          boxShadow: celebrating ? `0 0 14px ${ACCENT}55` : undefined,
        }}
      >
        {status}
        {(won || done) && (
          <span className="ml-1" aria-hidden="true">
            {"⭐".repeat(roundStars)}
          </span>
        )}
      </div>

      {/* palette */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
          {(["FWD", "LEFT", "RIGHT"] as Atom[]).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => addAtom(op)}
              disabled={locked}
              aria-label={`Add ${ATOM_LABEL[op]} block`}
              className="rounded-lg border border-line bg-panel/60 px-2 py-2 text-sm text-ink-dim transition hover:text-ink disabled:opacity-40"
            >
              <span aria-hidden="true" className="mr-1">
                {ATOM_GLYPH[op]}
              </span>
              {ATOM_LABEL[op]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addRepeat}
            disabled={locked}
            aria-label={`Add Repeat block, ${repeatCount} times`}
            className="flex-1 rounded-lg px-2 py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: "rgba(34,211,238,0.15)", color: ACCENT, border: `1px solid ${ACCENT}` }}
          >
            ↻ Add Repeat ×{repeatCount}
          </button>
          <div
            className="flex items-center gap-1 rounded-lg border border-line bg-panel/60 px-1.5 py-1"
            role="group"
            aria-label="Default repeat count"
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRepeatCount(n)}
                aria-label={`Default repeat ${n} times`}
                aria-pressed={repeatCount === n}
                className="h-6 w-6 rounded text-xs"
                style={
                  repeatCount === n
                    ? { background: ACCENT, color: "#05070d" }
                    : { color: "var(--color-ink-dim, #9aa6bd)" }
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* run / reset */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={locked}
          aria-label="Run the program"
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
        >
          {running ? "Running…" : done ? "Done ✓" : "Run ▶"}
        </button>
        {done ? (
          <button
            type="button"
            onClick={restartRun}
            aria-label="Play all rounds again from the start"
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm text-ink-dim"
          >
            Play again 🔄
          </button>
        ) : (
          <button
            type="button"
            onClick={clearAll}
            disabled={locked}
            aria-label="Clear the program and reset the robot"
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm text-ink-dim disabled:opacity-40"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
