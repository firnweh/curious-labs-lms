"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/* ── What Comes Next? 🔁 ──────────────────────────────────────────────────────
   CLASS 1-3 lab (juniors, age ~6-8). ONE learning goal: patterns REPEAT — look
   at a row, find the rule, and predict + continue what comes next (the thinking
   behind LOOPS). A row shows a repeating pattern with the LAST tile empty
   (e.g. 🍎🍌🍎🍌🍎❓). Below sit 2-3 big choice tiles; the child taps the one
   that keeps the pattern going. Correct → it pops into the empty slot with a
   sparkle and we move on. Wrong → the tile gives a gentle wobble + 🙈, easy
   retry, never a hard fail. Three growing rounds: ABAB, AABB, ABC ABC. All three
   solved → onComplete({passed:true, stars:3}) ONCE. NO READING NEEDED — all
   emoji, colour and big shapes. Reset (🔄) restarts at Round 1. Accent #22d3ee. */

const ACCENT = "#22d3ee";

/** One pattern tile — a big emoji glyph plus an aria word (for screen readers). */
interface Item {
  id: string;
  glyph: string;
  word: string;
}

const APPLE: Item = { id: "apple", glyph: "🍎", word: "apple" };
const BANANA: Item = { id: "banana", glyph: "🍌", word: "banana" };
const RED: Item = { id: "red", glyph: "🟥", word: "red square" };
const BLUE: Item = { id: "blue", glyph: "🟦", word: "blue square" };
const STAR: Item = { id: "star", glyph: "⭐", word: "star" };
const HEART: Item = { id: "heart", glyph: "❤️", word: "heart" };
const MOON: Item = { id: "moon", glyph: "🌙", word: "moon" };

interface Round {
  /** The tiles already shown — the start of the repeating pattern. */
  shown: Item[];
  /** The single tile that correctly continues the pattern. */
  answer: Item;
  /** The 2-3 big choice tiles to tap (always includes the answer). */
  choices: Item[];
}

/** Three short rounds of growing patterns: ABAB → AABB → ABC ABC. */
const ROUNDS: Round[] = [
  // 🟥🟦🟥🟦🟥 ❓ → 🟦   (ABAB)
  { shown: [RED, BLUE, RED, BLUE, RED], answer: BLUE, choices: [BLUE, RED] },
  // 🍎🍎🍌🍌🍎🍎 ❓ → 🍌   (AABB)
  { shown: [APPLE, APPLE, BANANA, BANANA, APPLE, APPLE], answer: BANANA, choices: [BANANA, APPLE] },
  // ⭐❤️🌙⭐❤️ ❓ → 🌙   (ABC ABC)
  { shown: [STAR, HEART, MOON, STAR, HEART], answer: MOON, choices: [MOON, STAR, HEART] },
];

const TOTAL = ROUNDS.length;

/** Soft blip (tap) / happy chime (win) — created on the gesture, never throws. */
function playTone(win: boolean): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = win ? [523.25, 659.25, 783.99] : [440];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
    window.setTimeout(() => void ctx.close().catch(() => undefined), 700);
  } catch {
    /* sound is a nice-to-have; never let it block or throw */
  }
}

export default function WhatComesNext({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  /** The answer once placed into the empty slot this round (else null). */
  const [filled, setFilled] = useState<Item | null>(null);
  /** Choice id currently wobbling from a wrong tap. */
  const [wobble, setWobble] = useState<string | null>(null);
  /** True between rounds, while the quick cheer shows. */
  const [cheer, setCheer] = useState<boolean>(false);
  /** True once all rounds are solved — shows the big celebration. */
  const [done, setDone] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<number | null>(null);
  const advanceTimer = useRef<number | null>(null);

  const current = ROUNDS[round];
  const solvedRounds = done ? TOTAL : round;

  const clearTimers = useCallback(() => {
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    wobbleTimer.current = null;
    advanceTimer.current = null;
  }, []);

  const tap = useCallback(
    (choice: Item) => {
      if (done || cheer || filled) return;
      if (choice.id !== current.answer.id) {
        // Wrong tile → gentle wobble, no penalty, easy retry.
        setWobble(choice.id);
        if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
        wobbleTimer.current = window.setTimeout(() => setWobble(null), 480);
        playTone(false);
        onComplete({ passed: false, detail: "So close! Try the one that matches. 🤔" });
        return;
      }
      // Correct → snap it into the empty slot, quick cheer, then advance.
      setFilled(choice);
      setCheer(true);
      playTone(round + 1 >= TOTAL);
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => {
        if (round + 1 >= TOTAL) {
          setDone(true);
        } else {
          setRound((r) => r + 1);
          setFilled(null);
          setCheer(false);
        }
      }, 1000);
    },
    [done, cheer, filled, current.answer.id, round, onComplete],
  );

  const reset = useCallback(() => {
    clearTimers();
    reportedRef.current = false;
    setRound(0);
    setFilled(null);
    setWobble(null);
    setCheer(false);
    setDone(false);
  }, [clearTimers]);

  // Report success exactly once when every round is solved.
  useEffect(() => {
    if (done && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3, detail: "You finished every pattern! 🎉" });
    }
  }, [done, onComplete]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny visual status (emoji + progress dots, no sentences) ── */}
      <div className="flex w-full max-w-[430px] items-center justify-between px-1">
        <div
          className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
          role="status"
          aria-live="polite"
          aria-label={done ? "You did it!" : cheer ? "Great!" : "Tap the tile that comes next"}
          style={{
            background: done ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
            border: `2px solid ${done ? ACCENT : "var(--color-line, #33405c)"}`,
            boxShadow: done ? `0 0 18px ${ACCENT}66` : undefined,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              animation: done
                ? "jcnext-pulse 0.8s ease-in-out infinite"
                : cheer
                  ? "jcnext-pop 0.4s ease both"
                  : "jcnext-breathe 2.6s ease-in-out infinite",
            }}
          >
            {done ? "🎉" : cheer ? "🌟" : "🔁"}
          </span>
          {done ? (
            <span aria-hidden="true">⭐⭐⭐</span>
          ) : (
            <span
              aria-hidden="true"
              className="text-xl"
              style={{ display: "inline-block", animation: "jcnext-bob 1.6s ease-in-out infinite" }}
            >
              👇
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5" aria-label={`Round ${Math.min(solvedRounds + 1, TOTAL)} of ${TOTAL}`}>
          {ROUNDS.map((_, i) => (
            <span
              key={i}
              className="block h-3 w-3 rounded-full transition-all"
              style={{
                background: i < solvedRounds ? ACCENT : "transparent",
                border: `2px solid ${i < solvedRounds ? ACCENT : "var(--color-line, #2a3340)"}`,
                boxShadow: i < solvedRounds ? `0 0 8px ${ACCENT}` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── The pattern row: shown tiles + the empty slot (filled on success) ── */}
      <div className="panel relative w-full max-w-[430px] overflow-hidden rounded-2xl border border-line p-3">
        <div className="grid min-h-[110px] place-items-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {current.shown.map((s, i) => (
              <PatternTile key={`shown-${round}-${i}`} glyph={s.glyph} label={s.word} kind="shown" />
            ))}
            {filled ? (
              <PatternTile glyph={filled.glyph} label={filled.word} kind="filled" />
            ) : (
              <PatternTile glyph="❓" label="empty slot — what comes next?" kind="empty" />
            )}
          </div>
        </div>
      </div>

      {/* ── Big choice tiles OR the big celebration ── */}
      {done ? (
        <div
          className="relative grid w-full max-w-[430px] place-items-center gap-2 py-4 text-center"
          style={{ animation: "jcnext-pop 0.5s ease both" }}
        >
          <Confetti />
          <div
            className="relative text-6xl"
            style={{ animation: "jcnext-dance 1.1s cubic-bezier(.34,1.56,.64,1) infinite", transformOrigin: "center bottom" }}
            aria-hidden="true"
          >
            🥳
          </div>
          <div className="flex gap-1.5 text-4xl" aria-label="Three stars, you did it">
            <span
              aria-hidden="true"
              style={{ display: "inline-block", animation: "jcnext-star 0.5s 0.15s cubic-bezier(.34,1.56,.64,1) both" }}
            >
              ⭐
            </span>
            <span
              aria-hidden="true"
              style={{ display: "inline-block", animation: "jcnext-star 0.5s 0.40s cubic-bezier(.34,1.56,.64,1) both" }}
            >
              ⭐
            </span>
            <span
              aria-hidden="true"
              style={{ display: "inline-block", animation: "jcnext-star 0.5s 0.65s cubic-bezier(.34,1.56,.64,1) both" }}
            >
              ⭐
            </span>
          </div>
          <div className="flex justify-center gap-2 text-3xl">
            <span className="animate-float" aria-hidden="true">
              ✨
            </span>
            <span className="animate-float" style={{ animationDelay: "0.2s" }} aria-hidden="true">
              🎉
            </span>
            <span className="animate-float" style={{ animationDelay: "0.4s" }} aria-hidden="true">
              ✨
            </span>
          </div>
        </div>
      ) : (
        <div
          className="grid w-full max-w-[430px] gap-3"
          style={{ gridTemplateColumns: `repeat(${current.choices.length}, minmax(0, 1fr))` }}
          aria-label="Choices — tap the one that comes next"
        >
          {current.choices.map((c, ci) => {
            const isWobbling = wobble === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={`Pick ${c.word}`}
                disabled={cheer || filled !== null}
                onPointerDown={(e) => {
                  e.preventDefault();
                  tap(c);
                }}
                className="grid aspect-square min-h-[72px] place-items-center rounded-2xl text-5xl transition-transform duration-200 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)] active:scale-90 disabled:opacity-50 sm:text-6xl"
                style={{
                  touchAction: "manipulation",
                  background: "rgba(34,211,238,0.10)",
                  border: `2px solid ${ACCENT}`,
                  boxShadow: `0 6px 0 0 #0e8aa0`,
                  animation: isWobbling
                    ? "jcnext-wobble 0.46s ease"
                    : "jcnext-breathe 2.8s ease-in-out infinite",
                  animationDelay: isWobbling ? undefined : `${ci * 0.35}s`,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    animation: isWobbling ? undefined : "jcnext-bounce 2.8s ease-in-out infinite",
                    animationDelay: isWobbling ? undefined : `${ci * 0.35 + 0.15}s`,
                  }}
                >
                  {isWobbling ? "🙈" : c.glyph}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Reset — big, friendly, always available ── */}
      <button
        type="button"
        aria-label="Start over"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-2xl transition active:scale-90"
        style={{
          touchAction: "none",
          background: "rgba(255,255,255,0.05)",
          border: "2px solid var(--color-line, #33405c)",
        }}
      >
        <span aria-hidden="true">🔄</span>
      </button>
    </div>
  );
}

type TileKind = "shown" | "filled" | "empty";

/** One big square in the pattern row. */
function PatternTile({ glyph, label, kind }: { glyph: string; label: string; kind: TileKind }) {
  const filled = kind === "filled";
  const empty = kind === "empty";
  return (
    <div
      aria-label={label}
      className="grid h-[54px] w-[54px] place-items-center rounded-xl border-2 text-3xl sm:h-[60px] sm:w-[60px] sm:text-4xl"
      style={{
        borderColor: empty || filled ? ACCENT : "var(--color-line, #2a3340)",
        borderStyle: empty ? "dashed" : "solid",
        background: filled ? "rgba(34,211,238,0.14)" : "var(--color-panel-2, #11161f)",
        boxShadow: filled ? `0 0 16px ${ACCENT}` : "none",
        animation: empty
          ? "jcnext-glow 1.4s ease-in-out infinite"
          : filled
            ? "jcnext-snap 0.55s cubic-bezier(.34,1.56,.64,1) both"
            : undefined,
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </div>
  );
}

/** A one-shot burst of confetti for the win celebration — pure transform/opacity. */
const CONFETTI_PIECES: { glyph: string; cx: number; cy: number; cr: number; delay: number }[] = [
  { glyph: "🎉", cx: -120, cy: -60, cr: -120, delay: 0 },
  { glyph: "✨", cx: 120, cy: -50, cr: 140, delay: 0.05 },
  { glyph: "⭐", cx: -90, cy: 70, cr: -90, delay: 0.1 },
  { glyph: "🎊", cx: 100, cy: 80, cr: 120, delay: 0.08 },
  { glyph: "💫", cx: -150, cy: 10, cr: -160, delay: 0.12 },
  { glyph: "🌟", cx: 150, cy: 20, cr: 160, delay: 0.06 },
  { glyph: "🎈", cx: -40, cy: -110, cr: -40, delay: 0.15 },
  { glyph: "✨", cx: 50, cy: -100, cr: 60, delay: 0.18 },
  { glyph: "⭐", cx: -70, cy: 110, cr: -70, delay: 0.22 },
  { glyph: "🎉", cx: 80, cy: 120, cr: 100, delay: 0.2 },
  { glyph: "💫", cx: -130, cy: -20, cr: -140, delay: 0.25 },
  { glyph: "🌟", cx: 130, cy: -30, cr: 150, delay: 0.28 },
];

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center" aria-hidden="true">
      {CONFETTI_PIECES.map((p, i) => (
        <span
          key={i}
          className="absolute text-2xl"
          style={
            {
              "--cx": `${p.cx}px`,
              "--cy": `${p.cy}px`,
              "--cr": `${p.cr}deg`,
              animation: `jcnext-confetti 1.1s ${p.delay}s cubic-bezier(.22,.61,.36,1) both`,
            } as CSSProperties
          }
        >
          {p.glyph}
        </span>
      ))}
    </div>
  );
}

const KEYFRAMES = `
@keyframes jcnext-wobble {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-7px) rotate(-6deg); }
  45% { transform: translateX(7px) rotate(6deg); }
  70% { transform: translateX(-5px) rotate(-4deg); }
  90% { transform: translateX(4px) rotate(3deg); }
}
@keyframes jcnext-pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
/* Springy snap-in: a placed part drops into its slot and bounces to rest. */
@keyframes jcnext-snap {
  0% { transform: translateY(-22px) scale(0.5); opacity: 0; }
  55% { transform: translateY(0) scale(1.22); opacity: 1; }
  72% { transform: translateY(-4px) scale(0.94); }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes jcnext-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
/* Big happy hop with a touch of squash-and-stretch for the win character. */
@keyframes jcnext-dance {
  0% { transform: translateY(0) scale(1, 1) rotate(0deg); }
  18% { transform: translateY(0) scale(1.15, 0.85); }
  42% { transform: translateY(-26px) scale(0.9, 1.12) rotate(-7deg); }
  62% { transform: translateY(-26px) scale(0.95, 1.08) rotate(7deg); }
  82% { transform: translateY(0) scale(1.12, 0.9); }
  100% { transform: translateY(0) scale(1, 1) rotate(0deg); }
}
/* Slow "breathing" idle so the waiting screen never feels frozen. */
@keyframes jcnext-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-4px) scale(1.06); }
}
/* Gentle continuous bob for the prompt cue. */
@keyframes jcnext-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(4px); }
}
@keyframes jcnext-glow {
  0%, 100% { box-shadow: 0 0 6px ${ACCENT}; transform: scale(1); }
  50% { box-shadow: 0 0 16px ${ACCENT}; transform: scale(1.07); }
}
/* Pulsing glow + tiny throb for the celebration trophy badge. */
@keyframes jcnext-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}
/* Stars pop in one at a time with a bouncy overshoot. */
@keyframes jcnext-star {
  0% { transform: scale(0) rotate(-30deg); opacity: 0; }
  55% { transform: scale(1.4) rotate(10deg); opacity: 1; }
  75% { transform: scale(0.9) rotate(-4deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
/* Confetti bursting outward then drifting down as it fades. */
@keyframes jcnext-confetti {
  0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translate(var(--cx), var(--cy)) scale(1) rotate(var(--cr)); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="jcnext-breathe"],
  [style*="jcnext-bob"],
  [style*="jcnext-glow"],
  [style*="jcnext-bounce"],
  [style*="jcnext-dance"],
  [style*="jcnext-pulse"],
  [style*="jcnext-confetti"],
  .animate-float {
    animation: none !important;
  }
}
`;
