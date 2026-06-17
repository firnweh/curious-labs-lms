"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Robot Runner — a CODING activity (sequencing + loops + debugging).
 * Drive the bot across a 6×6 maze to the battery by assembling a program of
 * command blocks. A REPEAT block makes the staircase solution short — that's
 * the loop lesson. Single fixed, deterministic, winnable level.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#22d3ee";
const GRID = 6; // 6×6
const STEP_MS = 260;

/** Compass: 0=North, 1=East, 2=South, 3=West. Row 0 is the TOP of the grid. */
type Dir = 0 | 1 | 2 | 3;
const DX: readonly number[] = [0, 1, 0, -1];
const DY: readonly number[] = [-1, 0, 1, 0];

interface Cell {
  c: number;
  r: number;
}

// Fixed level -------------------------------------------------------------
const START: Cell = { c: 0, r: 5 };
const START_DIR: Dir = 1; // facing East
const GOAL: Cell = { c: 5, r: 0 };
// Walls block the naive straight L-paths, nudging toward the staircase + loop.
// All walls sit OFF the intended staircase trail; start & goal stay clear.
const WALLS: readonly Cell[] = [
  { c: 2, r: 5 },
  { c: 3, r: 5 },
  { c: 4, r: 5 },
  { c: 5, r: 5 },
  { c: 5, r: 4 },
  { c: 5, r: 3 },
  { c: 5, r: 2 },
  { c: 0, r: 0 },
  { c: 1, r: 0 },
  { c: 2, r: 0 },
  { c: 3, r: 0 },
];

const isWall = (c: number, r: number): boolean =>
  WALLS.some((w) => w.c === c && w.r === r);

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
  count: number; // 2..5
  body: Atom[];
}
type Block = AtomBlock | RepeatBlock;

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

/** Deterministically simulate the flattened program from the fixed start. */
function simulate(ops: Atom[]): SimResult {
  let { c, r } = START;
  let d: Dir = START_DIR;
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
      if (isWall(nc, nr)) {
        return { trail, dirs, outcome: { type: "wall", at: { c: nc, r: nr } } };
      }
      c = nc;
      r = nr;
    }
    trail.push({ c, r });
    dirs.push(d);
    if (c === GOAL.c && r === GOAL.r) return { trail, dirs, outcome: { type: "win" } };
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

type Phase = "idle" | "running" | "won" | "failed";

let UID = 1;
const nextId = (): number => UID++;

export default function RobotRunner({ onComplete }: ActivityProps) {
  const [program, setProgram] = useState<Block[]>([]);
  const [repeatCount, setRepeatCount] = useState<number>(3);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<string>("Build a program, then press Run.");
  const [tries, setTries] = useState<number>(0);

  // Live bot pose during animation.
  const [pose, setPose] = useState<{ c: number; r: number; d: Dir }>({
    c: START.c,
    r: START.r,
    d: START_DIR,
  });
  const [litTrail, setLitTrail] = useState<Cell[]>([]);

  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solvedRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const totalSteps = useMemo<number>(() => flatten(program).length, [program]);

  const resetBot = useCallback(() => {
    setPose({ c: START.c, r: START.r, d: START_DIR });
    setLitTrail([]);
  }, []);

  const addAtom = useCallback(
    (op: Atom) => {
      if (phase === "running") return;
      setProgram((p) => [...p, { kind: "atom", id: nextId(), op }]);
      setPhase("idle");
      setStatus(`Added ${ATOM_LABEL[op]}.`);
      resetBot();
    },
    [phase, resetBot],
  );

  const addRepeat = useCallback(() => {
    if (phase === "running") return;
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
  }, [phase, repeatCount, resetBot]);

  const setRepeatBlockCount = useCallback(
    (id: number, count: number) => {
      if (phase === "running") return;
      setProgram((p) =>
        p.map((b) => (b.kind === "repeat" && b.id === id ? { ...b, count } : b)),
      );
      setPhase("idle");
      resetBot();
    },
    [phase, resetBot],
  );

  const cycleRepeatBody = useCallback(
    (id: number, op: Atom) => {
      // Toggle an op in/out of the loop body (kept short & teachable).
      if (phase === "running") return;
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
    [phase, resetBot],
  );

  const removeBlock = useCallback(
    (id: number) => {
      if (phase === "running") return;
      setProgram((p) => p.filter((b) => b.id !== id));
      setPhase("idle");
      setStatus("Removed a block.");
      resetBot();
    },
    [phase, resetBot],
  );

  const clearAll = useCallback(() => {
    clearTimers();
    setProgram([]);
    setPhase("idle");
    setStatus("Cleared. Build a fresh program!");
    resetBot();
  }, [clearTimers, resetBot]);

  const run = useCallback(() => {
    if (phase === "running") return;
    const ops = flatten(program);
    if (ops.length === 0) {
      setStatus("Add some blocks first, then press Run.");
      onComplete({ passed: false, detail: "Your program is empty — add a few blocks!" });
      return;
    }

    const sim = simulate(ops);
    clearTimers();
    resetBot();
    setPhase("running");
    setStatus("Running…");

    let i = 0; // index into trail (0 = start, already shown)
    const tick = (): void => {
      i += 1;
      if (i >= sim.trail.length) {
        // Animation finished — resolve outcome.
        const out = sim.outcome;
        if (out.type === "win") {
          setLitTrail(sim.trail);
          setPhase("won");
          setStatus("Battery reached! Nice driving. ⚡");
          if (!solvedRef.current) {
            solvedRef.current = true;
            onComplete({
              passed: true,
              stars: 3,
              detail: tries <= 2 ? "Solved it!" : "Solved it — great debugging!",
            });
          }
        } else if (out.type === "wall") {
          setPhase("failed");
          setStatus("Bonk! Hit a wall. 🧱 Adjust your turns and try again.");
          setTries((t) => t + 1);
          onComplete({ passed: false, detail: "Bonk! A wall stopped the bot — fix the path." });
        } else if (out.type === "edge") {
          setPhase("failed");
          setStatus("Whoops — drove off the grid! Pull it back inside.");
          setTries((t) => t + 1);
          onComplete({ passed: false, detail: "The bot drove off the grid — try fewer Forwards." });
        } else {
          setPhase("failed");
          setStatus("So close — the program ended before the battery. Add more steps!");
          setTries((t) => t + 1);
          onComplete({ passed: false, detail: "Program ended early — the bot didn't reach the battery." });
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
  }, [phase, program, clearTimers, resetBot, onComplete, tries]);

  const running = phase === "running";
  const won = phase === "won";

  return (
    <div className="flex w-full flex-col gap-3 font-mono text-ink">
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
              const wall = isWall(c, r);
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
                    wall
                      ? "#33405c"
                      : lit
                        ? ACCENT
                        : "rgba(120,140,170,0.18)"
                  }
                  strokeWidth={wall ? 1 : lit ? 1.4 : 0.8}
                />
              );
            })}

            {/* wall hatch marks */}
            {WALLS.map((w, i) => (
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

            {/* battery / goal */}
            <circle
              cx={cx(GOAL.c)}
              cy={cy(GOAL.r)}
              r={TILE * 0.46}
              fill="url(#rr-glow)"
              opacity={won ? 1 : 0.55}
            />
            <text
              x={cx(GOAL.c)}
              y={cy(GOAL.r) + 0.5}
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
                style={won ? { filter: `drop-shadow(0 0 4px ${ACCENT})` } : undefined}
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
            <span aria-hidden="true">{totalSteps} steps</span>
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
                    disabled={running}
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
                      {[2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRepeatBlockCount(b.id, n)}
                          disabled={running}
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
                        disabled={running}
                        aria-label={`Remove repeat block, step ${i + 1}`}
                        className="rounded px-1 text-ink-faint hover:text-neon-red disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                  {/* loop body — toggle which moves repeat */}
                  <div className="mt-1 flex flex-wrap items-center gap-1 pl-4 text-xs">
                    <span className="text-ink-faint">do:</span>
                    {(["FWD", "LEFT", "RIGHT"] as Atom[]).map((op) => {
                      const on = b.body.includes(op);
                      return (
                        <button
                          key={op}
                          type="button"
                          onClick={() => cycleRepeatBody(b.id, op)}
                          disabled={running}
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
                    <span className="text-ink-faint">
                      → {b.body.map((op) => ATOM_SPEAK[op]).join(", ") || "empty"}
                    </span>
                  </div>
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
          background: won ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          color: won ? ACCENT : "var(--color-ink-dim, #9aa6bd)",
          boxShadow: won ? `0 0 14px ${ACCENT}55` : undefined,
        }}
      >
        {status}
      </div>

      {/* palette */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
          {(["FWD", "LEFT", "RIGHT"] as Atom[]).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => addAtom(op)}
              disabled={running}
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
            disabled={running}
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
            {[2, 3, 4, 5].map((n) => (
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
          disabled={running}
          aria-label="Run the program"
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
        >
          {running ? "Running…" : "Run ▶"}
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={running}
          aria-label="Clear the program and reset the robot"
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm text-ink-dim disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
