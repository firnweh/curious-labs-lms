"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Again & Again 🔂 ─────────────────────────────────────────────────────────
   JUNIORS (Class 1-3, age ~6-8). Concept: a LOOP repeats the same action a
   chosen number of times — but now as a real PROBLEM to plan, not a one-tap toy.
   A frog 🐸 must cross lily pads 🪷 to reach a fly 🪰. ONE big block says
   "HOP × n" with chunky – / + buttons to pick n (1-6). Press GO ▶ and the frog
   hops EXACTLY n times, one pad per hop, landing on the fly → big celebration.

   Across THREE escalating rounds the child must LOOK, COUNT the gap, and set the
   loop to exactly that many hops:
     • Round 1 — frog on the bank, 3 pads → set n = 3.
     • Round 2 — a longer pond, 5 pads → set n = 5 (a fresh count).
     • Round 3 — THE TWIST: the frog does NOT start on the bank. It already sits
       partway across, so the winning n is the GAP between frog and fly, NOT the
       total pad count. Counting "all the pads" overshoots — you must reason about
       the remaining hops. This defeats guessing / pattern-matching.

   Wrong count → frog stops on the wrong pad with a gentle 🙈 ribbit, then hops
   back to its start — never a hard fail, never scolds. Win all three → ⭐⭐⭐,
   onComplete fires EXACTLY ONCE. NO READING REQUIRED — numbers, emoji and colour
   carry the whole idea. Touch-first, deterministic. */

const ACCENT = "#22d3ee";
const MIN_N = 1;
const MAX_N = 6;
const HOP_MS = 480;

/** The three puzzles. `pads` = lily pads in the pond; `start` = the pad the frog
 *  begins on (0 = the start bank). The winning loop count is the GAP the frog
 *  must close to reach the fly:  win = pads - start.
 *  Rounds: 3 → 5 → 6-pads-but-frog-starts-on-pad-2 (so the answer is 4, not 6). */
const LEVELS: ReadonlyArray<{ pads: number; start: number }> = [
  { pads: 3, start: 0 }, // gap 3 — learn the basic loop
  { pads: 5, start: 0 }, // gap 5 — a bigger, fresh count
  { pads: 6, start: 2 }, // twist: frog starts on pad 2 → count the GAP (4), not "6"
];
const TOTAL = LEVELS.length;

/** Confetti particles for the win burst — pure decoration (transform/opacity). */
type Particle = { e: string; x: number; y: number; d: number };
const CONFETTI: readonly Particle[] = [
  { e: "✨", x: -86, y: -54, d: 0 },
  { e: "🎉", x: -52, y: -78, d: 0.04 },
  { e: "⭐", x: -16, y: -90, d: 0.08 },
  { e: "💫", x: 22, y: -84, d: 0.05 },
  { e: "✨", x: 58, y: -66, d: 0.02 },
  { e: "🎊", x: 90, y: -42, d: 0.07 },
  { e: "⭐", x: -94, y: -10, d: 0.1 },
  { e: "💫", x: 96, y: -6, d: 0.03 },
  { e: "✨", x: -78, y: 30, d: 0.06 },
  { e: "🎉", x: 80, y: 32, d: 0.09 },
  { e: "⭐", x: -40, y: 48, d: 0.12 },
  { e: "💫", x: 44, y: 50, d: 0.11 },
];

type Phase = "idle" | "hopping" | "miss" | "won";

export default function AgainAndAgain({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const level = LEVELS[round];
  const pads = level.pads;
  const start = level.start; // pad the frog begins on (0 = bank)
  const win = pads - start; // the gap the loop must close to land on the fly

  const [count, setCount] = useState<number>(1); // chosen n in the HOP × n block
  const [frogPad, setFrogPad] = useState<number>(start); // 0 = bank, 1..pads = on a pad
  const [phase, setPhase] = useState<Phase>("idle");
  const [allDone, setAllDone] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const audioRef = useRef<AudioContext | null>(null);
  const timers = useRef<number[]>([]);

  // ── tiny optional sounds (built on a tap gesture, never autoplay) ──────────
  const ac = useCallback((): AudioContext | null => {
    try {
      if (audioRef.current === null) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return null;
        audioRef.current = new Ctor();
      }
      return audioRef.current;
    } catch {
      return null;
    }
  }, []);

  const blip = useCallback(
    (freq: number, dur = 0.09, type: OscillatorType = "sine") => {
      try {
        const ctx = ac();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + dur + 0.02);
      } catch {
        /* sound is a nice-to-have; never block play */
      }
    },
    [ac],
  );

  const chime = useCallback(() => {
    [523, 659, 784, 1047].forEach((f, i) =>
      window.setTimeout(() => blip(f, 0.16, "triangle"), i * 110),
    );
  }, [blip]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  // Fresh round: park the frog on this level's starting pad, reset the loop.
  useEffect(() => {
    clearTimers();
    setCount(1);
    setFrogPad(LEVELS[round].start);
    setPhase("idle");
  }, [round, clearTimers]);

  const busy = phase === "hopping";
  const won = phase === "won";

  const setN = useCallback(
    (delta: number) => {
      if (busy || won) return;
      blip(delta > 0 ? 660 : 440);
      setCount((c) => Math.max(MIN_N, Math.min(MAX_N, c + delta)));
      setFrogPad(start);
      setPhase("idle");
    },
    [busy, won, blip, start],
  );

  const reset = useCallback(() => {
    clearTimers();
    reportedRef.current = false;
    setRound(0);
    setCount(1);
    setFrogPad(LEVELS[0].start);
    setPhase("idle");
    setAllDone(false);
  }, [clearTimers]);

  const go = useCallback(() => {
    if (busy || won) return;
    clearTimers();
    blip(700, 0.12, "square");
    setPhase("hopping");
    setFrogPad(start);

    // hop one pad at a time, exactly `count` times, from the frog's start pad.
    // never run off the far end of the pond (a spare landing reads clearly).
    const landTarget = Math.min(start + count, pads + 1);
    for (let i = start + 1; i <= landTarget; i += 1) {
      const id = window.setTimeout(() => {
        setFrogPad(i);
        blip(520 + (i - start) * 40, 0.08, "sine");
      }, (i - start) * HOP_MS);
      timers.current.push(id);
    }

    // after the last hop, judge where the frog landed
    const judgeId = window.setTimeout(
      () => {
        if (count === win) {
          chime();
          setPhase("won");
          const last = round + 1 >= TOTAL;
          if (last) {
            const finishId = window.setTimeout(() => setAllDone(true), 900);
            timers.current.push(finishId);
          } else {
            const nextId = window.setTimeout(() => setRound((r) => r + 1), 1300);
            timers.current.push(nextId);
          }
        } else {
          // gentle miss: ribbit + hop back to start, no scolding, no onComplete.
          blip(220, 0.18, "sawtooth");
          setPhase("miss");
          const homeId = window.setTimeout(() => {
            setFrogPad(start);
            setPhase("idle");
          }, 900);
          timers.current.push(homeId);
        }
      },
      count * HOP_MS + 240,
    );
    timers.current.push(judgeId);
  }, [busy, won, count, win, pads, start, round, clearTimers, blip, chime]);

  // report success exactly once when all rounds are cleared
  useEffect(() => {
    if (allDone && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3, detail: "The frog caught the fly! 🐸🪰" });
    }
  }, [allDone, onComplete]);

  const missing = phase === "miss";

  // status emoji — no reading required
  const statusEmoji = useMemo<string>(() => {
    if (allDone) return "🎉";
    if (won) return "⭐";
    if (missing) return "🙈";
    if (busy) return "🐸";
    return "🔂";
  }, [allDone, won, missing, busy]);

  // build the row of pads (1..pads)
  const lane = useMemo(() => Array.from({ length: pads }, (_, i) => i + 1), [pads]);

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono">
      <style>{KEYFRAMES}</style>

      {/* ── tiny visual status + round dots ── */}
      <div className="flex w-full max-w-[430px] items-center justify-between px-1">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1 text-2xl"
          role="status"
          aria-live="polite"
          aria-label={
            allDone
              ? "All done! You solved all three rounds"
              : won
                ? "The frog reached the fly!"
                : missing
                  ? "Not quite, try again"
                  : busy
                    ? "The frog is hopping"
                    : `Round ${round + 1} of ${TOTAL} — count the hops to the fly, then press Go`
          }
          style={{
            background: won || allDone ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
            border: `2px solid ${won || allDone ? ACCENT : "var(--color-line, #33405c)"}`,
          }}
        >
          <span
            key={statusEmoji}
            aria-hidden="true"
            style={{
              display: "inline-block",
              animation: "jcloop-pop 0.4s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            {statusEmoji}
          </span>
          {(won || allDone) && (
            <span
              aria-hidden="true"
              className="text-2xl"
              style={{ display: "inline-block", animation: "jcloop-float 1.2s ease-in-out infinite" }}
            >
              ✨
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5" aria-label={`Round ${round + 1} of ${TOTAL}`}>
          {LEVELS.map((_, i) => {
            const filled = i < round || allDone;
            const current = i === round && !allDone;
            return (
            <span
              key={i}
              className="block h-3 w-3 rounded-full transition-all"
              style={{
                background: filled ? ACCENT : "transparent",
                border: `2px solid ${filled || current ? ACCENT : "var(--color-line, #2a3340)"}`,
                boxShadow: filled || current ? `0 0 8px ${ACCENT}` : "none",
                opacity: current && !filled ? 0.65 : 1,
                animation: filled ? "jcloop-snap 0.45s cubic-bezier(.34,1.56,.64,1) both" : undefined,
              }}
            />
            );
          })}
        </div>
      </div>

      {/* ── the pond lane: frog 🐸 → lily pads 🪷 → fly 🪰 ── */}
      <div
        className="relative w-full max-w-[430px] overflow-hidden rounded-2xl border border-line p-3"
        style={{ background: "linear-gradient(180deg, #0b2230, #07151d)" }}
      >
        <div className="flex items-end justify-between gap-1">
          {/* start bank */}
          <Bank label="start bank" glyph="🟫" active={frogPad === 0} />
          {/* lily pads */}
          {lane.map((p) => {
            const here = frogPad === p;
            const isGoalPad = p === pads;
            // a soft 🚩 marks the frog's starting pad this round, so the child can
            // see WHERE the count begins (key to the round-3 gap twist).
            const isStartPad = p === start && start > 0;
            return (
              <div
                key={p}
                aria-label={`lily pad ${p}`}
                className="relative grid place-items-center"
                style={{ width: 44, height: 56 }}
              >
                {/* frog sits ON this pad */}
                {here && (
                  <span
                    aria-hidden="true"
                    className="absolute text-3xl"
                    style={{
                      top: -6,
                      transformOrigin: "bottom center",
                      animation:
                        won && isGoalPad
                          ? "jcloop-cheer 0.7s 0.1s ease-in-out 3"
                          : "jcloop-hop 0.45s ease",
                      filter: won && isGoalPad ? `drop-shadow(0 0 8px ${ACCENT})` : undefined,
                    }}
                  >
                    🐸
                  </span>
                )}
                {/* start-pad marker (only shows when the frog begins mid-pond) */}
                {isStartPad && !here && (
                  <span
                    aria-hidden="true"
                    className="absolute text-base"
                    style={{ top: 2, opacity: 0.55 }}
                  >
                    🚩
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className="text-3xl"
                  style={{
                    opacity: here ? 0.45 : 1,
                    transform: here ? "scale(0.92)" : "scale(1)",
                    transition: "transform 140ms ease",
                    animation:
                      isGoalPad && !here
                        ? "jcloop-padglow 2s ease-in-out infinite"
                        : undefined,
                  }}
                >
                  🪷
                </span>
              </div>
            );
          })}
          {/* fly / goal */}
          <div className="relative grid place-items-center" style={{ width: 44, height: 56 }}>
            <span
              aria-hidden="true"
              className="text-3xl"
              style={{
                animation: won ? "jcloop-pop 0.6s ease-out" : "jcloop-buzz 1.4s ease-in-out infinite",
                filter: won ? `drop-shadow(0 0 8px ${ACCENT})` : undefined,
              }}
            >
              🪰
            </span>
          </div>
        </div>

        {/* frog resting on the start bank when this round starts on the bank */}
        {frogPad === 0 && (
          <div
            className="pointer-events-none absolute text-3xl"
            style={{
              left: 14,
              bottom: 30,
              transformOrigin: "bottom center",
              animation: missing
                ? "jcloop-wobble 0.5s ease-in-out"
                : "jcloop-breathe 2.6s ease-in-out infinite",
            }}
            aria-hidden="true"
          >
            🐸
          </div>
        )}

        {/* win confetti burst — 12 sparkle particles flying outward */}
        {won && (
          <div
            className="pointer-events-none absolute inset-0 grid place-items-center"
            aria-hidden="true"
          >
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className="absolute text-lg"
                style={{
                  ["--jx" as string]: `${c.x}px`,
                  ["--jy" as string]: `${c.y}px`,
                  animation: `jcloop-confetti 0.9s ${c.d}s cubic-bezier(.2,.7,.3,1) both`,
                }}
              >
                {c.e}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── THE LOOP BLOCK: HOP × n with chunky – / + ── */}
      <div
        className="flex w-full max-w-[430px] items-center justify-center gap-3 rounded-2xl px-3 py-3"
        style={{ background: "rgba(34,211,238,0.10)", border: `2px solid ${ACCENT}` }}
        aria-label={`Loop block: hop ${count} times`}
      >
        <span
          aria-hidden="true"
          className="text-3xl"
          style={{
            display: "inline-block",
            transformOrigin: "bottom center",
            animation: busy
              ? "jcloop-hop 0.45s ease-in-out infinite"
              : "jcloop-breathe 2.6s ease-in-out infinite",
          }}
        >
          🐸
        </span>
        <span aria-hidden="true" className="text-2xl font-extrabold" style={{ color: ACCENT }}>
          ×
        </span>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            setN(-1);
          }}
          disabled={busy || won || count <= MIN_N}
          aria-label="Fewer hops"
          className="grid h-[64px] w-[64px] place-items-center rounded-2xl text-4xl font-black transition-transform duration-200 active:scale-90 disabled:opacity-30"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.06)",
            border: `2px solid ${ACCENT}`,
            color: ACCENT,
            boxShadow: "0 5px 0 0 #0e8aa0",
            transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span aria-hidden="true">–</span>
        </button>

        <div
          aria-label={`${count} hops`}
          className="grid h-[72px] w-[72px] place-items-center rounded-2xl text-5xl font-black"
          style={{
            background: "#060810",
            border: `3px solid ${ACCENT}`,
            color: ACCENT,
            boxShadow: `0 0 14px ${ACCENT}66`,
          }}
        >
          <span
            key={count}
            aria-hidden="true"
            style={{
              display: "inline-block",
              animation: "jcloop-pop 0.34s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            {count}
          </span>
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            setN(1);
          }}
          disabled={busy || won || count >= MAX_N}
          aria-label="More hops"
          className="grid h-[64px] w-[64px] place-items-center rounded-2xl text-4xl font-black transition-transform duration-200 active:scale-90 disabled:opacity-30"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.06)",
            border: `2px solid ${ACCENT}`,
            color: ACCENT,
            boxShadow: "0 5px 0 0 #0e8aa0",
            transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {/* tiny hop-dots: a visual echo of "n times" under the block */}
      <div className="flex min-h-[18px] items-center justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="block h-3 w-3 rounded-full"
            style={{
              background: ACCENT,
              opacity: 0.8,
              animation: `jcloop-snap 0.4s ${i * 0.04}s cubic-bezier(.34,1.56,.64,1) both`,
            }}
          />
        ))}
      </div>

      {/* ── GO ▶ + Reset 🔄 ── */}
      <div className="flex w-full max-w-[430px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            go();
          }}
          disabled={busy || won}
          aria-label="Go — make the frog hop"
          className="flex h-[72px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition-transform duration-200 active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#060810",
            boxShadow: "0 6px 0 0 #0e8aa0",
            transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
            animation: !busy && !won ? "jcloop-pulse 1.8s ease-in-out infinite" : undefined,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              transformOrigin: "bottom center",
              animation: busy ? "jcloop-hop 0.45s ease-in-out infinite" : undefined,
            }}
          >
            {busy ? "🐸" : "▶"}
          </span>
          <span aria-hidden="true" className="text-xl font-extrabold">
            GO
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={busy}
          aria-label="Start over"
          className="grid h-[72px] w-[72px] place-items-center rounded-2xl text-3xl transition-transform duration-200 active:scale-90 active:-rotate-180 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
            transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* big celebration when all rounds are cleared */}
      {allDone && (
        <div className="relative grid place-items-center gap-1 py-1 text-center">
          {/* falling confetti rain over the finish line */}
          <div
            className="pointer-events-none absolute inset-x-0 -top-6 bottom-0 overflow-visible"
            aria-hidden="true"
          >
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className="absolute text-lg"
                style={{
                  left: `${8 + i * 7.5}%`,
                  top: -10,
                  animation: `jcloop-rain 1.6s ${(i % 6) * 0.18}s ease-in infinite`,
                }}
              >
                {c.e}
              </span>
            ))}
          </div>
          <div className="flex gap-1.5 text-4xl" aria-label="Three stars, you did it">
            <span
              style={{
                display: "inline-block",
                animation: "jcloop-star 0.55s 0.05s cubic-bezier(.34,1.56,.64,1) both",
              }}
              aria-hidden="true"
            >
              ⭐
            </span>
            <span
              style={{
                display: "inline-block",
                animation: "jcloop-star 0.55s 0.35s cubic-bezier(.34,1.56,.64,1) both",
              }}
              aria-hidden="true"
            >
              ⭐
            </span>
            <span
              style={{
                display: "inline-block",
                animation: "jcloop-star 0.55s 0.65s cubic-bezier(.34,1.56,.64,1) both",
              }}
              aria-hidden="true"
            >
              ⭐
            </span>
          </div>
          <div className="flex justify-center gap-2 text-2xl">
            <span style={{ animation: "jcloop-float 1.2s ease-in-out infinite" }} aria-hidden="true">
              ✨
            </span>
            <span
              style={{ animation: "jcloop-float 1.2s 0.2s ease-in-out infinite" }}
              aria-hidden="true"
            >
              🎉
            </span>
            <span
              style={{ animation: "jcloop-float 1.2s 0.4s ease-in-out infinite" }}
              aria-hidden="true"
            >
              ✨
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Bank({ label, glyph, active }: { label: string; glyph: string; active: boolean }) {
  return (
    <div
      aria-label={label}
      className="grid place-items-center rounded-lg text-2xl"
      style={{
        width: 32,
        height: 56,
        opacity: active ? 1 : 0.7,
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </div>
  );
}

const KEYFRAMES = `
@keyframes jcloop-hop {
  0% { transform: translateY(0) scale(1); }
  25% { transform: translateY(-22px) scale(0.86, 1.16); }
  55% { transform: translateY(-2px) scale(1.12, 0.9); }
  75% { transform: translateY(0) scale(0.96, 1.06); }
  100% { transform: translateY(0) scale(1); }
}
@keyframes jcloop-pop {
  0% { transform: scale(0.6); }
  45% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
@keyframes jcloop-buzz {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-2px, -3px); }
  50% { transform: translate(2px, 1px); }
  75% { transform: translate(-1px, 3px); }
}
@keyframes jcloop-wobble {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-13deg); }
  45% { transform: rotate(11deg); }
  70% { transform: rotate(-7deg); }
  90% { transform: rotate(4deg); }
}
@keyframes jcloop-float {
  0%, 100% { transform: translateY(0); opacity: 0.8; }
  50% { transform: translateY(-10px); opacity: 1; }
}
/* gentle idle breathing for the waiting frog — never static */
@keyframes jcloop-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-3px) scale(1.04, 0.97); }
}
/* happy victory bounce-dance for the frog that reached the fly */
@keyframes jcloop-cheer {
  0% { transform: translateY(0) scale(1) rotate(0deg); }
  20% { transform: translateY(-18px) scale(1.05, 0.95) rotate(-8deg); }
  45% { transform: translateY(0) scale(0.9, 1.1) rotate(0deg); }
  65% { transform: translateY(-12px) scale(1.04, 0.96) rotate(8deg); }
  100% { transform: translateY(0) scale(1) rotate(0deg); }
}
/* goal lily pad invites the frog with a soft glow-pulse */
@keyframes jcloop-padglow {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
  50% { transform: scale(1.12); filter: drop-shadow(0 0 7px ${ACCENT}); }
}
/* springy snap-into-slot for the hop-count dots */
@keyframes jcloop-snap {
  0% { transform: scale(0) translateY(-8px); opacity: 0; }
  70% { transform: scale(1.35) translateY(0); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
}
/* GO button gently pulses to invite the press */
@keyframes jcloop-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
/* stars pop in one at a time with an overshoot + a little spin */
@keyframes jcloop-star {
  0% { transform: scale(0) rotate(-40deg); opacity: 0; }
  60% { transform: scale(1.4) rotate(10deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
/* win confetti bursting outward from the pond */
@keyframes jcloop-confetti {
  0% { transform: translate(0, 0) scale(0.2) rotate(0deg); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translate(var(--jx), var(--jy)) scale(1.1) rotate(220deg); opacity: 0; }
}
/* gentle confetti rain over the final celebration */
@keyframes jcloop-rain {
  0% { transform: translateY(-12px) rotate(0deg); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translateY(72px) rotate(200deg); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  /* stop the looping idle/ambient animations; keep one-shot feedback subtle */
  [style*="jcloop-breathe"],
  [style*="jcloop-buzz"],
  [style*="jcloop-padglow"],
  [style*="jcloop-pulse"],
  [style*="jcloop-float"],
  [style*="jcloop-rain"],
  [style*="jcloop-confetti"],
  [style*="jcloop-hop 0.45s ease-in-out infinite"] {
    animation: none !important;
  }
}
`;
