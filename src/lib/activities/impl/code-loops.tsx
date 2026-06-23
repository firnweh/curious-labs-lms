"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Loop Painter ──────────────────────────────────────────────────────────
   CLASS 4-6 (explorer, age ~9-11) CODING lab. Concept: loops + patterns +
   EFFICIENCY. The learner assembles a tiny program from command chips —
   including a nestable REPEAT block — then presses Run. A cursor walks an
   8×8 grid; Paint fills the cell under it. Match the TARGET pattern to win.

   Why it's a real problem, not a toy — three escalating rounds:
   • R1 "L border": top row + left column. Two simple loops. A warm-up that
     teaches "Repeat [Paint Right]" paints a whole line.
   • R2 "full frame": all four edges. You must plan return-to-start (Home ↵)
     and combine several loops — the naive single-loop guess can't close it.
   • R3 "stripes": rows 0, 3 and 6 painted across. The TWIST is that the clean
     answer is a LOOP-OF-A-LOOP — an outer Repeat whose body holds an inner
     Repeat plus moves. Brute-forcing wins the pattern but blows the EFFICIENCY
     budget, so it only earns ⭐⭐. Tight, loopy code earns ⭐⭐⭐.

   Efficiency is graded on AUTHORED program size (how many chips you wrote),
   NOT on how many cells the loops expand to — so loops are strictly rewarded.
   A clean win is always reachable. Wrong runs never scold and never spam
   onComplete; the program is kept so the learner can debug it.            */

const ACCENT = "#22d3ee";
const GRID = 8;
const ROUNDS = 3;

type Cmd = "paint" | "right" | "down" | "cr";
/** A program item is a plain command, or a repeat block whose body may itself
 *  contain plain commands AND nested repeat blocks (loop-of-a-loop). */
type BodyItem =
  | { kind: "cmd"; id: number; cmd: Cmd }
  | { kind: "repeat"; id: number; count: number; body: { kind: "cmd"; id: number; cmd: Cmd }[] };
type Item =
  | { kind: "cmd"; id: number; cmd: Cmd }
  | { kind: "repeat"; id: number; count: number; body: BodyItem[] };

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

// ── Round targets (deterministic, hand-authored, escalating) ───────────────
interface Round {
  title: string;
  hint: string;
  /** target painted cells, keys "x,y" */
  target: ReadonlySet<string>;
  /** authored-chip budget for a full-stars (loopy) solution */
  tightBudget: number;
}

function makeSet(build: (add: (x: number, y: number) => void) => void): ReadonlySet<string> {
  const s = new Set<string>();
  build((x, y) => s.add(`${x},${y}`));
  return s;
}

const ROUND_DATA: readonly Round[] = [
  {
    title: "L border",
    hint: "A Repeat of [Paint →] paints a whole line. You need two lines.",
    target: makeSet((add) => {
      for (let i = 0; i < GRID; i++) {
        add(i, 0); // top row
        add(0, i); // left column
      }
    }),
    // clean: Repeat7[Paint Right] · Paint · Home↵ · Repeat7[Paint Home↵]  ≈ 6 chips
    tightBudget: 8,
  },
  {
    title: "full frame",
    hint: "Four edges. Paint a row, drop to the bottom, paint another row, and use the left + right columns.",
    target: makeSet((add) => {
      for (let i = 0; i < GRID; i++) {
        add(i, 0); // top
        add(i, GRID - 1); // bottom
        add(0, i); // left
        add(GRID - 1, i); // right
      }
    }),
    // a clean frame is roughly four loops; allow some slack
    tightBudget: 16,
  },
  {
    title: "stripes",
    hint: "Rows 0, 3 and 6 are the same line, three times. That is a LOOP inside a LOOP.",
    target: makeSet((add) => {
      for (const y of [0, 3, 6]) for (let x = 0; x < GRID; x++) add(x, y);
    }),
    // clean: outer Repeat3[ inner Repeat8[Paint Right] · Home↵ Home↵ Home↵ ] ≈ 6 chips
    tightBudget: 12,
  },
];

/** Flatten a program (with one level of nesting) into atomic commands. */
function flatten(items: Item[]): Cmd[] {
  const out: Cmd[] = [];
  const pushBody = (body: BodyItem[], reps: number): void => {
    for (let r = 0; r < reps; r++) {
      for (const b of body) {
        if (b.kind === "cmd") out.push(b.cmd);
        else {
          const n = Math.max(0, Math.floor(b.count));
          for (let k = 0; k < n; k++) for (const c of b.body) out.push(c.cmd);
        }
      }
    }
  };
  for (const it of items) {
    if (it.kind === "cmd") out.push(it.cmd);
    else pushBody(it.body, Math.max(0, Math.floor(it.count)));
  }
  return out;
}

/** Count AUTHORED chips (structural size), so loops are rewarded over copy-paste.
 *  Each plain command = 1. Each repeat block = 1 (the loop header) + chips in
 *  its body (counted once, NOT multiplied by the count). Nested loops likewise. */
function chipCost(items: Item[]): number {
  let n = 0;
  const bodyCost = (body: BodyItem[]): number => {
    let c = 0;
    for (const b of body) {
      if (b.kind === "cmd") c += 1;
      else c += 1 + b.body.length;
    }
    return c;
  };
  for (const it of items) {
    if (it.kind === "cmd") n += 1;
    else n += 1 + bodyCost(it.body);
  }
  return n;
}

/** Run a flat command list, returning each cursor frame + the painted cells. */
function simulate(cmds: Cmd[]): { frames: Cursor[]; painted: Set<string> } {
  const painted = new Set<string>();
  let x = 0;
  let y = 0;
  const frames: Cursor[] = [{ x, y }];
  for (const c of cmds) {
    if (c === "paint") {
      painted.add(`${x},${y}`);
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
  const [round, setRound] = useState<number>(0);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState<boolean>(false);
  const [solvedAll, setSolvedAll] = useState<boolean>(false);
  const [roundCleared, setRoundCleared] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("Build a program, then press Run.");
  const [painted, setPainted] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<Cursor>({ x: 0, y: 0 });
  // worst (lowest) star tier earned across the rounds → final award
  const [tierSoFar, setTierSoFar] = useState<3 | 2>(3);

  const rafRef = useRef<number | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

  const TARGET = ROUND_DATA[round].target;
  const locked = running || solvedAll || roundCleared;

  // cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (advanceRef.current !== null) clearTimeout(advanceRef.current);
    };
  }, []);

  const flat = useMemo(() => flatten(items), [items]);
  const cost = useMemo(() => chipCost(items), [items]);

  const addCmd = useCallback((cmd: Cmd) => {
    if (reportedRef.current) return;
    setItems((prev) => [...prev, { kind: "cmd", id: nextId(), cmd }]);
  }, []);

  const addRepeat = useCallback(() => {
    if (reportedRef.current) return;
    setItems((prev) => [
      ...prev,
      { kind: "repeat", id: nextId(), count: 7, body: [{ kind: "cmd", id: nextId(), cmd: "paint" }, { kind: "cmd", id: nextId(), cmd: "right" }] },
    ]);
  }, []);

  const removeItem = useCallback((id: number) => {
    if (reportedRef.current) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const setRepeatCount = useCallback((id: number, count: number) => {
    const safe = Number.isFinite(count) ? Math.max(0, Math.min(GRID, Math.floor(count))) : 0;
    setItems((prev) =>
      prev.map((it) => (it.kind === "repeat" && it.id === id ? { ...it, count: safe } : it)),
    );
  }, []);

  const setInnerCount = useCallback((outerId: number, innerId: number, count: number) => {
    const safe = Number.isFinite(count) ? Math.max(0, Math.min(GRID, Math.floor(count))) : 0;
    setItems((prev) =>
      prev.map((it) => {
        if (it.kind !== "repeat" || it.id !== outerId) return it;
        return {
          ...it,
          body: it.body.map((b) =>
            b.kind === "repeat" && b.id === innerId ? { ...b, count: safe } : b,
          ),
        };
      }),
    );
  }, []);

  const addToBody = useCallback((id: number, cmd: Cmd) => {
    if (reportedRef.current) return;
    setItems((prev) =>
      prev.map((it) =>
        it.kind === "repeat" && it.id === id
          ? { ...it, body: [...it.body, { kind: "cmd", id: nextId(), cmd }] }
          : it,
      ),
    );
  }, []);

  // add a nested Repeat (loop-of-a-loop) inside a repeat block's body
  const addLoopToBody = useCallback((id: number) => {
    if (reportedRef.current) return;
    setItems((prev) =>
      prev.map((it) =>
        it.kind === "repeat" && it.id === id
          ? {
              ...it,
              body: [
                ...it.body,
                {
                  kind: "repeat",
                  id: nextId(),
                  count: 7,
                  body: [
                    { kind: "cmd", id: nextId(), cmd: "paint" },
                    { kind: "cmd", id: nextId(), cmd: "right" },
                  ],
                },
              ],
            }
          : it,
      ),
    );
  }, []);

  const clearBody = useCallback((id: number) => {
    if (reportedRef.current) return;
    setItems((prev) =>
      prev.map((it) => (it.kind === "repeat" && it.id === id ? { ...it, body: [] } : it)),
    );
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRunning(false);
    setPainted(new Set());
    setCursor({ x: 0, y: 0 });
    setStatus("Cleared the grid. Build a program, then press Run.");
  }, []);

  const run = useCallback(() => {
    if (locked) return;
    if (flat.length === 0) {
      setStatus("Add some commands first!");
      return;
    }
    const { frames, painted: finalPainted } = simulate(flat);
    const win = setsEqual(finalPainted, ROUND_DATA[round].target);
    const tight = cost <= ROUND_DATA[round].tightBudget;
    setRunning(true);
    setPainted(new Set());
    setCursor(frames[0]);
    setStatus("Running…");

    const live = new Set<string>();
    let i = 0;
    let last = 0;
    const stepMs = Math.max(28, Math.min(120, 1100 / Math.max(1, frames.length)));

    const tick = (t: number) => {
      if (last === 0) last = t;
      if (t - last >= stepMs) {
        last = t;
        i++;
        if (i < frames.length) {
          const f = frames[i];
          setCursor(f);
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
      rafRef.current = null;
      setRunning(false);
      setPainted(new Set(finalPainted));

      if (!win) {
        const correct = [...finalPainted].filter((k) => ROUND_DATA[round].target.has(k)).length;
        const extra = [...finalPainted].filter((k) => !ROUND_DATA[round].target.has(k)).length;
        setStatus(
          extra > 0
            ? `${correct}/${ROUND_DATA[round].target.size} right, but ${extra} extra cell${extra === 1 ? "" : "s"} painted — fix your loops.`
            : `${correct}/${ROUND_DATA[round].target.size} cells match — keep building.`,
        );
        // gentle retry; never report a failure to the grader
        return;
      }

      // round solved! efficiency decides the tier for this round.
      const roundTier: 3 | 2 = tight ? 3 : 2;
      setTierSoFar((prev) => (roundTier < prev ? roundTier : prev));

      if (round < ROUNDS - 1) {
        setRoundCleared(true);
        setStatus(
          tight
            ? `Round ${round + 1} solved with tight, loopy code! Next pattern…`
            : `Round ${round + 1} solved — but ${cost} chips is bulky. Try loops next round for full stars. Next pattern…`,
        );
        advanceRef.current = setTimeout(() => {
          setRound((r) => r + 1);
          setItems([]);
          setPainted(new Set());
          setCursor({ x: 0, y: 0 });
          setRoundCleared(false);
          setStatus("New pattern! Build a program, then press Run.");
        }, 1500);
      } else {
        // final round cleared → award once
        setSolvedAll(true);
        const finalTier: 3 | 2 = roundTier < tierSoFar ? roundTier : tierSoFar;
        setStatus(
          finalTier === 3
            ? "All three patterns solved with efficient loops! ⭐⭐⭐"
            : "All three patterns solved! Tighten your loops for three stars. ⭐⭐",
        );
        if (!reportedRef.current) {
          reportedRef.current = true;
          onComplete({
            passed: true,
            stars: finalTier,
            detail:
              finalTier === 3
                ? "Solved all 3 loop patterns efficiently"
                : "Solved all 3 loop patterns",
          });
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [locked, flat, cost, round, tierSoFar, onComplete]);

  // ── rendering helpers ────────────────────────────────────────────────────
  const cells = useMemo(() => {
    const arr: { x: number; y: number; key: string }[] = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) arr.push({ x, y, key: `${x},${y}` });
    }
    return arr;
  }, []);

  const overBudget = cost > ROUND_DATA[round].tightBudget;

  const PaletteButton = ({ cmd }: { cmd: Cmd }) => (
    <button
      type="button"
      aria-label={CMD_META[cmd].aria}
      onClick={() => addCmd(cmd)}
      disabled={locked}
      className="flex items-center gap-1 rounded-md border border-line bg-panel/60 px-2 py-1 font-mono text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-40"
    >
      <span aria-hidden>{CMD_META[cmd].glyph}</span>
      <span>{CMD_META[cmd].label}</span>
    </button>
  );

  // small chip-adder cluster shared by a repeat body and the round-3 nested loop
  const BodyAdders = ({ id, allowLoop }: { id: number; allowLoop: boolean }) => (
    <span className="flex flex-wrap items-center gap-1">
      {(["paint", "right", "down", "cr"] as Cmd[]).map((b) => (
        <button
          key={b}
          type="button"
          aria-label={`Add ${CMD_META[b].label} to loop body`}
          onClick={() => addToBody(id, b)}
          disabled={locked}
          className="rounded border border-line bg-base px-1.5 py-0.5 font-mono text-[10px] text-ink-dim hover:text-ink disabled:opacity-40"
        >
          +{CMD_META[b].glyph}
        </button>
      ))}
      {allowLoop && (
        <button
          type="button"
          aria-label="Add a nested Repeat loop inside this loop"
          onClick={() => addLoopToBody(id)}
          disabled={locked}
          className="rounded border px-1.5 py-0.5 font-mono text-[10px] disabled:opacity-40"
          style={{ borderColor: ACCENT, color: ACCENT }}
        >
          +↻
        </button>
      )}
      <button
        type="button"
        aria-label="Clear loop body"
        onClick={() => clearBody(id)}
        disabled={locked}
        className="rounded border border-line bg-base px-1.5 py-0.5 font-mono text-[10px] text-ink-faint hover:text-ink disabled:opacity-40"
      >
        clr
      </button>
    </span>
  );

  return (
    <div
      className="panel flex w-full flex-col gap-3 rounded-xl p-3 sm:p-4"
      style={{ minHeight: 460 }}
    >
      {/* header + round dots */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm tracking-tech text-ink sm:text-base">Loop Painter</h3>
        <span className="flex items-center gap-2">
          <span aria-hidden className="inline-flex items-center gap-1">
            {ROUND_DATA.map((_, i) => {
              const done = i < round || solvedAll;
              const cur = i === round && !solvedAll;
              return (
                <span
                  key={`rd-${i}`}
                  className="block rounded-full"
                  style={{
                    height: 9,
                    width: 9,
                    background: done ? ACCENT : cur ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.08)",
                    border: `1.5px solid ${done || cur ? ACCENT : "rgba(120,140,170,0.4)"}`,
                    boxShadow: cur ? `0 0 6px ${ACCENT}88` : undefined,
                  }}
                />
              );
            })}
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-tech"
            style={{ color: ACCENT }}
          >
            Round {Math.min(round + 1, ROUNDS)}/{ROUNDS}
          </span>
        </span>
      </div>

      {/* grids: target vs yours */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { title: `Target · ${ROUND_DATA[round].title}`, isTarget: true },
            { title: "Your grid", isTarget: false },
          ] as const
        ).map((g) => (
          <div key={g.title} className="flex flex-col gap-1">
            <span className="truncate font-mono text-[10px] uppercase tracking-tech text-ink-faint">
              {g.title}
            </span>
            <svg
              viewBox={`0 0 ${GRID} ${GRID}`}
              className="w-full rounded-md border border-line bg-base"
              role="img"
              aria-label={
                g.isTarget
                  ? `Target pattern: ${ROUND_DATA[round].title}`
                  : "Your painted grid"
              }
              style={
                g.isTarget
                  ? undefined
                  : {
                      boxShadow:
                        roundCleared || solvedAll ? `0 0 0 2px ${ACCENT}, 0 0 18px ${ACCENT}88` : undefined,
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
        style={{ color: solvedAll || roundCleared ? ACCENT : undefined }}
      >
        {status}
      </div>

      {/* efficiency meter — the heart of the lesson */}
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-tech">
        <span className="text-ink-faint">
          Hint: {ROUND_DATA[round].hint}
        </span>
        <span
          aria-live="polite"
          aria-label={`Program size ${cost} chips, full-stars budget ${ROUND_DATA[round].tightBudget}`}
          className="shrink-0 rounded px-1.5 py-0.5"
          style={{
            color: overBudget ? "#fbbf24" : ACCENT,
            border: `1px solid ${overBudget ? "#fbbf2455" : ACCENT + "55"}`,
          }}
        >
          {cost} / {ROUND_DATA[round].tightBudget} chips {overBudget ? "· bulky" : "· tight"}
        </span>
      </div>

      {/* palette */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-tech text-ink-faint">Add:</span>
        <PaletteButton cmd="paint" />
        <PaletteButton cmd="right" />
        <PaletteButton cmd="down" />
        <PaletteButton cmd="cr" />
        <button
          type="button"
          aria-label="Add a Repeat loop block"
          onClick={addRepeat}
          disabled={locked}
          className="flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs transition-colors disabled:opacity-40"
          style={{ borderColor: ACCENT, color: ACCENT }}
        >
          <span aria-hidden>↻</span>
          <span>Repeat</span>
        </button>
      </div>

      {/* program */}
      <div className="flex min-h-[72px] flex-1 flex-col gap-1.5 overflow-y-auto rounded-md border border-line bg-base/60 p-2">
        {items.length === 0 ? (
          <p className="m-auto text-center font-mono text-[11px] text-ink-faint">
            Your program is empty. Tip: fewer chips with loops earns more stars than lots of taps.
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
                  <span className="font-mono text-xs font-semibold" style={{ color: ACCENT }}>
                    ↻ Repeat
                  </span>
                  <label className="flex items-center gap-1 font-mono text-xs text-ink-dim">
                    <span className="sr-only">Loop count</span>
                    <input
                      type="number"
                      min={0}
                      max={GRID}
                      value={it.count}
                      disabled={locked}
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
                      it.body.map((b, i) =>
                        b.kind === "cmd" ? (
                          <span key={b.id}>
                            {i > 0 ? " " : ""}
                            {CMD_META[b.cmd].glyph}
                          </span>
                        ) : (
                          <span key={b.id} style={{ color: ACCENT }}>
                            {i > 0 ? " " : ""}↻
                            <input
                              type="number"
                              min={0}
                              max={GRID}
                              value={b.count}
                              disabled={locked}
                              onChange={(e) => setInnerCount(it.id, b.id, Number(e.target.value))}
                              aria-label="Inner loop count"
                              className="mx-0.5 w-9 rounded border border-line bg-base px-0.5 py-0.5 text-center font-mono text-[10px] text-ink"
                            />
                            [{b.body.map((c) => CMD_META[c.cmd].glyph).join(" ")}]
                          </span>
                        ),
                      )
                    )}
                    ]
                  </span>
                  {/* round 3 unlocks nested loops so a loop-of-a-loop is buildable */}
                  <BodyAdders id={it.id} allowLoop={round === ROUNDS - 1} />
                </div>
              )}
              <button
                type="button"
                aria-label={`Delete step ${idx + 1}`}
                onClick={() => removeItem(it.id)}
                disabled={locked}
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
          disabled={locked}
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
            if (locked) return;
            setItems([]);
            reset();
          }}
          disabled={locked}
          aria-label="Delete the whole program"
          className="ml-auto rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs text-ink-faint disabled:opacity-50"
        >
          Clear program
        </button>
      </div>
    </div>
  );
}
