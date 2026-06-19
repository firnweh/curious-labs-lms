"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Score & Timer Game 🎮 ────────────────────────────────────────────────────
   GRADE 4 (explorer, age ~10). ONE learning goal: variables hold a changing
   SCORE and a counting-down TIME, and CONDITIONS decide when to add points and
   when the game ends. The learner doesn't play by reflex — they WIRE the game's
   logic by dropping condition blocks into three rule slots, then press RUN. A
   fixed, deterministic 10-second demo plays itself: a scripted catcher slides to
   catch exactly 7 of the falling apples. SCORE rises only if rule A is right,
   TIME counts down only if rule B is right, and GAME OVER appears only if rule C
   is right. Win = SCORE 7, TIME 0, GAME OVER. Always winnable, never scolds. */

const ACCENT = "#22d3ee";
const STAGE_W = 220;
const STAGE_H = 260;
const CATCH_FLOOR = STAGE_H - 34; // y where the catcher's mouth sits
const TOTAL_TICKS = 10; // one tick per game-second → a 10-second demo

/* ── Block / slot model ──────────────────────────────────────────────────── */
type SlotId = "score" | "time" | "over";
type BlockId =
  | "plus1"
  | "minus1"
  | "plus10"
  | "minusTime1"
  | "stopAll"
  | "addScore";

interface BlockDef {
  id: BlockId;
  /** What goes in the blank, e.g. "+1" or "STOP · GAME OVER". */
  label: string;
  glyph: string;
  /** Which slot this block legitimately belongs to (for grading). */
  fits: SlotId;
}

/* Palette: each slot has ONE correct block plus a plausible distractor. */
const BLOCKS: Record<BlockId, BlockDef> = {
  plus1: { id: "plus1", label: "+1", glyph: "➕", fits: "score" },
  plus10: { id: "plus10", label: "+10", glyph: "🔟", fits: "score" },
  minus1: { id: "minus1", label: "−1", glyph: "⏬", fits: "time" },
  minusTime1: { id: "minusTime1", label: "+1", glyph: "⏫", fits: "time" },
  stopAll: { id: "stopAll", label: "STOP · GAME OVER", glyph: "🛑", fits: "over" },
  addScore: { id: "addScore", label: "change SCORE", glyph: "🔁", fits: "over" },
};

/** Tray order: correct blocks mixed with distractors. */
const TRAY: readonly BlockId[] = [
  "plus1",
  "minus1",
  "stopAll",
  "plus10",
  "minusTime1",
  "addScore",
];

interface SlotDef {
  id: SlotId;
  rule: string;
  blank: string;
  /** The block id that makes this rule correct. */
  answer: BlockId;
}

const SLOTS: readonly SlotDef[] = [
  {
    id: "score",
    rule: "WHEN catcher touches apple → change SCORE by",
    blank: "?",
    answer: "plus1",
  },
  {
    id: "time",
    rule: "EVERY second → change TIME by",
    blank: "?",
    answer: "minus1",
  },
  {
    id: "over",
    rule: "IF TIME = 0 →",
    blank: "?",
    answer: "stopAll",
  },
] as const;

/* ── Deterministic apple script ──────────────────────────────────────────────
   7 apples are caught, 3 are missed → SCORE must read 7 when rule A is right.
   Each apple has a seeded x-lane and a tick on which it reaches the floor. */
interface Apple {
  lane: number; // 0..1 across the stage
  landTick: number; // tick at which it hits CATCH_FLOOR
  caught: boolean; // scripted outcome (deterministic)
}

const APPLES: readonly Apple[] = [
  { lane: 0.2, landTick: 1, caught: true },
  { lane: 0.55, landTick: 2, caught: true },
  { lane: 0.85, landTick: 3, caught: false },
  { lane: 0.35, landTick: 4, caught: true },
  { lane: 0.7, landTick: 5, caught: true },
  { lane: 0.1, landTick: 6, caught: false },
  { lane: 0.5, landTick: 7, caught: true },
  { lane: 0.9, landTick: 8, caught: true },
  { lane: 0.25, landTick: 9, caught: false },
  { lane: 0.65, landTick: 10, caught: true },
] as const;

const FALL_TICKS = 1.4; // how long an apple is visible before landing

type Phase = "wiring" | "running" | "done";

/** Catcher x (fractional 0..1) for a given tick — slides toward each caught apple. */
function catcherLane(tick: number): number {
  let prev = APPLES[0].lane;
  let prevT = 0;
  for (const a of APPLES) {
    if (a.caught) {
      if (tick <= a.landTick) {
        const span = a.landTick - prevT || 1;
        const k = Math.max(0, Math.min(1, (tick - prevT) / span));
        return prev + (a.lane - prev) * k;
      }
      prev = a.lane;
      prevT = a.landTick;
    }
  }
  return prev;
}

export default function GameScoreTimer({ onComplete }: ActivityProps) {
  // slot id → block placed in it (or null)
  const [placed, setPlaced] = useState<Record<SlotId, BlockId | null>>({
    score: null,
    time: null,
    over: null,
  });
  const [held, setHeld] = useState<BlockId | null>(null); // tap-to-place selection
  const [phase, setPhase] = useState<Phase>("wiring");
  const [tick, setTick] = useState<number>(0); // 0..TOTAL_TICKS during demo
  const [tries, setTries] = useState<number>(0);

  const phaseRef = useRef<Phase>("wiring");
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const doneRef = useRef<boolean>(false); // guards onComplete(passed:true) — fires once

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);
  useEffect(() => stopLoop, [stopLoop]);

  /* Which rules are correctly wired. */
  const ruleOk = useMemo(
    () => ({
      score: placed.score === "plus1",
      time: placed.time === "minus1",
      over: placed.over === "stopAll",
    }),
    [placed],
  );
  const allFilled =
    placed.score !== null && placed.time !== null && placed.over !== null;
  const allCorrect = ruleOk.score && ruleOk.time && ruleOk.over;

  /* ── Live watcher values, derived from the current tick + chosen rules ────── */
  const elapsed = phase === "wiring" ? 0 : tick;

  // SCORE: count caught apples up to now, but only if rule A adds +1.
  const score = useMemo(() => {
    if (!ruleOk.score) return 0; // wrong rule → score stays stuck at 0
    let s = 0;
    for (const a of APPLES) if (a.caught && a.landTick <= elapsed) s += 1;
    return s;
  }, [ruleOk.score, elapsed]);

  // TIME: countdown if rule B is −1; counts UP (wrong) otherwise.
  const time = useMemo(() => {
    if (ruleOk.time) return Math.max(0, TOTAL_TICKS - elapsed); // 10 → 0
    return elapsed; // wrong rule → timer climbs forever
  }, [ruleOk.time, elapsed]);

  const gameOver =
    phase === "done" && ruleOk.time && ruleOk.over && elapsed >= TOTAL_TICKS;

  /* ── Demo loop: ~1 tick/sec, 10 ticks total, deterministic ───────────────── */
  const TICK_MS = 460;
  const loop = useCallback(
    (now: number) => {
      if (phaseRef.current !== "running") return;
      const t = Math.min(TOTAL_TICKS, (now - startRef.current) / TICK_MS);
      setTick(t);
      if (t >= TOTAL_TICKS) {
        setTick(TOTAL_TICKS);
        setPhase("done");
        phaseRef.current = "done";
        stopLoop();
        if (allCorrect && !doneRef.current) {
          doneRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: "SCORE 7 · TIME 0 · GAME OVER — your game logic works!",
          });
        } else if (!allCorrect) {
          onComplete({
            passed: false,
            detail: "Close! Watch which value misbehaved, then re-wire a rule.",
          });
        }
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [allCorrect, onComplete, stopLoop],
  );

  const handleRun = useCallback(() => {
    if (!allFilled) return;
    stopLoop();
    setTries((n) => n + 1);
    setTick(0);
    startRef.current = performance.now();
    setPhase("running");
    phaseRef.current = "running";
    rafRef.current = requestAnimationFrame(loop);
  }, [allFilled, loop, stopLoop]);

  const handleReset = useCallback(() => {
    stopLoop();
    setPlaced({ score: null, time: null, over: null });
    setHeld(null);
    setPhase("wiring");
    phaseRef.current = "wiring";
    setTick(0);
  }, [stopLoop]);

  /* Tap a tray block to pick it up. */
  const pickBlock = useCallback((id: BlockId) => {
    if (phaseRef.current === "running") return;
    if (phaseRef.current === "done") {
      setPhase("wiring");
      phaseRef.current = "wiring";
    }
    setHeld((cur) => (cur === id ? null : id));
  }, []);

  /* Tap a slot to drop the held block — or clear it if nothing is held. */
  const dropInSlot = useCallback(
    (slot: SlotId) => {
      if (phaseRef.current === "running") return;
      if (phaseRef.current === "done") {
        setPhase("wiring");
        phaseRef.current = "wiring";
      }
      setPlaced((prev) => {
        if (held === null) return { ...prev, [slot]: null };
        // Don't let one block sit in two slots at once.
        const next: Record<SlotId, BlockId | null> = { ...prev };
        (Object.keys(next) as SlotId[]).forEach((s) => {
          if (next[s] === held) next[s] = null;
        });
        next[slot] = held;
        return next;
      });
      setHeld(null);
    },
    [held],
  );

  const usedBlocks = useMemo(
    () =>
      new Set(Object.values(placed).filter((b): b is BlockId => b !== null)),
    [placed],
  );

  const running = phase === "running";
  const catcherX = catcherLane(elapsed) * (STAGE_W - 44) + 22;

  /* Apples currently in flight (falling or just landed) for the SVG. */
  const liveApples = useMemo(() => {
    if (phase === "wiring") return [];
    const out: {
      i: number;
      x: number;
      y: number;
      caught: boolean;
      landed: boolean;
    }[] = [];
    APPLES.forEach((a, i) => {
      const start = a.landTick - FALL_TICKS;
      if (elapsed < start || elapsed > a.landTick + 0.4) return;
      const k = Math.max(0, Math.min(1, (elapsed - start) / FALL_TICKS));
      const y = 16 + k * (CATCH_FLOOR - 16);
      const x = a.lane * (STAGE_W - 44) + 22;
      out.push({ i, x, y, caught: a.caught, landed: elapsed >= a.landTick });
    });
    return out;
  }, [phase, elapsed]);

  const status = useMemo(() => {
    if (phase === "running") return `Demo running… ${Math.floor(elapsed)}s`;
    if (phase === "done")
      return allCorrect
        ? "Game complete! Your rules work 🎉"
        : "The demo finished — check which value looked wrong.";
    if (!allFilled) return "Drop a block into each rule slot, then press Run ▶";
    return "Rules wired — press Run ▶ to test them.";
  }, [phase, elapsed, allCorrect, allFilled]);

  const timeColor = !ruleOk.time && elapsed > 0 ? "#f87171" : ACCENT;
  const scoreColor = !ruleOk.score && elapsed > 1 ? "#f87171" : ACCENT;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g4gamescoretimer-pop { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.25)} 100%{transform:scale(1);opacity:1} }
        @keyframes g4gamescoretimer-flash { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes g4gamescoretimer-rise { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-12px);opacity:0} }
        @keyframes g4gamescoretimer-glow { 0%,100%{filter:drop-shadow(0 0 2px ${ACCENT})} 50%{filter:drop-shadow(0 0 8px ${ACCENT})} }
      `}</style>

      {/* ── STAGE + VARIABLE WATCHERS ────────────────────────────────────── */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={
          gameOver
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 26px -4px ${ACCENT}` }
            : undefined
        }
      >
        {/* variable watchers */}
        <div className="mb-1 flex gap-2">
          {(
            [
              { k: "SCORE", v: score, c: scoreColor },
              { k: "TIME", v: time, c: timeColor },
            ] as const
          ).map(({ k, v, c }) => (
            <div
              key={k}
              className="flex flex-1 items-center justify-between rounded-lg border border-line bg-panel/70 px-2.5 py-1"
              role="status"
              aria-label={`${k} is ${Math.round(v)}`}
            >
              <span className="text-[10px] uppercase tracking-tech text-ink-faint">
                {k}
              </span>
              <span
                className="font-display text-lg tabular-nums"
                style={{
                  color: c,
                  animation: running
                    ? "g4gamescoretimer-flash .9s ease infinite"
                    : undefined,
                }}
              >
                {Math.round(v)}
              </span>
            </div>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          className="block w-full"
          role="img"
          aria-label="Game stage with a catcher and falling apples"
        >
          {/* sky / floor */}
          <rect x={0} y={0} width={STAGE_W} height={STAGE_H} rx={8} fill="#0b1220" />
          <line
            x1={6}
            y1={CATCH_FLOOR + 14}
            x2={STAGE_W - 6}
            y2={CATCH_FLOOR + 14}
            stroke="#1b2433"
            strokeWidth={1.5}
          />
          {Array.from({ length: 5 }, (_, i) => (
            <circle
              key={i}
              cx={20 + i * 46}
              cy={18 + (i % 2) * 10}
              r={1.4}
              fill="#1f2a3d"
            />
          ))}

          {/* falling apples */}
          {liveApples.map((a) => (
            <g key={a.i} transform={`translate(${a.x} ${a.y})`}>
              {a.landed && a.caught ? (
                <text
                  fontSize={15}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ animation: "g4gamescoretimer-rise .5s ease forwards" }}
                >
                  ✨
                </text>
              ) : (
                <text fontSize={16} textAnchor="middle" dominantBaseline="central">
                  🍎
                </text>
              )}
            </g>
          ))}

          {/* catcher sprite */}
          <g transform={`translate(${catcherX} ${CATCH_FLOOR})`}>
            <ellipse cx={0} cy={7} rx={20} ry={5} fill="#000" opacity={0.25} />
            <text
              fontSize={26}
              textAnchor="middle"
              dominantBaseline="central"
              style={
                running
                  ? { animation: "g4gamescoretimer-glow 1.2s ease infinite" }
                  : undefined
              }
            >
              🧺
            </text>
          </g>

          {/* GAME OVER banner */}
          {gameOver && (
            <g style={{ animation: "g4gamescoretimer-pop .5s ease" }}>
              <rect
                x={26}
                y={STAGE_H / 2 - 26}
                width={STAGE_W - 52}
                height={52}
                rx={10}
                fill="#0b1220"
                stroke={ACCENT}
                strokeWidth={2}
              />
              <text
                x={STAGE_W / 2}
                y={STAGE_H / 2 - 4}
                textAnchor="middle"
                fontSize={18}
                fontWeight={700}
                fill={ACCENT}
              >
                GAME OVER
              </text>
              <text
                x={STAGE_W / 2}
                y={STAGE_H / 2 + 14}
                textAnchor="middle"
                fontSize={10}
                fill="#9fb0d0"
              >
                ⭐⭐⭐ score {score} · time {Math.round(time)}
              </text>
            </g>
          )}
        </svg>

        <p className="mt-1 px-1 text-[11px] text-ink-dim" aria-live="polite">
          {status}
        </p>
      </div>

      {/* ── RULE SHEET (3 slots) ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          Rule sheet — fill every blank
        </p>
        {SLOTS.map((slot) => {
          const placedId = placed[slot.id];
          const block = placedId ? BLOCKS[placedId] : null;
          const filled = block !== null;
          const showMark = phase === "done";
          const ok = ruleOk[slot.id];
          const borderColor = showMark
            ? ok
              ? ACCENT
              : "#f87171"
            : filled
              ? "#33415a"
              : "#222c3d";
          return (
            <div
              key={slot.id}
              className="flex items-center justify-between gap-2 rounded-lg border bg-panel/60 p-2"
              style={{ borderColor }}
            >
              <span className="flex-1 text-xs leading-snug text-ink-dim">
                {slot.rule}
              </span>
              <button
                type="button"
                onPointerDown={() => dropInSlot(slot.id)}
                disabled={running}
                aria-label={
                  filled
                    ? `Rule slot ${slot.id} holds ${block?.label}. Tap to change.`
                    : `Empty rule slot ${slot.id}. Tap to drop the held block.`
                }
                className="flex min-w-[92px] items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition disabled:opacity-60"
                style={{
                  borderColor: held && !filled ? ACCENT : "#33415a",
                  borderStyle: filled ? "solid" : "dashed",
                  background: filled ? "#0e1626" : "transparent",
                  color: showMark
                    ? ok
                      ? ACCENT
                      : "#f87171"
                    : filled
                      ? "#e8eefc"
                      : "#5f7194",
                }}
              >
                {filled ? (
                  <>
                    <span aria-hidden>{block?.glyph}</span>
                    <span>{block?.label}</span>
                    {showMark && <span aria-hidden>{ok ? "✓" : "✗"}</span>}
                  </>
                ) : (
                  <span>{slot.blank}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── BLOCK PALETTE ────────────────────────────────────────────────── */}
      <div className="panel flex flex-col gap-2 rounded-xl p-2.5">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          {held ? "Now tap a rule slot above ☝" : "Tap a block to pick it up"}
        </p>
        <div
          className="flex flex-wrap gap-2"
          style={{ touchAction: "manipulation" }}
        >
          {TRAY.map((id) => {
            const b = BLOCKS[id];
            const isHeld = held === id;
            const isUsed = usedBlocks.has(id);
            return (
              <button
                key={id}
                type="button"
                onPointerDown={() => pickBlock(id)}
                disabled={running}
                aria-pressed={isHeld}
                aria-label={`Block: change by ${b.label}`}
                className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                style={{
                  borderColor: isHeld ? ACCENT : "#33415a",
                  background: isHeld ? ACCENT : isUsed ? "#0e1626" : "#101a2e",
                  color: isHeld ? "#04121a" : isUsed ? "#5f7194" : "#cfe3ff",
                  opacity: isUsed && !isHeld ? 0.55 : 1,
                }}
              >
                <span aria-hidden>{b.glyph}</span>
                <span>{b.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CONTROLS ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint">Runs: {tries}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onPointerDown={handleReset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset all rules"
          >
            Reset
          </button>
          <button
            type="button"
            onPointerDown={handleRun}
            disabled={running || !allFilled}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: ACCENT, color: "#04121a" }}
            aria-label="Run the 10 second demo"
          >
            {running ? "Running…" : "Run ▶"}
          </button>
        </div>
      </div>

      {/* ── WIN CELEBRATION ──────────────────────────────────────────────── */}
      {phase === "done" && allCorrect && (
        <div
          className="rounded-xl border p-3 text-center"
          style={{
            borderColor: ACCENT,
            background: "#0e1626",
            animation: "g4gamescoretimer-pop .5s ease",
          }}
          role="status"
          aria-label="You finished the lab"
        >
          <p className="text-lg font-bold" style={{ color: ACCENT }}>
            ✨🎉 Game complete! ⭐⭐⭐
          </p>
          <p className="mt-1 text-xs text-ink-dim">
            SCORE landed on <b style={{ color: ACCENT }}>7</b>, TIME counted down
            to <b style={{ color: ACCENT }}>0</b>, and GAME OVER fired right on
            time.
          </p>
        </div>
      )}
    </div>
  );
}
