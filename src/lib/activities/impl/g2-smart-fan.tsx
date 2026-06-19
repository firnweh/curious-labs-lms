"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Smart Fan 🌀 ─────────────────────────────────────────────────────────────
   JUNIOR (Grade 2, age ~7) ROBOTICS. Single learning goal: a SENSOR READING
   causes an ACTION — cause and effect. A temperature gauge shows the room as
   COLD ❄️, WARM 🌤️, or HOT ☀️ across THREE rounds. RULE the child discovers:
   when it is HOT the fan must be ON; when COLD the fan must be OFF; WARM is the
   child's call (either answer is accepted). The child taps the big POWER button
   to set the fan, then taps NEXT to check. Blades spin via CSS rotation while on.
   A right call cheers and advances; a wrong call gives a gentle nudge and lets
   them try again — never a dead end. Three correct calls → big celebration and
   onComplete({passed:true, stars:3}) ONCE. Reset restarts at Round 1. No reading
   strictly required: the gauge, the fan and the rule are all shown as pictures. */

const ACCENT = "#34d399";

/** A room temperature reading from the heat sensor. */
type Temp = "cold" | "warm" | "hot";

interface Round {
  /** Sensor reading for this round. */
  temp: Temp;
  /** Fan states that count as correct. WARM accepts both. */
  accept: readonly boolean[]; // true = fan ON, false = fan OFF
}

/** Three rounds: HOT → needs ON, COLD → needs OFF, WARM → either is fine. */
const ROUNDS: readonly Round[] = [
  { temp: "hot", accept: [true] },
  { temp: "cold", accept: [false] },
  { temp: "warm", accept: [true, false] },
];

const TOTAL = ROUNDS.length;

interface TempInfo {
  glyph: string;
  word: string;
  /** Gauge fill 0..1 (cold low, hot high). */
  level: number;
  /** Gauge colour. */
  color: string;
}

const TEMP_INFO: Record<Temp, TempInfo> = {
  cold: { glyph: "❄️", word: "cold", level: 0.18, color: "#38bdf8" },
  warm: { glyph: "🌤️", word: "warm", level: 0.55, color: "#fbbf24" },
  hot: { glyph: "☀️", word: "hot", level: 0.92, color: "#fb7185" },
};

export default function SmartFan({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  /** Current fan setting the child has chosen for THIS round. */
  const [fanOn, setFanOn] = useState<boolean>(false);
  /** Gentle nudge after a wrong NEXT; clears on the next change. */
  const [nudge, setNudge] = useState<boolean>(false);
  /** Quick cheer between rounds. */
  const [cheer, setCheer] = useState<boolean>(false);
  /** True once all three rounds are answered correctly. */
  const [done, setDone] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const cheerTimer = useRef<number | null>(null);
  const nudgeTimer = useRef<number | null>(null);

  const current = ROUNDS[round];
  const info = TEMP_INFO[current.temp];
  const solvedRounds = done ? TOTAL : round;

  const clearTimers = useCallback(() => {
    if (cheerTimer.current !== null) window.clearTimeout(cheerTimer.current);
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
    cheerTimer.current = null;
    nudgeTimer.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Report success exactly once when all rounds are solved.
  useEffect(() => {
    if (done && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail: "Your fan reacts to the heat — sensor in, action out! 🌀",
      });
    }
    if (!done) reportedRef.current = false;
  }, [done, onComplete]);

  /** Flip the fan power. Choosing again clears any standing nudge. */
  const togglePower = useCallback(() => {
    if (done || cheer) return;
    setNudge(false);
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
    setFanOn((on) => !on);
  }, [done, cheer]);

  /** Check the current setting against the sensor rule. */
  const check = useCallback(() => {
    if (done || cheer) return;
    const ok = current.accept.includes(fanOn);
    if (!ok) {
      // Gentle, recoverable nudge — never a dead end.
      setNudge(true);
      if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
      nudgeTimer.current = window.setTimeout(() => setNudge(false), 1600);
      onComplete({
        passed: false,
        detail:
          current.temp === "hot"
            ? "It's HOT ☀️ — the fan should be ON to cool the room. Try again!"
            : "It's COLD ❄️ — no need for the fan. Switch it OFF and try again!",
      });
      return;
    }
    // Correct → quick cheer, then advance or finish.
    setNudge(false);
    setCheer(true);
    if (cheerTimer.current !== null) window.clearTimeout(cheerTimer.current);
    cheerTimer.current = window.setTimeout(() => {
      if (round + 1 >= TOTAL) {
        setDone(true);
      } else {
        setRound((r) => r + 1);
        setFanOn(false);
        setCheer(false);
      }
    }, 1000);
  }, [done, cheer, current.accept, current.temp, fanOn, round, onComplete]);

  const reset = useCallback(() => {
    clearTimers();
    setRound(0);
    setFanOn(false);
    setNudge(false);
    setCheer(false);
    setDone(false);
  }, [clearTimers]);

  // Status emoji (no reading): celebrating, cheering, nudge, or "your turn".
  const statusEmoji = useMemo<string>(() => {
    if (done) return "🎉";
    if (cheer) return "🌟";
    if (nudge) return "🤔";
    return "👇";
  }, [done, cheer, nudge]);

  const statusLabel = done
    ? "All done! Your smart fan reacts to the heat."
    : cheer
      ? "Nice! The fan matches the room."
      : nudge
        ? "Not quite — try the other fan setting."
        : `The room is ${info.word}. Set the fan, then tap Next.`;

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Status pill + progress dots ── */}
      <div className="flex w-full max-w-[420px] items-center justify-between px-1">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-2xl"
          role="status"
          aria-live="polite"
          aria-label={statusLabel}
          style={{
            background: done ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.04)",
            border: `2px solid ${done ? ACCENT : "var(--color-line, #33405c)"}`,
            boxShadow: done ? `0 0 18px ${ACCENT}66` : undefined,
          }}
        >
          <span aria-hidden="true">{statusEmoji}</span>
          {done ? (
            <span aria-hidden="true" className="text-2xl">
              ⭐⭐⭐
            </span>
          ) : (
            <span aria-hidden="true" className="text-xl">
              🌀
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-1.5"
          aria-label={`Round ${Math.min(round + 1, TOTAL)} of ${TOTAL}`}
        >
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

      {/* ── The room: temperature gauge + the fan ── */}
      <div className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-3">
        <div className="flex items-center justify-center gap-4">
          {/* Temperature gauge (the sensor reading). */}
          <div className="flex flex-col items-center gap-1.5">
            <span aria-hidden="true" className="text-3xl">
              {info.glyph}
            </span>
            <div
              className="relative h-[150px] w-[26px] overflow-hidden rounded-full"
              role="img"
              aria-label={`Heat sensor reads ${info.word}`}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "2px solid var(--color-line, #33405c)",
              }}
            >
              <div
                className="absolute inset-x-0 bottom-0 rounded-full"
                style={{
                  height: `${Math.round(info.level * 100)}%`,
                  background: info.color,
                  boxShadow: `0 0 12px ${info.color}`,
                  transition: "height 350ms ease, background 350ms ease",
                }}
              />
            </div>
            <span aria-hidden="true" className="text-[11px] uppercase tracking-widest opacity-70">
              {info.word}
            </span>
          </div>

          {/* The fan (the action). */}
          <div
            className="flex flex-col items-center gap-1.5"
            aria-label={fanOn ? "The fan is spinning" : "The fan is still"}
            role="img"
          >
            <svg
              viewBox="0 0 120 120"
              className="block h-[150px] w-[150px] select-none"
              style={{ touchAction: "none" }}
              aria-hidden="true"
            >
              <circle
                cx="60"
                cy="60"
                r="56"
                fill="rgba(255,255,255,0.04)"
                stroke={fanOn ? ACCENT : "var(--color-line, #33405c)"}
                strokeWidth="3"
                style={{ transition: "stroke 250ms ease" }}
              />
              <g
                style={{
                  transformOrigin: "60px 60px",
                  animation: fanOn ? "g2smartfan-spin 0.9s linear infinite" : "none",
                }}
              >
                {[0, 1, 2, 3].map((i) => (
                  <ellipse
                    key={i}
                    cx="60"
                    cy="33"
                    rx="13"
                    ry="26"
                    fill={fanOn ? ACCENT : "#5b6b86"}
                    opacity={fanOn ? 0.95 : 0.6}
                    transform={`rotate(${i * 90} 60 60)`}
                    style={{ transition: "fill 250ms ease" }}
                  />
                ))}
                <circle cx="60" cy="60" r="9" fill="#0b1220" stroke={fanOn ? ACCENT : "#5b6b86"} strokeWidth="3" />
              </g>
            </svg>
            <span
              className="rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest"
              aria-hidden="true"
              style={{
                color: fanOn ? "#06281d" : "#9fb0c8",
                background: fanOn ? ACCENT : "rgba(255,255,255,0.05)",
                border: `2px solid ${fanOn ? ACCENT : "var(--color-line, #33405c)"}`,
              }}
            >
              {fanOn ? "ON" : "OFF"}
            </span>
          </div>
        </div>

        {/* Emoji status line under the room. */}
        <div className="mt-2 flex items-center justify-center text-2xl" aria-hidden="true">
          <span style={{ animation: nudge ? "g2smartfan-wobble 0.5s ease" : undefined }}>
            {statusEmoji}
          </span>
        </div>
      </div>

      {/* ── Controls OR the big celebration ── */}
      {done ? (
        <div
          className="grid place-items-center gap-2 py-3 text-center"
          style={{ animation: "g2smartfan-pop 0.5s ease both" }}
        >
          <div className="text-6xl" style={{ animation: "g2smartfan-bounce 1s ease-in-out infinite" }}>
            🎉
          </div>
          <div className="flex gap-1.5 text-3xl" aria-label="Three stars, you did it">
            <span style={{ animation: "g2smartfan-pop 0.4s 0.05s ease both" }}>⭐</span>
            <span style={{ animation: "g2smartfan-pop 0.4s 0.20s ease both" }}>⭐</span>
            <span style={{ animation: "g2smartfan-pop 0.4s 0.35s ease both" }}>⭐</span>
          </div>
          <div className="flex gap-2 text-2xl" aria-hidden="true">
            <span className="animate-float">✨</span>
            <span className="animate-float" style={{ animationDelay: "0.3s" }}>
              🌀
            </span>
            <span className="animate-float" style={{ animationDelay: "0.6s" }}>
              ✨
            </span>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-[420px] flex-col items-stretch gap-2">
          {/* Big POWER toggle. */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              togglePower();
            }}
            disabled={cheer}
            aria-label={fanOn ? "Turn the fan power off" : "Turn the fan power on"}
            aria-pressed={fanOn}
            className="flex h-[68px] items-center justify-center gap-3 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
            style={{
              touchAction: "none",
              background: fanOn ? ACCENT : "rgba(52,211,153,0.10)",
              color: fanOn ? "#06281d" : ACCENT,
              border: `2px solid ${ACCENT}`,
              boxShadow: fanOn ? `0 6px 0 0 #0f8f66` : undefined,
            }}
          >
            <span aria-hidden="true" className="text-3xl">
              ⏻
            </span>
            <span aria-hidden="true" className="text-xl font-extrabold tracking-widest">
              POWER {fanOn ? "ON" : "OFF"}
            </span>
          </button>

          {/* NEXT (check) + Reset. */}
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                check();
              }}
              disabled={cheer}
              aria-label="Check the fan and go to the next room"
              className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
              style={{
                touchAction: "none",
                background: "rgba(255,255,255,0.05)",
                color: ACCENT,
                border: `2px solid ${ACCENT}`,
              }}
            >
              <span aria-hidden="true" className="text-xl font-extrabold tracking-widest">
                NEXT
              </span>
              <span aria-hidden="true">➡️</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                reset();
              }}
              aria-label="Start over"
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
        </div>
      )}
    </div>
  );
}

const KEYFRAMES = `
@keyframes g2smartfan-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes g2smartfan-wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-12deg); }
  55% { transform: rotate(10deg); }
  80% { transform: rotate(-5deg); }
}
@keyframes g2smartfan-pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes g2smartfan-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
