"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Sound Toy 🔊 — a JUNIOR (Grade 2, age ~7) AI activity: SOUND SENSING.
 * Concept: a sound sensor compares LOUDNESS to a THRESHOLD line to DECIDE —
 * the machine listens and reacts. A vertical loudness METER fills as the child
 * taps a big CLAP 👏 button (each tap adds loudness; it gently DECAYS over
 * time). A dashed THRESHOLD line crosses the meter, and a toy 🤖 lights up and
 * DANCES whenever loudness rises above that line.
 *
 * Two rounds teach BOTH sides of the compare:
 *   Round 1 "Make it dance!" — clap loud enough to push the meter OVER the line
 *           → the toy wakes up. Cross it once to clear the round.
 *   Round 2 "Keep it still!" — stop clapping and stay BELOW the line for a short
 *           moment → the toy rests. A quiet hold clears the round.
 * Both rounds done → big celebration + onComplete({passed:true,stars:3}) once.
 *
 * No reading required (emoji + a meter you can watch). Touch-first, big targets,
 * deterministic, and ALWAYS winnable — there is no way to get stuck. A wrong
 * move (clapping during "keep it still") only resets that round's quiet timer
 * with a gentle nudge — never a scold.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#a855f7";

/** Loudness lives on a 0..100 scale. */
const MAX_LOUD = 100;
/** The sensor's decision line. Above = LOUD, below/at = QUIET. */
const THRESHOLD = 60;
/** Each clap adds this much loudness (two solid claps clear the line). */
const CLAP_GAIN = 34;
/** Loudness lost per animation frame-ish tick while no clapping happens. */
const DECAY_PER_TICK = 2.4;
/** How often the meter updates / decays (ms). */
const TICK_MS = 60;
/** Round 2: how long (ms) loudness must stay at/below the line to win. */
const QUIET_HOLD_MS = 1500;

type Phase = "round1" | "round2" | "won";

/** Visual layout for the meter (virtual SVG units; CSS scales it). */
const METER_W = 96;
const METER_H = 260;
const METER_PAD = 14;
const BAR_X = METER_PAD;
const BAR_Y = METER_PAD;
const BAR_W = METER_W - METER_PAD * 2;
const BAR_H = METER_H - METER_PAD * 2;

/** Map a 0..100 loudness to a y pixel (top of the filled portion). */
const loudToY = (loud: number): number =>
  BAR_Y + BAR_H - (Math.max(0, Math.min(MAX_LOUD, loud)) / MAX_LOUD) * BAR_H;

export default function SoundToy({ onComplete }: ActivityProps) {
  /** Current loudness, 0..100. */
  const [loud, setLoud] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("round1");
  /** True while the CLAP button is being held down (adds loudness each tick). */
  const [holding, setHolding] = useState<boolean>(false);
  /** Round 2: fraction 0..1 of the quiet hold completed (for the progress ring). */
  const [quietFrac, setQuietFrac] = useState<number>(0);
  /** Brief "shh" nudge flash when the child claps during "keep it still". */
  const [shh, setShh] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shhRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Wall-clock ms accumulated below the line during round 2. */
  const quietMsRef = useRef<number>(0);
  /** Mirrors `holding` for the interval closure without re-subscribing it. */
  const holdingRef = useRef<boolean>(false);
  /** Mirrors `phase` for the interval closure. */
  const phaseRef = useRef<Phase>("round1");

  useEffect(() => {
    holdingRef.current = holding;
  }, [holding]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const over = loud > THRESHOLD;

  const clearShh = useCallback(() => {
    if (shhRef.current !== null) {
      clearTimeout(shhRef.current);
      shhRef.current = null;
    }
  }, []);

  // ── The heartbeat: decay loudness, drive the toy, judge each round. ──
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setLoud((prev) => {
        const add = holdingRef.current ? CLAP_GAIN * 0.5 : 0; // held = steady noise
        const next = Math.max(0, Math.min(MAX_LOUD, prev + add - DECAY_PER_TICK));
        const ph = phaseRef.current;

        if (ph === "round1") {
          // Win the instant loudness pushes the meter above the line.
          if (next > THRESHOLD) {
            setPhase("round2");
            quietMsRef.current = 0;
            setQuietFrac(0);
          }
        } else if (ph === "round2") {
          // Stay at/below the line to fill the quiet timer; any noise resets it.
          if (next <= THRESHOLD) {
            quietMsRef.current += TICK_MS;
            const frac = Math.min(1, quietMsRef.current / QUIET_HOLD_MS);
            setQuietFrac(frac);
            if (quietMsRef.current >= QUIET_HOLD_MS) {
              setPhase("won");
            }
          } else {
            quietMsRef.current = 0;
            setQuietFrac(0);
          }
        }
        return next;
      });
    }, TICK_MS);

    return () => {
      if (tickRef.current !== null) clearInterval(tickRef.current);
    };
  }, []);

  // Report success exactly once, guarded by the ref.
  useEffect(() => {
    if (phase === "won" && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail: "Your sound sensor listened and reacted! 🔊",
      });
    }
  }, [phase, onComplete]);

  useEffect(() => () => clearShh(), [clearShh]);

  const clap = useCallback(() => {
    if (phase === "won") return;
    // During "keep it still", a clap is not a fail — just a gentle "shh".
    if (phase === "round2") {
      setShh(true);
      clearShh();
      shhRef.current = setTimeout(() => setShh(false), 700);
    }
    setLoud((prev) => Math.min(MAX_LOUD, prev + CLAP_GAIN));
  }, [phase, clearShh]);

  const reset = useCallback(() => {
    reportedRef.current = false;
    quietMsRef.current = 0;
    holdingRef.current = false;
    phaseRef.current = "round1";
    clearShh();
    setLoud(0);
    setPhase("round1");
    setHolding(false);
    setQuietFrac(0);
    setShh(false);
  }, [clearShh]);

  const won = phase === "won";

  // ── Status emoji + aria (no paragraphs of reading). ──
  const statusEmoji = useMemo<string>(() => {
    if (won) return "🎉";
    if (shh) return "🤫";
    if (phase === "round1") return over ? "🥳" : "👏";
    return over ? "🔊" : "🤫"; // round 2
  }, [won, shh, phase, over]);

  const statusAria = won
    ? "You did it! The toy danced and then rested."
    : phase === "round1"
      ? over
        ? "Loud! The toy is dancing."
        : "Round 1. Clap loud enough to cross the line and wake the toy."
      : over
        ? "Too loud — let it go quiet to keep the toy still."
        : "Round 2. Stay quiet below the line to let the toy rest.";

  const fillY = loudToY(loud);
  const lineY = loudToY(THRESHOLD);

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      {/* ── Tiny visual status ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusAria}
        style={{
          background: won ? "rgba(168,85,247,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {won ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="text-base font-bold" style={{ color: ACCENT }}>
            {phase === "round1" ? "1 · Make it dance!" : "2 · Keep it still!"}
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── Stage: the loudness meter + the toy ── */}
      <div className="panel relative flex w-full max-w-[420px] items-center justify-center gap-5 overflow-hidden rounded-2xl border border-line p-4">
        {/* The meter */}
        <svg
          viewBox={`0 0 ${METER_W} ${METER_H}`}
          className="block h-[260px] w-[96px] select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label={`Loudness meter. ${over ? "Above" : "Below"} the line.`}
        >
          <defs>
            <linearGradient id="g2soundtoy-fill" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#6d28d9" />
              <stop offset="100%" stopColor={ACCENT} />
            </linearGradient>
          </defs>

          {/* meter track */}
          <rect
            x={BAR_X}
            y={BAR_Y}
            width={BAR_W}
            height={BAR_H}
            rx={14}
            fill="rgba(255,255,255,0.05)"
            stroke="rgba(120,140,170,0.30)"
            strokeWidth={1.5}
          />

          {/* the live loudness fill (clipped to the rounded track) */}
          <clipPath id="g2soundtoy-clip">
            <rect x={BAR_X} y={BAR_Y} width={BAR_W} height={BAR_H} rx={14} />
          </clipPath>
          <g clipPath="url(#g2soundtoy-clip)">
            <rect
              x={BAR_X}
              y={fillY}
              width={BAR_W}
              height={BAR_Y + BAR_H - fillY}
              fill="url(#g2soundtoy-fill)"
              style={{
                transition: `y ${TICK_MS}ms linear, height ${TICK_MS}ms linear`,
                filter: over ? `drop-shadow(0 0 8px ${ACCENT})` : undefined,
              }}
            />
          </g>

          {/* the THRESHOLD line — the sensor's decision boundary */}
          <line
            x1={BAR_X - 4}
            y1={lineY}
            x2={BAR_X + BAR_W + 4}
            y2={lineY}
            stroke={over ? "#fbbf24" : ACCENT}
            strokeWidth={3}
            strokeDasharray="6 5"
            style={{ transition: "stroke 120ms ease" }}
          />
          <text
            x={METER_W / 2}
            y={lineY - 7}
            fontSize={16}
            textAnchor="middle"
            dominantBaseline="central"
            aria-hidden="true"
          >
            📏
          </text>
        </svg>

        {/* The toy that listens + reacts */}
        <div className="relative grid place-items-center" style={{ width: 130, height: 200 }}>
          {/* sound waves shown only when over the line */}
          {over && !won && (
            <>
              <span
                aria-hidden="true"
                className="absolute text-2xl"
                style={{ left: 2, top: 70, animation: "g2soundtoy-wave 0.9s ease-in-out infinite" }}
              >
                〰️
              </span>
              <span
                aria-hidden="true"
                className="absolute text-2xl"
                style={{
                  right: 2,
                  top: 70,
                  animation: "g2soundtoy-wave 0.9s ease-in-out infinite",
                  animationDelay: "0.3s",
                }}
              >
                〰️
              </span>
            </>
          )}

          <div
            aria-hidden="true"
            className="grid h-[110px] w-[110px] place-items-center rounded-3xl text-6xl"
            style={{
              background: over || won ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.04)",
              border: `3px solid ${over || won ? ACCENT : "var(--color-line, #33405c)"}`,
              boxShadow: over || won ? `0 0 26px ${ACCENT}88` : "none",
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: won
                ? "g2soundtoy-cheer 0.9s ease-in-out infinite"
                : over
                  ? "g2soundtoy-dance 0.5s ease-in-out infinite"
                  : "g2soundtoy-rest 2.4s ease-in-out infinite",
            }}
          >
            {won ? "🥳" : over ? "🤖" : "😴"}
          </div>

          {/* tiny eyes / state caption (emoji only) */}
          <div aria-hidden="true" className="absolute bottom-1 text-xl">
            {over ? "💡" : "🌙"}
          </div>
        </div>
      </div>

      {/* ── Round 2 quiet-hold progress (only while keeping still) ── */}
      {phase === "round2" && (
        <div
          className="flex w-full max-w-[420px] items-center gap-2 rounded-full px-4 py-2"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `2px solid ${shh ? "#fbbf24" : "var(--color-line, #33405c)"}`,
          }}
          aria-hidden="true"
        >
          <span className="text-xl">🤫</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(quietFrac * 100)}%`,
                background: ACCENT,
                transition: `width ${TICK_MS}ms linear`,
                boxShadow: quietFrac > 0 ? `0 0 10px ${ACCENT}` : "none",
              }}
            />
          </div>
          <span className="text-xl">{quietFrac >= 1 ? "✅" : "💤"}</span>
        </div>
      )}

      {/* ── The big CLAP button (tap or hold) ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          setHolding(true);
          holdingRef.current = true;
          clap();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          setHolding(false);
          holdingRef.current = false;
        }}
        onPointerLeave={() => {
          setHolding(false);
          holdingRef.current = false;
        }}
        onPointerCancel={() => {
          setHolding(false);
          holdingRef.current = false;
        }}
        disabled={won}
        aria-label="Clap to make a sound. Tap fast or hold to get louder."
        className="flex h-[88px] w-full max-w-[420px] items-center justify-center gap-3 rounded-3xl text-3xl font-extrabold transition active:scale-95 disabled:opacity-50"
        style={{
          touchAction: "none",
          background: ACCENT,
          color: "#10031f",
          boxShadow: `0 7px 0 0 #7e22ce`,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            transformOrigin: "center",
            animation: holding ? "g2soundtoy-clap 0.3s ease-in-out infinite" : undefined,
          }}
        >
          👏
        </span>
        <span aria-hidden="true" className="text-2xl">
          CLAP
        </span>
      </button>

      {/* ── Reset ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over"
        className="grid h-[56px] w-[56px] place-items-center rounded-2xl text-2xl transition active:scale-90"
        style={{
          touchAction: "none",
          background: "rgba(255,255,255,0.05)",
          border: "2px solid var(--color-line, #33405c)",
        }}
      >
        <span aria-hidden="true">🔄</span>
      </button>

      {/* celebratory floaters when solved */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
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
      )}

      <style>{`
        @keyframes g2soundtoy-dance {
          0%, 100% { transform: rotate(-7deg) translateY(0); }
          50% { transform: rotate(7deg) translateY(-6px); }
        }
        @keyframes g2soundtoy-rest {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes g2soundtoy-cheer {
          0%, 100% { transform: translateY(0) scale(1.05); }
          50% { transform: translateY(-10px) scale(1.12); }
        }
        @keyframes g2soundtoy-clap {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.22) rotate(-10deg); }
        }
        @keyframes g2soundtoy-wave {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
