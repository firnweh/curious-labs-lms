"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Score & Timer Game 🎮 ────────────────────────────────────────────────────
   GRADE 4-6 (explorer, age ~9-11). LEARNING GOAL: variables hold a changing
   SCORE and a counting TIME, and CONDITIONS decide when to add points and when
   the game ends. The learner doesn't play by reflex — they WIRE the game's logic
   by dropping condition blocks into rule slots, then press RUN. A deterministic
   demo plays itself; SCORE, TIME and GAME OVER only behave if the rules are right.

   This is now a REAL problem, not a one-shot fixed answer: THREE escalating
   rounds, each a fresh configuration that defeats "guess +1 again".
     • Round 1  — learn it: +1 per catch, −1 / sec, stop when TIME = 0.
     • Round 2  — TWIST: a "double points" round, so the SCORE block must be +2,
                  not +1 — pattern-matching the last answer fails. Fresh apple
                  script, so the count is different too.
     • Round 3  — TWIST: the WIN CONDITION flips. The game ends when SCORE hits a
                  TARGET, not when TIME runs out — so the GAME OVER rule must test
                  SCORE, not TIME. An extra decoy block makes it non-binary.
   Win a round → it slides the next, harder one in. Win all three → ⭐⭐⭐ and
   onComplete ONCE. Wrong wiring → no scolding: the demo shows which value
   misbehaved, then you re-wire and re-run. Deterministic, always winnable. */

const ACCENT = "#22d3ee";
const STAGE_W = 220;
const STAGE_H = 260;
const CATCH_FLOOR = STAGE_H - 34; // y where the catcher's mouth sits
const TOTAL_TICKS = 10; // one tick per game-second → a 10-second demo
const FALL_TICKS = 1.4; // how long an apple is visible before landing
const TICK_MS = 460;

/* ── Block / slot model ──────────────────────────────────────────────────── */
type SlotId = "score" | "time" | "over";
type BlockId =
  | "plus1"
  | "plus2"
  | "plus10"
  | "minusTime1"
  | "plusTime1"
  | "stopTime0"
  | "stopScore"
  | "changeScore";

interface BlockDef {
  id: BlockId;
  /** What goes in the blank, e.g. "+1" or "STOP when TIME = 0". */
  label: string;
  glyph: string;
}

/* Palette of every block that can appear in any round. Each round picks a
   subset (correct answers + plausible distractors) into its tray. */
const BLOCKS: Record<BlockId, BlockDef> = {
  plus1: { id: "plus1", label: "+1", glyph: "➕" },
  plus2: { id: "plus2", label: "+2", glyph: "✌️" },
  plus10: { id: "plus10", label: "+10", glyph: "🔟" },
  minusTime1: { id: "minusTime1", label: "−1", glyph: "⏬" },
  plusTime1: { id: "plusTime1", label: "+1", glyph: "⏫" },
  stopTime0: { id: "stopTime0", label: "STOP when TIME = 0", glyph: "🛑" },
  stopScore: { id: "stopScore", label: "STOP when SCORE = goal", glyph: "🎯" },
  changeScore: { id: "changeScore", label: "change SCORE", glyph: "🔁" },
};

interface SlotDef {
  id: SlotId;
  rule: string;
  /** The block id that makes this rule correct THIS round. */
  answer: BlockId;
}

interface Apple {
  lane: number; // 0..1 across the stage
  landTick: number; // tick at which it hits CATCH_FLOOR
  caught: boolean; // scripted outcome (deterministic)
}

interface RoundDef {
  /** Points each caught apple is worth this round (1, 2, …). */
  perApple: number;
  /** How this round ends: at TIME 0, or when SCORE reaches `goalScore`. */
  endOn: "time" | "score";
  /** Deterministic apple script. */
  apples: readonly Apple[];
  /** The three rule slots, with this round's correct answers. */
  slots: readonly SlotDef[];
  /** Which blocks sit in the tray (correct answers + distractors), in order. */
  tray: readonly BlockId[];
}

/* ── ROUND 1 — learn the machine ──────────────────────────────────────────
   7 apples caught of 10, each worth +1 → final SCORE 7. Ends at TIME 0. */
const R1_APPLES: readonly Apple[] = [
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
];

/* ── ROUND 2 — DOUBLE POINTS twist ────────────────────────────────────────
   6 apples caught, each worth +2 → final SCORE 12. The SCORE block must be +2,
   not the +1 that worked last round. Ends at TIME 0 (same end rule as R1). */
const R2_APPLES: readonly Apple[] = [
  { lane: 0.3, landTick: 1, caught: true },
  { lane: 0.6, landTick: 2, caught: false },
  { lane: 0.15, landTick: 3, caught: true },
  { lane: 0.8, landTick: 4, caught: true },
  { lane: 0.45, landTick: 5, caught: false },
  { lane: 0.9, landTick: 6, caught: true },
  { lane: 0.25, landTick: 7, caught: true },
  { lane: 0.7, landTick: 8, caught: false },
  { lane: 0.4, landTick: 9, caught: true },
  { lane: 0.55, landTick: 10, caught: false },
];

/* ── ROUND 3 — FLIPPED WIN CONDITION twist ────────────────────────────────
   "First to the goal wins." Each catch is +1, and the game ENDS the moment
   SCORE reaches the goal (5) — NOT when TIME hits 0. So the GAME OVER rule must
   test SCORE, not TIME. The 5th catch lands on tick 6, so the demo stops early. */
const R3_GOAL = 5;
const R3_APPLES: readonly Apple[] = [
  { lane: 0.25, landTick: 1, caught: true },
  { lane: 0.6, landTick: 2, caught: true },
  { lane: 0.85, landTick: 3, caught: false },
  { lane: 0.4, landTick: 4, caught: true },
  { lane: 0.15, landTick: 5, caught: true },
  { lane: 0.7, landTick: 6, caught: true }, // 5th catch → reaches goal here
  { lane: 0.5, landTick: 7, caught: true },
  { lane: 0.9, landTick: 8, caught: false },
  { lane: 0.3, landTick: 9, caught: true },
  { lane: 0.65, landTick: 10, caught: true },
];

const ROUNDS: readonly RoundDef[] = [
  {
    perApple: 1,
    endOn: "time",
    apples: R1_APPLES,
    slots: [
      { id: "score", rule: "WHEN catcher touches apple → change SCORE by", answer: "plus1" },
      { id: "time", rule: "EVERY second → change TIME by", answer: "minusTime1" },
      { id: "over", rule: "to end the game →", answer: "stopTime0" },
    ],
    tray: ["plus1", "minusTime1", "stopTime0", "plus10", "plusTime1", "changeScore"],
  },
  {
    perApple: 2,
    endOn: "time",
    apples: R2_APPLES,
    slots: [
      { id: "score", rule: "DOUBLE POINTS round! Each apple is worth", answer: "plus2" },
      { id: "time", rule: "EVERY second → change TIME by", answer: "minusTime1" },
      { id: "over", rule: "to end the game →", answer: "stopTime0" },
    ],
    tray: ["plus1", "plus2", "minusTime1", "stopTime0", "plusTime1", "plus10"],
  },
  {
    perApple: 1,
    endOn: "score",
    apples: R3_APPLES,
    slots: [
      { id: "score", rule: "WHEN catcher touches apple → change SCORE by", answer: "plus1" },
      { id: "time", rule: "EVERY second → change TIME by", answer: "minusTime1" },
      {
        id: "over",
        rule: `RACE TO ${R3_GOAL}! End the game →`,
        answer: "stopScore",
      },
    ],
    tray: ["plus1", "minusTime1", "stopScore", "stopTime0", "plus2", "changeScore"],
  },
];

type Phase = "wiring" | "running" | "done";

/** Catch count up to and including `tick` for a given apple script. */
function caughtBy(apples: readonly Apple[], tick: number): number {
  let n = 0;
  for (const a of apples) if (a.caught && a.landTick <= tick) n += 1;
  return n;
}

/** Tick at which SCORE first reaches `goal` catches (the early-stop point). */
function tickForScore(apples: readonly Apple[], goalCatches: number): number {
  let n = 0;
  for (const a of apples) {
    if (a.caught) {
      n += 1;
      if (n >= goalCatches) return a.landTick;
    }
  }
  return TOTAL_TICKS;
}

/** Catcher x (fractional 0..1) for a given tick — slides toward each caught apple. */
function catcherLane(apples: readonly Apple[], tick: number): number {
  let prev = apples[0].lane;
  let prevT = 0;
  for (const a of apples) {
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
  const [round, setRound] = useState<number>(0);
  // slot id → block placed in it (or null)
  const [placed, setPlaced] = useState<Record<SlotId, BlockId | null>>({
    score: null,
    time: null,
    over: null,
  });
  const [held, setHeld] = useState<BlockId | null>(null); // tap-to-place selection
  const [phase, setPhase] = useState<Phase>("wiring");
  const [tick, setTick] = useState<number>(0); // 0..stopTick during demo
  const [tries, setTries] = useState<number>(0);
  const [solvedFirstTry, setSolvedFirstTry] = useState<boolean>(true);

  const cfg = ROUNDS[round];
  const isLastRound = round >= ROUNDS.length - 1;

  const phaseRef = useRef<Phase>("wiring");
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false); // guards onComplete — fires once
  const triesRef = useRef<number>(0); // total runs this round, for the star tally

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);
  const clearAdvance = useCallback(() => {
    if (advanceRef.current !== null) {
      clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  }, []);
  useEffect(
    () => () => {
      stopLoop();
      clearAdvance();
    },
    [stopLoop, clearAdvance],
  );

  /* Fresh round: clear the rule sheet and park the demo. */
  useEffect(() => {
    stopLoop();
    setPlaced({ score: null, time: null, over: null });
    setHeld(null);
    setPhase("wiring");
    phaseRef.current = "wiring";
    setTick(0);
    triesRef.current = 0;
  }, [round, stopLoop]);

  /* Which rules are correctly wired for THIS round. */
  const ruleOk = useMemo(
    () => ({
      score: placed.score === cfg.slots[0].answer,
      time: placed.time === cfg.slots[1].answer,
      over: placed.over === cfg.slots[2].answer,
    }),
    [placed, cfg],
  );
  const allFilled =
    placed.score !== null && placed.time !== null && placed.over !== null;
  const allCorrect = ruleOk.score && ruleOk.time && ruleOk.over;

  /* The tick at which this round's demo STOPS — at TIME 0, or early when a
     correct SCORE rule races to the goal first. Deterministic. */
  const stopTick = useMemo(() => {
    if (cfg.endOn === "score" && ruleOk.score && ruleOk.over) {
      return tickForScore(cfg.apples, R3_GOAL);
    }
    return TOTAL_TICKS;
  }, [cfg, ruleOk.score, ruleOk.over]);

  /* ── Live watcher values, derived from the current tick + chosen rules ────── */
  const elapsed = phase === "wiring" ? 0 : tick;

  // SCORE: catches so far × points-per-apple, but only if the SCORE rule is right.
  const score = useMemo(() => {
    if (!ruleOk.score) return 0; // wrong rule → score stays stuck at 0
    return caughtBy(cfg.apples, elapsed) * cfg.perApple;
  }, [ruleOk.score, cfg, elapsed]);

  // TIME: counts down if the rule is −1; counts UP (wrong) otherwise.
  const time = useMemo(() => {
    if (ruleOk.time) return Math.max(0, TOTAL_TICKS - elapsed); // 10 → 0
    return elapsed; // wrong rule → timer climbs the wrong way
  }, [ruleOk.time, elapsed]);

  const gameOver =
    phase === "done" && allCorrect && elapsed >= stopTick - 0.001;

  /* ── Demo loop: ~1 tick/sec, deterministic ───────────────────────────────── */
  const loop = useCallback(
    (now: number) => {
      if (phaseRef.current !== "running") return;
      const t = Math.min(stopTick, (now - startRef.current) / TICK_MS);
      setTick(t);
      if (t >= stopTick) {
        setTick(stopTick);
        setPhase("done");
        phaseRef.current = "done";
        stopLoop();
        if (allCorrect) {
          if (isLastRound) {
            if (!reportedRef.current) {
              reportedRef.current = true;
              // Full marks if every round was solved on its first run; a clean
              // win after some debugging still earns 2.
              onComplete({
                passed: true,
                stars: solvedFirstTry ? 3 : 2,
                detail: solvedFirstTry
                  ? "All three rounds wired perfectly — first try every time! ⭐⭐⭐"
                  : "All three rounds solved — your game logic works! ⭐⭐",
              });
            }
          } else {
            // Win this round; slide the next, harder one in.
            advanceRef.current = setTimeout(() => {
              setRound((r) => r + 1);
            }, 1250);
          }
        }
        // Wrong wiring: no onComplete(false) spam — the watchers already show
        // which value misbehaved; the learner re-wires and re-runs.
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [stopTick, allCorrect, isLastRound, solvedFirstTry, onComplete, stopLoop],
  );

  const handleRun = useCallback(() => {
    if (!allFilled || phase === "running") return;
    stopLoop();
    clearAdvance();
    setTries((n) => n + 1);
    triesRef.current += 1;
    if (triesRef.current > 1) setSolvedFirstTry(false);
    setTick(0);
    startRef.current = performance.now();
    setPhase("running");
    phaseRef.current = "running";
    rafRef.current = requestAnimationFrame(loop);
  }, [allFilled, phase, loop, stopLoop, clearAdvance]);

  const handleReset = useCallback(() => {
    stopLoop();
    clearAdvance();
    reportedRef.current = false;
    setSolvedFirstTry(true);
    setTries(0);
    setRound(0); // triggers the round-reset effect → clears slots
  }, [stopLoop, clearAdvance]);

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
  const catcherX = catcherLane(cfg.apples, elapsed) * (STAGE_W - 44) + 22;

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
    cfg.apples.forEach((a, i) => {
      const start = a.landTick - FALL_TICKS;
      if (elapsed < start || elapsed > a.landTick + 0.4) return;
      const k = Math.max(0, Math.min(1, (elapsed - start) / FALL_TICKS));
      const y = 16 + k * (CATCH_FLOOR - 16);
      const x = a.lane * (STAGE_W - 44) + 22;
      out.push({ i, x, y, caught: a.caught, landed: elapsed >= a.landTick });
    });
    return out;
  }, [phase, elapsed, cfg]);

  const status = useMemo(() => {
    if (phase === "running") return `Demo running… ${Math.floor(elapsed)}s`;
    if (phase === "done") {
      if (allCorrect)
        return isLastRound
          ? "Game complete! Your rules work 🎉"
          : "Round solved! Next round loading…";
      return "The demo finished — check which value looked wrong, then re-wire.";
    }
    if (!allFilled) return "Drop a block into each rule slot, then press Run ▶";
    return "Rules wired — press Run ▶ to test them.";
  }, [phase, elapsed, allCorrect, allFilled, isLastRound]);

  const timeColor = !ruleOk.time && elapsed > 0 ? "#f87171" : ACCENT;
  const scoreColor = !ruleOk.score && elapsed > 1 ? "#f87171" : ACCENT;

  const finalWin = phase === "done" && allCorrect && isLastRound;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g4gamescoretimer-pop { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.25)} 100%{transform:scale(1);opacity:1} }
        @keyframes g4gamescoretimer-flash { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes g4gamescoretimer-rise { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-12px);opacity:0} }
        @keyframes g4gamescoretimer-glow { 0%,100%{filter:drop-shadow(0 0 2px ${ACCENT})} 50%{filter:drop-shadow(0 0 8px ${ACCENT})} }
        @media (prefers-reduced-motion: reduce){
          [style*="g4gamescoretimer-flash"],[style*="g4gamescoretimer-glow"]{animation:none !important}
        }
      `}</style>

      {/* ── ROUND HEADER + progress dots ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">
          {finalWin ? "All rounds cleared" : `Round ${round + 1} of ${ROUNDS.length}`}
        </p>
        <span className="inline-flex items-center gap-1.5" aria-hidden>
          {ROUNDS.map((_, i) => {
            const solved = i < round || finalWin;
            const current = i === round && !finalWin;
            return (
              <span
                key={i}
                className="grid place-items-center rounded-full"
                style={{
                  height: 12,
                  width: 12,
                  background: solved
                    ? ACCENT
                    : current
                      ? "rgba(34,211,238,0.25)"
                      : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "#33415a"}`,
                }}
              />
            );
          })}
        </span>
      </div>

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

        {/* race-to-goal banner (round 3) */}
        {cfg.endOn === "score" && (
          <div className="mb-1 rounded-md border border-line bg-panel/50 px-2 py-0.5 text-center text-[10px] text-ink-dim">
            🎯 First to <b style={{ color: ACCENT }}>SCORE {R3_GOAL}</b> wins —
            the timer is a trap!
          </div>
        )}

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
                {isLastRound ? "⭐⭐⭐ " : ""}score {score} · time {Math.round(time)}
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
        {cfg.slots.map((slot) => {
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
                className="flex min-w-[92px] max-w-[150px] items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold leading-tight transition disabled:opacity-60"
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
                  <span>?</span>
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
          {cfg.tray.map((id) => {
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
                aria-label={`Block: ${b.label}`}
                className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition disabled:opacity-50"
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
            aria-label="Reset back to round one"
          >
            Reset
          </button>
          <button
            type="button"
            onPointerDown={handleRun}
            disabled={running || !allFilled}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: ACCENT, color: "#04121a" }}
            aria-label="Run the demo"
          >
            {running ? "Running…" : "Run ▶"}
          </button>
        </div>
      </div>

      {/* ── WIN CELEBRATION (final round only) ───────────────────────────── */}
      {finalWin && (
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
            ✨🎉 Game complete! {solvedFirstTry ? "⭐⭐⭐" : "⭐⭐"}
          </p>
          <p className="mt-1 text-xs text-ink-dim">
            You wired all three games — even the double-points round and the
            race-to-{R3_GOAL} twist where the timer was a trap.
            {solvedFirstTry
              ? " Solved every round on the first run — perfect logic!"
              : " Nice debugging to get there!"}
          </p>
        </div>
      )}
    </div>
  );
}
