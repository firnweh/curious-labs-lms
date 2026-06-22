"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/* ── Make It Go! 🟢 ────────────────────────────────────────────────────────────
   CLASS 1-3 (junior, age ~6-8) CODING lab. ONE goal: you give steps, then press
   GO to RUN them — and the NUMBER of steps matters (events / running a program).
   A turtle 🐢 sits at the far LEFT of a short track; an apple 🍎 waits a few cells
   right. Tap the big ➡️ STEP card to drop footprints into a row of step-slots,
   then tap the huge green GO ▶ to run them — the turtle walks that many cells.
   Land EXACTLY on the apple → big win (confetti, ⭐⭐⭐, onComplete once). Too few
   or too many → the turtle stops with a gentle 🙈 wobble and the steps clear so
   the child tries again. Always winnable, never scolds. NO READING REQUIRED —
   communicates with emoji, colour and shape. Touch-first, deterministic. */

const ACCENT = "#22d3ee";
const CELLS = 5; // track cells, 0 .. 4
const APPLE = 3; // turtle starts at 0; 3 steps lands on the apple
const MAX_STEPS = 5; // never more footprints than the track is long
const STEP_MS = 420; // walk speed, one cell per tick

type Phase = "idle" | "running" | "won" | "oops";

export default function MakeItGo({ onComplete }: ActivityProps) {
  const [steps, setSteps] = useState<number>(0); // footprints planned
  const [pos, setPos] = useState<number>(0); // turtle cell while/after running
  const [phase, setPhase] = useState<Phase>("idle");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);
  const audioRef = useRef<AudioContext | null>(null);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  // ── Soft optional sound, made on the user's gesture; never throws/blocks. ──
  const blip = useCallback((freq: number, dur: number): void => {
    try {
      type WinAudio = typeof AudioContext;
      const w = window as unknown as { webkitAudioContext?: WinAudio };
      const Ctx: WinAudio | undefined = window.AudioContext ?? w.webkitAudioContext;
      if (!Ctx) return;
      const ac = audioRef.current ?? new Ctx();
      audioRef.current = ac;
      if (ac.state === "suspended") void ac.resume();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur + 0.02);
    } catch {
      /* sound is a nicety — silently ignore any failure */
    }
  }, []);

  const chime = useCallback((): void => {
    [523, 659, 784, 1046].forEach((f, i) => {
      window.setTimeout(() => blip(f, 0.18), i * 120);
    });
  }, [blip]);

  const busy = phase === "running" || phase === "won";

  const addStep = useCallback((): void => {
    if (busy) return;
    blip(660, 0.08);
    setSteps((s) => Math.min(MAX_STEPS, s + 1));
    setPhase("idle");
    setPos(0);
  }, [busy, blip]);

  const clearSteps = useCallback((): void => {
    if (busy) return;
    blip(420, 0.07);
    setSteps(0);
    setPhase("idle");
    setPos(0);
  }, [busy, blip]);

  const reset = useCallback((): void => {
    clearTimer();
    reportedRef.current = false;
    setSteps(0);
    setPos(0);
    setPhase("idle");
  }, [clearTimer]);

  const go = useCallback((): void => {
    if (busy || steps === 0) {
      // Empty isn't a scold — a tiny nudge wobble, then settle.
      if (steps === 0) {
        setPhase("oops");
        timerRef.current = setTimeout(() => setPhase("idle"), 480);
      }
      return;
    }
    clearTimer();
    blip(523, 0.1);
    setPos(0);
    setPhase("running");

    // Walk: stop at the apple if reached, else at min(steps, last cell).
    const target = Math.min(steps, APPLE, CELLS - 1);
    let i = 0;
    const tick = (): void => {
      i += 1;
      setPos(i);
      if (i >= target) {
        const won = steps === APPLE;
        if (won) {
          setPhase("won");
          chime();
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({ passed: true, stars: 3, detail: "Landed on the apple! 🍎" });
          }
        } else {
          setPhase("oops");
          onComplete({
            passed: false,
            detail:
              steps < APPLE
                ? "So close — add one more step! 🐢"
                : "A little too far — try fewer steps! 🙈",
          });
          // Gentle: clear the footprints and send the turtle home to retry.
          timerRef.current = setTimeout(() => {
            setSteps(0);
            setPos(0);
            setPhase("idle");
          }, 900);
        }
        return;
      }
      timerRef.current = setTimeout(tick, STEP_MS);
    };
    timerRef.current = setTimeout(tick, STEP_MS);
  }, [busy, steps, clearTimer, blip, chime, onComplete]);

  const won = phase === "won";
  const oops = phase === "oops";
  const running = phase === "running";

  // ── Track geometry (virtual units; CSS scales it) ──
  const PAD = 8;
  const TILE = 64;
  const VW = PAD * 2 + CELLS * TILE;
  const VH = PAD * 2 + TILE;
  const cellX = (c: number): number => PAD + c * TILE + TILE / 2;
  const midY = PAD + TILE / 2;

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny emoji status (no sentences) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "You landed on the apple!"
            : running
              ? "The turtle is walking"
              : oops
                ? "Not quite, try again"
                : "Add steps, then press Go"
        }
        style={{
          background: won ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            animation: won ? "jcgo-cheer 0.7s cubic-bezier(.34,1.56,.64,1) infinite" : undefined,
          }}
        >
          {won ? "🎉" : oops ? "🤔" : running ? "🐾" : "🐢"}
        </span>
        {won ? (
          <span aria-hidden="true" className="inline-flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  animation: `jcgo-starpop 0.5s cubic-bezier(.34,1.56,.64,1) ${0.15 + i * 0.22}s both`,
                }}
              >
                ⭐
              </span>
            ))}
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            🐢➡️🍎
          </span>
        )}
        {won && <span aria-hidden="true">✨</span>}
      </div>

      {/* ── The track ── */}
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A turtle on the left of a track and an apple to reach"
        >
          {/* cells */}
          {Array.from({ length: CELLS }).map((_, c) => {
            const here = c === pos && (running || won || oops);
            return (
              <rect
                key={c}
                x={PAD + c * TILE + 2}
                y={PAD + 2}
                width={TILE - 4}
                height={TILE - 4}
                rx={12}
                fill={here ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.05)"}
                stroke={here ? ACCENT : "rgba(120,140,170,0.22)"}
                strokeWidth={here ? 2 : 1.2}
              />
            );
          })}

          {/* apple / goal */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: won
                ? "jcgo-applejoy 0.7s cubic-bezier(.34,1.56,.64,1) infinite"
                : "jcgo-bob 2.2s ease-in-out infinite",
            }}
          >
            <text
              x={cellX(APPLE)}
              y={midY + 1}
              fontSize={TILE * 0.56}
              textAnchor="middle"
              dominantBaseline="central"
              aria-label="apple to reach"
            >
              🍎
            </text>
          </g>

          {/* turtle */}
          <g
            style={{
              transform: `translate(${cellX(pos)}px, ${midY}px)`,
              transition: running ? `transform ${STEP_MS}ms ease-in-out` : "transform 160ms ease-out",
            }}
          >
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: oops
                  ? "jcgo-wobble 0.5s ease-in-out"
                  : running
                    ? "jcgo-hop 0.42s ease-in-out infinite"
                    : won
                      ? "jcgo-cheer 0.7s cubic-bezier(.34,1.56,.64,1) infinite"
                      : "jcgo-breathe 2.6s ease-in-out infinite",
              }}
            >
              <text
                x={0}
                y={1}
                fontSize={TILE * 0.6}
                textAnchor="middle"
                dominantBaseline="central"
                aria-label="turtle"
              >
                🐢
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* ── Step-slots: one footprint per planned step ── */}
      <div
        className="flex min-h-[56px] w-full max-w-[420px] items-center justify-center gap-2 rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
        }}
        aria-label={`${steps} steps planned`}
      >
        {Array.from({ length: MAX_STEPS }).map((_, i) => {
          const filled = i < steps;
          return (
            <span
              key={i}
              aria-hidden="true"
              className="grid h-10 w-10 place-items-center rounded-xl text-2xl transition"
              style={{
                background: filled ? "rgba(34,211,238,0.16)" : "rgba(255,255,255,0.03)",
                border: `2px solid ${filled ? ACCENT : "rgba(120,140,170,0.25)"}`,
                transform: filled ? "scale(1)" : "scale(0.92)",
                opacity: filled ? 1 : 0.5,
                animation:
                  filled && i === steps - 1
                    ? "jcgo-snap 0.42s cubic-bezier(.34,1.56,.64,1)"
                    : undefined,
              }}
            >
              {filled ? "👣" : ""}
            </span>
          );
        })}
      </div>

      {/* ── The two big controls: STEP and GO ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            addStep();
          }}
          disabled={busy || steps >= MAX_STEPS}
          aria-label="Add one step"
          className="jcgo-spring flex h-[78px] flex-1 items-center justify-center gap-2 rounded-3xl text-3xl font-extrabold disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(34,211,238,0.12)",
            border: `3px solid ${ACCENT}`,
            color: ACCENT,
            boxShadow: "0 6px 0 0 rgba(14,138,160,0.55)",
          }}
        >
          <span aria-hidden="true">👣</span>
          <span aria-hidden="true">➡️</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            go();
          }}
          disabled={busy}
          aria-label="Go — run the steps"
          className="jcgo-spring flex h-[78px] flex-1 items-center justify-center gap-2 rounded-3xl text-3xl font-black disabled:opacity-50"
          style={{
            touchAction: "none",
            background: "#34d399",
            color: "#062017",
            boxShadow: "0 6px 0 0 #0f8a5f",
            animation: !busy && steps > 0 ? "jcgo-ready 1.5s ease-in-out infinite" : undefined,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              animation: running ? "jcgo-paw 0.42s steps(2) infinite" : undefined,
            }}
          >
            {running ? "🐾" : "▶"}
          </span>
          <span aria-hidden="true" className="text-2xl">
            GO
          </span>
        </button>
      </div>

      {/* ── Tiny clear + reset ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            clearSteps();
          }}
          disabled={busy || steps === 0}
          aria-label="Clear the steps"
          className="jcgo-spring grid h-[52px] w-[52px] place-items-center rounded-2xl text-2xl disabled:opacity-30"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🧹</span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={running}
          aria-label="Start over"
          className="jcgo-spring grid h-[52px] w-[52px] place-items-center rounded-2xl text-2xl disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* celebration: confetti burst flying outward + happy floaters */}
      {won && (
        <div
          className="pointer-events-none relative flex h-10 w-full max-w-[420px] items-center justify-center text-2xl"
          aria-hidden="true"
        >
          {/* confetti particles burst out from the centre */}
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 text-xl"
              style={
                {
                  "--jcgo-dx": `${c.dx}px`,
                  "--jcgo-dy": `${c.dy}px`,
                  "--jcgo-rot": `${c.rot}deg`,
                  animation: `jcgo-burst 1.1s cubic-bezier(.2,.7,.3,1) ${c.delay}s infinite`,
                } as CSSProperties
              }
            >
              {c.emoji}
            </span>
          ))}
          {/* gentle bobbing cheer trio in front */}
          <span
            className="relative"
            style={{ animation: "jcgo-float 1.4s ease-in-out infinite" }}
          >
            ✨
          </span>
          <span
            className="relative mx-2"
            style={{ animation: "jcgo-float 1.4s ease-in-out 0.2s infinite" }}
          >
            🎉
          </span>
          <span
            className="relative"
            style={{ animation: "jcgo-float 1.4s ease-in-out 0.4s infinite" }}
          >
            ✨
          </span>
        </div>
      )}
    </div>
  );
}

/* Deterministic confetti particle layout: 12 bits fanning outward.
   Pure presentation — no randomness, no state. */
const CONFETTI: ReadonlyArray<{
  emoji: string;
  dx: number;
  dy: number;
  rot: number;
  delay: number;
}> = Array.from({ length: 12 }).map((_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  const reach = 64 + (i % 3) * 14;
  const emojis = ["🎉", "✨", "⭐", "🟢", "💛", "🎊"];
  return {
    emoji: emojis[i % emojis.length],
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach),
    rot: (i % 2 === 0 ? 1 : -1) * (180 + (i % 4) * 60),
    delay: (i % 6) * 0.06,
  };
});

const KEYFRAMES = `
@keyframes jcgo-wobble {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-13deg); }
  45% { transform: rotate(11deg); }
  70% { transform: rotate(-7deg); }
  90% { transform: rotate(4deg); }
}
/* turtle hop while running — squash on land, stretch at apex */
@keyframes jcgo-hop {
  0%   { transform: translateY(0) scaleX(1.08) scaleY(0.92); }
  35%  { transform: translateY(-7px) scaleX(0.94) scaleY(1.1); }
  60%  { transform: translateY(-9px) scaleX(0.96) scaleY(1.06); }
  100% { transform: translateY(0) scaleX(1.08) scaleY(0.92); }
}
/* slow, calm idle "breathing" so the turtle is never frozen */
@keyframes jcgo-breathe {
  0%, 100% { transform: translateY(0) scaleX(1) scaleY(1); }
  50%      { transform: translateY(-2px) scaleX(0.98) scaleY(1.04); }
}
/* turtle dances on win — little hop + happy tilt */
@keyframes jcgo-cheer {
  0%   { transform: translateY(0) rotate(0deg) scale(1); }
  30%  { transform: translateY(-10px) rotate(-9deg) scale(1.14); }
  55%  { transform: translateY(-4px) rotate(8deg) scale(1.08); }
  80%  { transform: translateY(-8px) rotate(-5deg) scale(1.12); }
  100% { transform: translateY(0) rotate(0deg) scale(1); }
}
@keyframes jcgo-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
/* footprint springs into its slot with an overshoot */
@keyframes jcgo-snap {
  0%   { transform: translateY(-12px) scale(0.4); opacity: 0; }
  60%  { transform: translateY(0) scale(1.18); opacity: 1; }
  80%  { transform: translateY(0) scale(0.94); }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes jcgo-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
/* GO button gently pulses when there are steps ready to run */
@keyframes jcgo-ready {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.04); }
}
/* paw icon shuffles while the turtle walks */
@keyframes jcgo-paw {
  0%, 100% { transform: translateY(0) rotate(-8deg); }
  50%      { transform: translateY(-2px) rotate(8deg); }
}
/* ⭐ pops in one at a time with a bounce */
@keyframes jcgo-starpop {
  0%   { transform: scale(0) rotate(-40deg); opacity: 0; }
  60%  { transform: scale(1.35) rotate(8deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
/* apple does a joyful springy bounce on win */
@keyframes jcgo-applejoy {
  0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
  30%      { transform: translateY(-6px) scale(1.22) rotate(-10deg); }
  60%      { transform: translateY(-2px) scale(1.1) rotate(8deg); }
}
/* confetti bit flies outward from centre, spins, then fades */
@keyframes jcgo-burst {
  0%   { transform: translate(-50%, -50%) scale(0.3) rotate(0deg); opacity: 0; }
  15%  { opacity: 1; }
  100% {
    transform:
      translate(calc(-50% + var(--jcgo-dx)), calc(-50% + var(--jcgo-dy)))
      scale(1) rotate(var(--jcgo-rot));
    opacity: 0;
  }
}
/* springy, toy-like press for every button */
.jcgo-spring {
  transition: transform 0.18s cubic-bezier(.34,1.56,.64,1);
  will-change: transform;
}
.jcgo-spring:active:not(:disabled) {
  transform: scale(0.9);
}
@media (prefers-reduced-motion: reduce) {
  /* stop looping idle/celebration motion; keep one-shot pop-ins gentle */
  [style*="infinite"] { animation: none !important; }
  .jcgo-spring { transition: none; }
}
`;
