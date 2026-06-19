"use client";
// Learning goal: pathfinding search — see how BFS floods every frontier ring
// while A*'s Manhattan heuristic explores far fewer cells to the same shortest
// route, then encode that route as a sequence of move commands for the bot.
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#22d3ee";
const N = 8;

/** A cell on the warehouse grid. Row 0 is the top. */
interface Cell {
  r: number;
  c: number;
}

const START: Cell = { r: 1, c: 1 };
const GOAL: Cell = { r: 6, c: 6 };

/**
 * Fixed obstacle field. Two staggered barriers force an S-curve so the
 * shortest path winds, and so BFS floods a big area while A* drives straight
 * at the goal. Verified offline: BFS explores 41 cells, A* explores 22, both
 * find the same 10-step path. The arrow palette below holds exactly D×5, R×5.
 */
const WALLS: readonly Cell[] = [
  { r: 0, c: 4 }, { r: 1, c: 4 }, { r: 2, c: 4 }, { r: 3, c: 4 },
  { r: 4, c: 2 }, { r: 5, c: 2 }, { r: 6, c: 2 }, { r: 7, c: 2 },
  { r: 5, c: 5 }, { r: 6, c: 5 },
  { r: 2, c: 6 }, { r: 3, c: 6 },
] as const;

type Algo = "bfs" | "astar";
type Dir = "U" | "D" | "L" | "R";
type Phase = "search" | "build";

const key = (r: number, c: number): number => r * N + c;
const inBounds = (r: number, c: number): boolean =>
  r >= 0 && r < N && c >= 0 && c < N;

const WALL_SET: ReadonlySet<number> = new Set(WALLS.map((w) => key(w.r, w.c)));
const isWall = (r: number, c: number): boolean => WALL_SET.has(key(r, c));

/** Deterministic neighbour order: up, down, left, right. */
const STEPS: readonly { dr: number; dc: number; dir: Dir }[] = [
  { dr: -1, dc: 0, dir: "U" },
  { dr: 1, dc: 0, dir: "D" },
  { dr: 0, dc: -1, dir: "L" },
  { dr: 0, dc: 1, dir: "R" },
] as const;

function neighbours(r: number, c: number): Cell[] {
  const out: Cell[] = [];
  for (const s of STEPS) {
    const nr = r + s.dr;
    const nc = c + s.dc;
    if (inBounds(nr, nc) && !isWall(nr, nc)) out.push({ r: nr, c: nc });
  }
  return out;
}

const manhattan = (r: number, c: number): number =>
  Math.abs(r - GOAL.r) + Math.abs(c - GOAL.c);

/** A full search precomputed as an ordered list of expansions + parent links. */
interface SearchRun {
  order: number[];
  parent: Map<number, number>;
  path: number[];
}

function runSearch(algo: Algo): SearchRun {
  const parent = new Map<number, number>();
  const order: number[] = [];
  const startId = key(START.r, START.c);

  if (algo === "bfs") {
    const queue: Cell[] = [START];
    const seen = new Set<number>([startId]);
    while (queue.length > 0) {
      const cur = queue.shift() as Cell;
      order.push(key(cur.r, cur.c));
      if (cur.r === GOAL.r && cur.c === GOAL.c) break;
      for (const nb of neighbours(cur.r, cur.c)) {
        const id = key(nb.r, nb.c);
        if (!seen.has(id)) {
          seen.add(id);
          parent.set(id, key(cur.r, cur.c));
          queue.push(nb);
        }
      }
    }
  } else {
    const g = new Map<number, number>([[startId, 0]]);
    const open: { cell: Cell; f: number; seq: number }[] = [
      { cell: START, f: manhattan(START.r, START.c), seq: 0 },
    ];
    let seq = 1;
    const closed = new Set<number>();
    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f || a.seq - b.seq);
      const cur = open.shift() as { cell: Cell; f: number; seq: number };
      const cid = key(cur.cell.r, cur.cell.c);
      if (closed.has(cid)) continue;
      closed.add(cid);
      order.push(cid);
      if (cur.cell.r === GOAL.r && cur.cell.c === GOAL.c) break;
      for (const nb of neighbours(cur.cell.r, cur.cell.c)) {
        const nid = key(nb.r, nb.c);
        const ng = (g.get(cid) ?? 0) + 1;
        if (!g.has(nid) || ng < (g.get(nid) as number)) {
          g.set(nid, ng);
          parent.set(nid, cid);
          open.push({ cell: nb, f: ng + manhattan(nb.r, nb.c), seq: seq++ });
        }
      }
    }
  }

  const path: number[] = [];
  let node: number | undefined = key(GOAL.r, GOAL.c);
  while (node !== undefined) {
    path.push(node);
    node = parent.get(node);
  }
  path.reverse();
  return { order, parent, path };
}

const BFS_RUN: SearchRun = runSearch("bfs");
const ASTAR_RUN: SearchRun = runSearch("astar");

/** The arrow sequence that retraces the shortest path, e.g. ["D","D","R",…]. */
const SOLUTION: Dir[] = (() => {
  const out: Dir[] = [];
  const { path } = ASTAR_RUN;
  for (let i = 1; i < path.length; i++) {
    const pr = Math.floor(path[i - 1] / N);
    const pc = path[i - 1] % N;
    const cr = Math.floor(path[i] / N);
    const cc = path[i] % N;
    if (cr < pr) out.push("U");
    else if (cr > pr) out.push("D");
    else if (cc < pc) out.push("L");
    else out.push("R");
  }
  return out;
})();

const PATH_STEPS = SOLUTION.length;
const GLYPH: Record<Dir, string> = { U: "↑", D: "↓", L: "←", R: "→" };
const DELTA: Record<Dir, { dr: number; dc: number }> = {
  U: { dr: -1, dc: 0 },
  D: { dr: 1, dc: 0 },
  L: { dr: 0, dc: -1 },
  R: { dr: 0, dc: 1 },
};

export default function DeliveryBotPathfinder({ onComplete }: ActivityProps) {
  const [algo, setAlgo] = useState<Algo>("bfs");
  // How many cells of the current algorithm's order are revealed.
  const [stepCount, setStepCount] = useState<number>(0);
  // Final explored counts captured once each algorithm reaches the goal.
  const [bfsDone, setBfsDone] = useState<number | null>(null);
  const [astarDone, setAstarDone] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("search");

  // Build phase: arrows dropped into the command strip (indices into a palette).
  const [strip, setStrip] = useState<Dir[]>([]);
  const [used, setUsed] = useState<boolean[]>(() => SOLUTION.map(() => false));
  const [bot, setBot] = useState<Cell | null>(null);
  const [collision, setCollision] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Tap Expand Next to watch BFS flood the grid.",
  );
  const [won, setWon] = useState<boolean>(false);
  const firedRef = useRef<boolean>(false);

  const run: SearchRun = algo === "bfs" ? BFS_RUN : ASTAR_RUN;
  const reached =
    stepCount > 0 && run.order[stepCount - 1] === key(GOAL.r, GOAL.c);
  const explored = stepCount;

  // The palette of arrows the learner drags from (exactly enough to win).
  const palette = useMemo<Dir[]>(() => SOLUTION.slice(), []);

  const expandNext = useCallback((): void => {
    setStepCount((prev) => {
      if (prev >= run.order.length) return prev;
      const next = prev + 1;
      const justReached = run.order[next - 1] === key(GOAL.r, GOAL.c);
      if (justReached) {
        const label = algo === "bfs" ? "BFS" : "A*";
        if (algo === "bfs") setBfsDone(next);
        else setAstarDone(next);
        setStatus(
          `${label} reached the package after exploring ${next} cells — the shortest path is ${PATH_STEPS} steps.`,
        );
      } else {
        setStatus(
          algo === "bfs"
            ? "BFS expands in flood rings — every direction at once."
            : "A* leans toward the goal using its Manhattan guess.",
        );
      }
      return next;
    });
  }, [algo, run.order]);

  const switchAlgo = useCallback(
    (next: Algo): void => {
      setAlgo(next);
      setStepCount(0);
      setStatus(
        next === "bfs"
          ? "BFS: tap Expand Next and watch it flood evenly."
          : "A*: tap Expand Next — notice it heads straight for the box.",
      );
    },
    [],
  );

  const goBuild = useCallback((): void => {
    setPhase("build");
    setBot(null);
    setCollision(false);
    setStatus("Drag arrows into the strip to retrace the route, then Run.");
  }, []);

  const addArrow = useCallback(
    (idx: number): void => {
      if (used[idx] || won) return;
      setUsed((prev) => {
        const copy = prev.slice();
        copy[idx] = true;
        return copy;
      });
      setStrip((prev) => [...prev, palette[idx]]);
      setBot(null);
      setCollision(false);
    },
    [used, won, palette],
  );

  const clearStrip = useCallback((): void => {
    setStrip([]);
    setUsed(SOLUTION.map(() => false));
    setBot(null);
    setCollision(false);
    setStatus("Strip cleared — drop arrows again.");
  }, []);

  const reset = useCallback((): void => {
    setAlgo("bfs");
    setStepCount(0);
    setBfsDone(null);
    setAstarDone(null);
    setPhase("search");
    setStrip([]);
    setUsed(SOLUTION.map(() => false));
    setBot(null);
    setCollision(false);
    setWon(false);
    firedRef.current = false;
    setStatus("Tap Expand Next to watch BFS flood the grid.");
  }, []);

  const runStrip = useCallback((): void => {
    if (won) return;
    // Walk the bot deterministically; flag the first wall/out-of-bounds hit.
    let pos: Cell = { ...START };
    let crashed = false;
    for (const dir of strip) {
      const d = DELTA[dir];
      const nr = pos.r + d.dr;
      const nc = pos.c + d.dc;
      if (!inBounds(nr, nc) || isWall(nr, nc)) {
        crashed = true;
        setBot({ r: nr, c: nc });
        break;
      }
      pos = { r: nr, c: nc };
    }
    if (crashed) {
      setCollision(true);
      setStatus("Crash! An arrow drove the bot into a wall. Adjust the strip.");
      onComplete({ passed: false, detail: "An arrow hit a wall — re-route it." });
      return;
    }
    setBot(pos);
    setCollision(false);
    const atGoal = pos.r === GOAL.r && pos.c === GOAL.c;
    const bothSearched = bfsDone !== null && astarDone !== null;
    if (atGoal && bothSearched && !firedRef.current) {
      firedRef.current = true;
      setWon(true);
      setStatus("Delivered! A* explored fewer cells AND your route was valid.");
      onComplete({
        passed: true,
        stars: 3,
        detail: `BFS explored ${bfsDone}, A* explored ${astarDone} — same ${PATH_STEPS}-step path.`,
      });
      return;
    }
    if (atGoal && !bothSearched) {
      setStatus("Route works! But run BOTH algorithms in the search phase first.");
      onComplete({ passed: false, detail: "Try both BFS and A* before delivering." });
      return;
    }
    setStatus("Almost — the bot stopped short of the package. Add or fix arrows.");
    onComplete({ passed: false, detail: "The route did not reach the package yet." });
  }, [won, strip, bfsDone, astarDone, onComplete]);

  // ----- derived display -----------------------------------------------------
  const exploredSet = useMemo<Set<number>>(
    () => new Set(run.order.slice(0, stepCount)),
    [run.order, stepCount],
  );
  const pathSet = useMemo<Set<number>>(
    () => (reached ? new Set(run.path) : new Set<number>()),
    [reached, run.path],
  );
  const frontierId =
    stepCount > 0 ? run.order[stepCount - 1] : -1;

  const cellFill = useCallback(
    (r: number, c: number): string => {
      const id = key(r, c);
      if (isWall(r, c)) return "#1b2540";
      if (r === GOAL.r && c === GOAL.c) return reached ? ACCENT : "#0e2733";
      if (r === START.r && c === START.c) return "#143a52";
      if (pathSet.has(id)) return ACCENT;
      if (id === frontierId) return "#2dd4bf";
      if (exploredSet.has(id)) return "#103b4a";
      return "#0b1322";
    },
    [exploredSet, pathSet, frontierId, reached],
  );

  const bothDone = bfsDone !== null && astarDone !== null;
  const maxExplored = Math.max(bfsDone ?? 0, astarDone ?? 0, 1);

  const arrowStyle: CSSProperties = {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--color-line, #1e2a44)",
    background: "rgba(11,16,32,0.6)",
    color: "#cbd3ef",
    touchAction: "manipulation",
  };

  return (
    <div className="flex w-full flex-col gap-3" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g8deliverypathfinder-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g8deliverypathfinder-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes g8deliverypathfinder-cheer {
          0% { transform: translateY(6px) scale(0.9); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>

      {/* Warehouse grid */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={
          won ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` } : undefined
        }
      >
        <svg
          viewBox="0 0 80 80"
          className="block aspect-square w-full"
          role="img"
          aria-label="Eight by eight warehouse grid with a start tile, a package goal tile, and walls. Explored cells and the shortest path are highlighted."
        >
          {Array.from({ length: N }).map((_, r) =>
            Array.from({ length: N }).map((__, c) => {
              const x = c * 10;
              const y = r * 10;
              const id = key(r, c);
              const pulsing = id === frontierId && !reached;
              return (
                <rect
                  key={id}
                  x={x + 0.5}
                  y={y + 0.5}
                  width={9}
                  height={9}
                  rx={1.2}
                  fill={cellFill(r, c)}
                  stroke="#070b16"
                  strokeWidth={0.4}
                  style={
                    pulsing
                      ? {
                          animation:
                            "g8deliverypathfinder-pulse 0.9s ease-in-out infinite",
                        }
                      : undefined
                  }
                />
              );
            }),
          )}

          {/* labels + bot */}
          {(() => {
            const marks: ReactNode[] = [];
            marks.push(
              <text
                key="start"
                x={START.c * 10 + 5}
                y={START.r * 10 + 7.2}
                textAnchor="middle"
                fontSize={5}
                fill="#7dd3fc"
              >
                🤖
              </text>,
            );
            marks.push(
              <text
                key="goal"
                x={GOAL.c * 10 + 5}
                y={GOAL.r * 10 + 7.2}
                textAnchor="middle"
                fontSize={5}
                fill={reached ? "#05070d" : "#cbd3ef"}
              >
                📦
              </text>,
            );
            if (bot) {
              marks.push(
                <text
                  key="bot"
                  x={bot.c * 10 + 5}
                  y={bot.r * 10 + 7.4}
                  textAnchor="middle"
                  fontSize={5.5}
                  fill={collision ? "#f87171" : "#7dd3fc"}
                  style={{ animation: "g8deliverypathfinder-pop 0.3s ease" }}
                >
                  {collision ? "💥" : "🤖"}
                </text>,
              );
            }
            return marks;
          })()}
        </svg>

        {/* status line */}
        <div
          className="mt-1 rounded-md px-2 py-1 text-center text-xs"
          role="status"
          aria-live="polite"
          style={{
            color: won ? "#05070d" : "#9aa6cf",
            background: won ? ACCENT : "transparent",
            minHeight: 28,
          }}
        >
          {won ? "✨🎉 Package delivered! ⭐⭐⭐" : status}
        </div>
      </div>

      {/* SEARCH PHASE controls */}
      {phase === "search" && (
        <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
          {/* algorithm toggle */}
          <div
            className="flex gap-2"
            role="group"
            aria-label="Choose the search algorithm"
          >
            {(["bfs", "astar"] as const).map((a) => {
              const active = algo === a;
              return (
                <button
                  key={a}
                  type="button"
                  onPointerDown={() => switchAlgo(a)}
                  aria-pressed={active}
                  aria-label={a === "bfs" ? "Use BFS" : "Use A star"}
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm font-medium"
                  style={{
                    background: active ? ACCENT : "rgba(11,16,32,0.6)",
                    color: active ? "#05070d" : "#cbd3ef",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: active ? ACCENT : "var(--color-line, #1e2a44)",
                  }}
                >
                  {a === "bfs" ? "BFS" : "A* (heuristic)"}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-dim">
              cells explored:{" "}
              <span style={{ color: ACCENT }} className="tabular-nums">
                {explored}
              </span>
            </span>
            {reached && (
              <span style={{ color: ACCENT }} className="font-medium">
                shortest path = {PATH_STEPS} steps
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={expandNext}
              disabled={stepCount >= run.order.length}
              className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: ACCENT, color: "#05070d", touchAction: "manipulation" }}
              aria-label="Expand the next cell the algorithm visits"
            >
              {reached ? "Goal reached ✓" : "Expand Next →"}
            </button>
            <button
              type="button"
              onPointerDown={() => switchAlgo(algo)}
              className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs font-medium text-ink-dim"
              aria-label="Replay this algorithm from the start"
            >
              Replay
            </button>
          </div>

          {/* explored comparison bars */}
          <div className="flex flex-col gap-1.5 text-xs">
            <ComparisonBar
              label="BFS"
              value={bfsDone}
              max={maxExplored}
              color="#64748b"
            />
            <ComparisonBar
              label="A*"
              value={astarDone}
              max={maxExplored}
              color={ACCENT}
            />
            {bothDone && (astarDone as number) < (bfsDone as number) && (
              <p className="text-[11px]" style={{ color: ACCENT }}>
                A* explored {(bfsDone as number) - (astarDone as number)} fewer cells
                for the same route — a good heuristic pays off.
              </p>
            )}
          </div>

          <button
            type="button"
            onPointerDown={goBuild}
            disabled={!bothDone}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            style={{
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: ACCENT,
              background: "transparent",
              color: ACCENT,
            }}
            aria-label="Continue to building the route"
          >
            {bothDone
              ? "Build the route →"
              : "Run BOTH algorithms first to continue"}
          </button>
        </div>
      )}

      {/* BUILD PHASE controls */}
      {phase === "build" && (
        <div className="panel flex flex-col gap-3 rounded-xl p-3">
          <p className="text-[11px] leading-tight text-ink-faint">
            Drag the arrows into the command strip so the bot retraces the route
            from 🤖 to 📦. The palette holds exactly enough arrows.
          </p>

          {/* command strip */}
          <div
            className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg p-2"
            role="list"
            aria-label="Command strip"
            style={{
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: collision ? "#f87171" : "var(--color-line, #1e2a44)",
              background: "rgba(7,11,22,0.6)",
            }}
          >
            {strip.length === 0 && (
              <span className="text-xs text-ink-faint">
                empty — tap arrows below to add them
              </span>
            )}
            {strip.map((d, i) => (
              <span
                key={i}
                role="listitem"
                className="grid h-7 w-7 place-items-center rounded-md text-sm tabular-nums"
                style={{
                  background: ACCENT,
                  color: "#05070d",
                  animation: "g8deliverypathfinder-pop 0.25s ease",
                }}
                aria-label={`step ${i + 1}: ${d}`}
              >
                {GLYPH[d]}
              </span>
            ))}
          </div>

          {/* palette */}
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Arrow palette"
          >
            {palette.map((d, i) => (
              <button
                key={i}
                type="button"
                onPointerDown={() => addArrow(i)}
                disabled={used[i] || won}
                aria-label={`Add ${d} arrow to the strip`}
                className="grid h-9 w-9 place-items-center rounded-lg text-base disabled:opacity-25"
                style={arrowStyle}
              >
                <span aria-hidden="true">{GLYPH[d]}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={runStrip}
              disabled={strip.length === 0 || won}
              className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: ACCENT, color: "#05070d", touchAction: "manipulation" }}
              aria-label="Run the command strip and walk the bot"
            >
              {won ? "Delivered ✓" : "▶ Run"}
            </button>
            <button
              type="button"
              onPointerDown={clearStrip}
              disabled={won}
              className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs font-medium text-ink-dim disabled:opacity-50"
              aria-label="Clear the command strip"
            >
              Clear
            </button>
            <button
              type="button"
              onPointerDown={() => setPhase("search")}
              className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs font-medium text-ink-dim"
              aria-label="Back to the search phase"
            >
              ← Search
            </button>
          </div>

          {won && (
            <p
              className="text-center text-sm font-medium"
              style={{ color: ACCENT, animation: "g8deliverypathfinder-cheer 0.4s ease" }}
            >
              ✨🎉 ⭐⭐⭐
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ink-faint">
          {phase === "search" ? "Phase 1 · search" : "Phase 2 · build & run"}
        </span>
        <button
          type="button"
          onPointerDown={reset}
          className="rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-dim"
          aria-label="Reset the whole lab"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function ComparisonBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number | null;
  max: number;
  color: string;
}) {
  const pct = value === null ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-ink-dim">{label}</span>
      <span
        className="relative h-3 flex-1 overflow-hidden rounded-full"
        style={{ background: "rgba(11,16,32,0.8)" }}
        role="img"
        aria-label={
          value === null
            ? `${label} not run yet`
            : `${label} explored ${value} cells`
        }
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: color, transition: "width 300ms ease" }}
        />
      </span>
      <span className="w-6 shrink-0 text-right tabular-nums text-ink-faint">
        {value === null ? "—" : value}
      </span>
    </div>
  );
}
