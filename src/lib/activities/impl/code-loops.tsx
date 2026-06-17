"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Loop Painter ──────────────────────────────────────────────────────────
   Concept: loops + patterns + efficiency.
   Grid is GRID×GRID. Cursor starts at (0,0). The learner assembles a tiny
   program from command chips — including a REPEAT block — then presses Run.
   The cursor walks the grid; Paint fills the cell under it in the accent
   colour. Match the TARGET (an "L" border: top row + left column) to win.
   The intended clean solution uses two loops.                              */

const ACCENT = "#22d3ee";
const GRID = 8;

type Cmd = "paint" | "right" | "down" | "cr";
/** A program item is either a plain command or a repeat block wrapping a body. */
type Item =
  | { kind: "cmd"; id: number; cmd: Cmd }
  | { kind: "repeat"; id: number; count: number; body: Cmd[] };

interface Cursor {
  x: number;
  y: number;
}

const CMD_META: Record<Cmd, { label: string; glyph: string; aria: string }> = {
  paint: { label: "Paint", glyph: "▣", aria: "Paint the current cell" },
  right: { label: "Right", glyph: "→", aria: "Move cursor right" },
  down: { label: "Down", glyph: "↓", aria: "Move cursor down" },
  cr: { label: "Home ↵", glyph: "↵", aria: "Carriage return: go to start of next row" },
};

/** Target = top row + left column ("L" border). */
const TARGET: ReadonlySet<string> = (() => {
  const s = new Set<string>();
  for (let i = 0; i < GRID; i++) {
    s.add(`0,${i}`); // top row  (y=0, x=i)
    s.add(`${i},0`); // left col (x=0, y=i)
  }
  return s;
})();

/** Flatten the program into a linear list of atomic commands. */
function flatten(items: Item[]): Cmd[] {
  const out: Cmd[] = [];
  for (const it of items) {
    if (it.kind === "cmd") {
      out.push(it.cmd);
    } else {
      const n = Math.max(0, Math.floor(it.count));
      for (let r = 0; r < n; r++) out.push(...it.body);
    }
  }
  return out;
}

/** Run a flat command list, returning each cursor frame + the painted cells. */
function simulate(cmds: Cmd[]): { frames: Cursor[]; painted: Set<string> } {
  const painted = new Set<string>();
  let x = 0;
  let y = 0;
  const frames: Cursor[] = [{ x, y }];
  for (const c of cmds) {
    if (c === "paint") {
      painted.add(`${x},${y}`); // key is "x,y"
    } else if (c === "right") {
      x = Math.min(GRID - 1, x + 1);
    } else if (c === "down") {
      y = Math.min(GRID - 1, y + 1);
    } else if (c === "cr") {
      x = 0;
      y = Math.min(GRID - 1, y + 1);
    }
    frames.push({ x, y });
  }
  return { frames, painted };
}

function setsEqual(a: Set<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

let idCounter = 1;
const nextId = (): number => idCounter++;

export default function LoopPainter({ onComplete }: ActivityProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState<boolean>(false);
  const [solved, setSolved] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<number>(0);
  const [status, setStatus] = useState<string>("Build a program, then press Run.");
  const [painted, setPainted] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<Cursor>({ x: 0, y: 0 });

  const rafRef = useRef<number | null>(null);
  const completedRef = useRef<boolean>(false);

  // cleanup any pending animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const flat = useMemo(() => flatten(items), [items]);

  const addCmd = useCallback((cmd: Cmd) => {
    if (completedRef.current) return;
    setItems((prev) => [...prev, { kind: "cmd", id: nextId(), cmd }]);
  }, []);

  const addRepeat = useCallback(() => {
    if (completedRef.current) return;
    // Friendly starter loop: a count of 7 with one Paint + one Right in the body.
    setItems((prev) => [
      ...prev,
      { kind: "repeat", id: nextId(), count: 7, body: ["paint", "right"] },
    ]);
  }, []);

  const removeItem = useCallback((id: number) => {
    if (completedRef.current) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const setRepeatCount = useCallback((id: number, count: number) => {
    const safe = Number.isFinite(count) ? Math.max(0, Math.min(GRID, Math.floor(count))) : 0;
    setItems((prev) =>
      prev.map((it) =>
        it.kind === "repeat" && it.id === id ? { ...it, count: safe } : it,
      ),
    );
  }, []);

  const addToBody = useCallback((id: number, cmd: Cmd) => {
    if (completedRef.current) return;
    setItems((prev) =>
      prev.map((it) =>
        it.kind === "repeat" && it.id === id
          ? { ...it, body: [...it.body, cmd] }
          : it,
      ),
    );
  }, []);

  const clearBody = useCallback((id: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.kind === "repeat" && it.id === id ? { ...it, body: [] } : it,
      ),
    );
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRunning(false);
    setPainted(new Set());
    setCursor({ x: 0, y: 0 });
    setStatus("Cleared. Build a program, then press Run.");
  }, []);

  const run = useCallback(() => {
    if (running || completedRef.current) return;
    if (flat.length === 0) {
      setStatus("Add some commands first!");
      return;
    }
    const { frames, painted: finalPainted } = simulate(flat);
    setRunning(true);
    setPainted(new Set());
    setCursor(frames[0]);
    setStatus("Running…");

    // Animate the cursor across the frames, painting as it goes.
    const live = new Set<string>();
    let i = 0;
    let last = 0;
    // step pacing scales with program length so long runs stay snappy
    const stepMs = Math.max(45, Math.min(140, 1200 / Math.max(1, frames.length)));

    const tick = (t: number) => {
      if (last === 0) last = t;
      if (t - last >= stepMs) {
        last = t;
        i++;
        if (i < frames.length) {
          const f = frames[i];
          setCursor(f);
          // a paint happens when this frame's cell entered the final set
          // and the executed command at this step was "paint"
          if (flat[i - 1] === "paint") {
            live.add(`${f.x},${f.y}`);
            setPainted(new Set(live));
          }
        }
      }
      if (i < frames.length - 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      // done
      rafRef.current = null;
      setRunning(false);
      setPainted(new Set(finalPainted));
      const win = setsEqual(finalPainted, TARGET);
      const tries = attempts + 1;
      setAttempts(tries);
      if (win) {
        setSolved(true);
        completedRef.current = true;
        const stars: 1 | 2 | 3 = tries <= 4 ? 3 : 2;
        setStatus("Reached the goal! Pattern matches. 🎉");
        onComplete({ passed: true, stars });
      } else {
        const correct = [...finalPainted].filter((k) => TARGET.has(k)).length;
        setStatus(`${correct} / ${TARGET.size} cells match — check your loops.`);
        onComplete({
          passed: false,
          detail: "Pattern doesn't match yet — check your loops",
        });
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [running, flat, attempts, onComplete]);

  // ── rendering helpers ────────────────────────────────────────────────────
  const cells = useMemo(() => {
    const arr: { x: number; y: number; key: string }[] = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) arr.push({ x, y, key: `${x},${y}` });
    }
    return arr;
  }, []);

  const PaletteButton = ({ cmd }: { cmd: Cmd }) => (
    <button
      type="button"
      aria-label={CMD_META[cmd].aria}
      onClick={() => addCmd(cmd)}
      disabled={running || solved}
      className="flex items-center gap-1 rounded-md border border-line bg-panel/60 px-2 py-1 font-mono text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-40"
    >
      <span aria-hidden>{CMD_META[cmd].glyph}</span>
      <span>{CMD_META[cmd].label}</span>
    </button>
  );

  return (
    <div
      className="panel flex w-full flex-col gap-3 rounded-xl p-3 sm:p-4"
      style={{ minHeight: 460 }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm tracking-tech text-ink sm:text-base">
          Loop Painter
        </h3>
        <span
          className="font-mono text-[10px] uppercase tracking-tech"
          style={{ color: ACCENT }}
        >
          loops · patterns
        </span>
      </div>

      {/* grids: target vs yours */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { title: "Target", isTarget: true },
            { title: "Your grid", isTarget: false },
          ] as const
        ).map((g) => (
          <div key={g.title} className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-tech text-ink-faint">
              {g.title}
            </span>
            <svg
              viewBox={`0 0 ${GRID} ${GRID}`}
              className="w-full rounded-md border border-line bg-base"
              role="img"
              aria-label={
                g.isTarget ? "Target pattern: top row and left column" : "Your painted grid"
              }
              style={
                g.isTarget
                  ? undefined
                  : {
                      boxShadow: solved ? `0 0 0 2px ${ACCENT}, 0 0 18px ${ACCENT}88` : undefined,
                      transition: "box-shadow .35s ease",
                    }
              }
            >
              {cells.map((c) => {
                const on = g.isTarget ? TARGET.has(c.key) : painted.has(c.key);
                const isCursor = !g.isTarget && cursor.x === c.x && cursor.y === c.y;
                return (
                  <g key={c.key}>
                    <rect
                      x={c.x + 0.06}
                      y={c.y + 0.06}
                      width={0.88}
                      height={0.88}
                      rx={0.12}
                      fill={on ? ACCENT : "transparent"}
                      stroke={on ? ACCENT : "#1e293b"}
                      strokeWidth={0.04}
                      opacity={on ? (g.isTarget ? 0.45 : 1) : 1}
                    />
                    {isCursor && (
                      <rect
                        x={c.x + 0.02}
                        y={c.y + 0.02}
                        width={0.96}
                        height={0.96}
                        rx={0.14}
                        fill="none"
                        stroke={running ? "#fbbf24" : "#94a3b8"}
                        strokeWidth={0.1}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        ))}
      </div>

      {/* status line */}
      <div
        className="rounded-md border border-line bg-panel/50 px-3 py-1.5 text-center font-mono text-xs"
        aria-live="polite"
        style={{ color: solved ? ACCENT : undefined }}
      >
        {status}
      </div>

      {/* palette */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-tech text-ink-faint">
            Add:
          </span>
          <PaletteButton cmd="paint" />
          <PaletteButton cmd="right" />
          <PaletteButton cmd="down" />
          <PaletteButton cmd="cr" />
          <button
            type="button"
            aria-label="Add a Repeat loop block"
            onClick={addRepeat}
            disabled={running || solved}
            className="flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs transition-colors disabled:opacity-40"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            <span aria-hidden>↻</span>
            <span>Repeat</span>
          </button>
        </div>
      </div>

      {/* program */}
      <div className="flex min-h-[72px] flex-1 flex-col gap-1.5 overflow-y-auto rounded-md border border-line bg-base/60 p-2">
        {items.length === 0 ? (
          <p className="m-auto text-center font-mono text-[11px] text-ink-faint">
            Your program is empty. Tip: a Repeat with Paint + Right paints a whole row.
          </p>
        ) : (
          items.map((it, idx) => (
            <div
              key={it.id}
              className="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-panel/40 px-2 py-1"
            >
              <span className="font-mono text-[10px] text-ink-faint">{idx + 1}</span>
              {it.kind === "cmd" ? (
                <span className="font-mono text-xs text-ink">
                  {CMD_META[it.cmd].glyph} {CMD_META[it.cmd].label}
                </span>
              ) : (
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  <span
                    className="font-mono text-xs font-semibold"
                    style={{ color: ACCENT }}
                  >
                    ↻ Repeat
                  </span>
                  <label className="flex items-center gap-1 font-mono text-xs text-ink-dim">
                    <span className="sr-only">Loop count</span>
                    <input
                      type="number"
                      min={0}
                      max={GRID}
                      value={it.count}
                      disabled={running || solved}
                      onChange={(e) => setRepeatCount(it.id, Number(e.target.value))}
                      aria-label="Repeat count"
                      className="w-12 rounded border border-line bg-base px-1 py-0.5 text-center font-mono text-xs text-ink"
                    />
                    <span>×</span>
                  </label>
                  <span className="font-mono text-[11px] text-ink-dim">
                    [
                    {it.body.length === 0 ? (
                      <span className="text-ink-faint"> empty </span>
                    ) : (
                      it.body.map((b, i) => (
                        <span key={i}>
                          {i > 0 ? " " : ""}
                          {CMD_META[b].glyph}
                        </span>
                      ))
                    )}
                    ]
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    {(["paint", "right", "down", "cr"] as Cmd[]).map((b) => (
                      <button
                        key={b}
                        type="button"
                        aria-label={`Add ${CMD_META[b].label} to loop body`}
                        onClick={() => addToBody(it.id, b)}
                        disabled={running || solved}
                        className="rounded border border-line bg-base px-1.5 py-0.5 font-mono text-[10px] text-ink-dim hover:text-ink disabled:opacity-40"
                      >
                        +{CMD_META[b].glyph}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-label="Clear loop body"
                      onClick={() => clearBody(it.id)}
                      disabled={running || solved}
                      className="rounded border border-line bg-base px-1.5 py-0.5 font-mono text-[10px] text-ink-faint hover:text-ink disabled:opacity-40"
                    >
                      clr
                    </button>
                  </span>
                </div>
              )}
              <button
                type="button"
                aria-label={`Delete step ${idx + 1}`}
                onClick={() => removeItem(it.id)}
                disabled={running || solved}
                className="ml-auto rounded border border-line bg-base px-1.5 py-0.5 font-mono text-[10px] text-ink-faint hover:text-neon-red disabled:opacity-40"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={running || solved}
          aria-label="Run the program"
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
        >
          {running ? "Running…" : "Run ▶"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={running}
          aria-label="Clear the painted grid"
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm text-ink-dim disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => {
            if (running || solved) return;
            setItems([]);
            reset();
          }}
          disabled={running || solved}
          aria-label="Delete the whole program"
          className="ml-auto rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs text-ink-faint disabled:opacity-50"
        >
          Clear program
        </button>
      </div>
    </div>
  );
}
