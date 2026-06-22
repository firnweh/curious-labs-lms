"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Magic Eye 👀 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 * ONE learning goal: a SENSOR lets a robot notice something and react on its
 * own — sensor → action. Here a night-light robot has a big 👁️ light sensor.
 * The child taps the eye to ARM the sensor, then steps through 3 ☀️/🌙 scenes.
 * RULE: when it is NIGHT the lamp turns ON by itself; in DAY it stays off.
 * The robot reacts automatically once armed, so it is ALWAYS winnable. Tapping
 * the BIG check confirms each scene; after all 3 correct reactions → party +
 * onComplete({passed:true,stars:3}) once. No reading needed: emoji + colour.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";
const SCENES: readonly ("day" | "night")[] = ["day", "night", "day"];
const TOTAL = SCENES.length;

type Phase = "arm" | "play" | "win";

export default function JrSensor({ onComplete }: ActivityProps) {
  const [phase, setPhase] = useState<Phase>("arm");
  const [armed, setArmed] = useState<boolean>(false);
  const [scene, setScene] = useState<number>(0);
  const [good, setGood] = useState<number>(0); // scenes confirmed correct
  const [blink, setBlink] = useState<boolean>(false);
  const [nudge, setNudge] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const blinkTimer = useRef<number | null>(null);
  const nudgeTimer = useRef<number | null>(null);

  const isNight = SCENES[scene] === "night";
  const lampOn = armed && isNight; // the sensor's automatic reaction
  const won = phase === "win";

  const clearTimers = useCallback((): void => {
    if (blinkTimer.current !== null) window.clearTimeout(blinkTimer.current);
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
  }, []);

  // Tap the eye → arm the sensor and start the scenes. A happy blink.
  const armSensor = useCallback((): void => {
    if (phase !== "arm") return;
    setArmed(true);
    setPhase("play");
    setBlink(true);
    if (blinkTimer.current !== null) window.clearTimeout(blinkTimer.current);
    blinkTimer.current = window.setTimeout(() => setBlink(false), 420);
  }, [phase]);

  // Big check: confirm the robot reacted right to THIS scene, advance.
  const confirm = useCallback((): void => {
    if (phase !== "play") return;
    setBlink(true);
    if (blinkTimer.current !== null) window.clearTimeout(blinkTimer.current);
    blinkTimer.current = window.setTimeout(() => setBlink(false), 380);

    const nextGood = good + 1;
    setGood(nextGood);
    if (nextGood >= TOTAL) {
      setPhase("win");
    } else {
      setScene((s) => s + 1);
    }
  }, [phase, good]);

  // Tapping the lamp by hand is "cheating" the sensor — gentle wobble nudge.
  const handLamp = useCallback((): void => {
    if (phase !== "play") return;
    setNudge(true);
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(() => setNudge(false), 520);
    onComplete({ passed: false, detail: "Let the eye do it — the sensor turns the light on by itself! 👀" });
  }, [phase, onComplete]);

  const reset = useCallback((): void => {
    clearTimers();
    reportedRef.current = false;
    setPhase("arm");
    setArmed(false);
    setScene(0);
    setGood(0);
    setBlink(false);
    setNudge(false);
  }, [clearTimers]);

  useEffect(() => {
    if (won && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3, detail: "The sensor reacted to every scene! 👀💡" });
    }
  }, [won, onComplete]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const statusEmoji = won ? "🎉" : phase === "arm" ? "👁️" : lampOn ? "💡" : "🌞";

  // Sky gradient: warm day vs deep night, smoothly cross-fades.
  const sky = isNight
    ? "linear-gradient(180deg, #0a1230 0%, #131b46 60%, #1c2350 100%)"
    : "linear-gradient(180deg, #2a4d8f 0%, #4f86d6 55%, #8fc0f0 100%)";

  return (
    <div className="flex w-full flex-col items-center gap-3" style={{ maxWidth: 430 }}>
      {/* ── Tiny emoji status ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "The sensor reacted to every scene!"
            : phase === "arm"
              ? "Tap the big eye to turn on the sensor"
              : isNight
                ? "It is night — the light should be on"
                : "It is day — the light should be off"
        }
        style={{
          background: won ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.05)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #27314f)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {won ? (
          <span aria-hidden="true" className="text-2xl">⭐⭐⭐</span>
        ) : (
          <span aria-hidden="true" className="text-xl">{isNight ? "🌙→💡" : "☀️→🌑"}</span>
        )}
      </div>

      {/* ── The scene: sky + robot ── */}
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-line"
        style={{ background: sky, transition: "background 700ms ease", touchAction: "manipulation" }}
      >
        <svg
          viewBox="0 0 360 300"
          className="block w-full select-none"
          role="img"
          aria-label="A night-light robot with a big eye sensor under a sky that is day or night."
        >
          <defs>
            <radialGradient id="js-lampGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffe08a" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffe08a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="js-eyeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Sun / Moon up in the sky, gently bobbing */}
          <g
            style={{
              transformBox: "view-box",
              transformOrigin: "center",
              animation: "jrsensor-float 3s ease-in-out infinite",
            }}
          >
            <text x="300" y="56" fontSize="40" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
              {isNight ? "🌙" : "☀️"}
            </text>
          </g>
          {/* Stars only at night */}
          {isNight && (
            <g aria-hidden="true">
              <text x="70" y="46" fontSize="16" style={{ animation: "jrsensor-twinkle 2s ease-in-out infinite" }}>✨</text>
              <text x="140" y="34" fontSize="13" style={{ animation: "jrsensor-twinkle 2.4s ease-in-out infinite 0.4s" }}>⭐</text>
              <text x="210" y="50" fontSize="14" style={{ animation: "jrsensor-twinkle 2.2s ease-in-out infinite 0.8s" }}>✨</text>
            </g>
          )}

          {/* Warm lamp glow when the light is on */}
          {lampOn && (
            <circle cx="180" cy="96" r="92" fill="url(#js-lampGlow)" style={{ animation: "jrsensor-glow 1.6s ease-in-out infinite" }} />
          )}

          {/* ── Robot body — gently breathes while idle ── */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center bottom",
              animation: won
                ? "jrsensor-celebrate 0.7s ease-in-out infinite"
                : nudge
                  ? "jrsensor-wobble 0.5s ease-in-out"
                  : "jrsensor-breathe 2.6s ease-in-out infinite",
            }}
          >
            {/* The lamp on its head */}
            <g onPointerDown={handLamp} style={{ cursor: phase === "play" ? "pointer" : "default" }}>
              {/* lamp stalk */}
              <rect x="174" y="120" width="12" height="26" rx="6" fill="#1d2b46" stroke="#41527a" strokeWidth="2" />
              {/* bulb */}
              <circle
                cx="180"
                cy="110"
                r="22"
                fill={lampOn ? "#ffe08a" : "#26324f"}
                stroke={lampOn ? "#ffd25e" : "#41527a"}
                strokeWidth="3"
                style={{
                  filter: lampOn ? "drop-shadow(0 0 10px #ffe08a)" : undefined,
                  transition: "fill 400ms ease, stroke 400ms ease",
                }}
              />
              <text x="180" y="112" fontSize="22" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                {lampOn ? "💡" : "🔌"}
              </text>
            </g>

            {/* Robot head/body box */}
            <rect x="120" y="150" width="120" height="110" rx="24" fill="#101a30" stroke={ACCENT} strokeWidth="4" />

            {/* The BIG EYE sensor */}
            {armed && (
              <circle cx="180" cy="196" r="46" fill="url(#js-eyeGlow)" opacity="0.6" style={{ animation: "jrsensor-glow 2s ease-in-out infinite" }} />
            )}
            <g
              onPointerDown={armSensor}
              role="button"
              aria-label={phase === "arm" ? "Tap to switch on the eye sensor" : "Eye sensor"}
              style={{
                cursor: phase === "arm" ? "pointer" : "default",
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: blink
                  ? "jrsensor-blink 0.4s ease"
                  : phase === "arm"
                    ? "jrsensor-pulse 1.4s ease-in-out infinite"
                    : "jrsensor-scan 3s ease-in-out infinite",
              }}
            >
              {/* generous invisible hit area for little fingers */}
              <circle cx="180" cy="196" r="50" fill="transparent" />
              <circle
                cx="180"
                cy="196"
                r="34"
                fill={armed ? "#0a2a22" : "#14233f"}
                stroke={armed ? ACCENT : "#41527a"}
                strokeWidth="4"
                style={{ transition: "fill 300ms ease, stroke 300ms ease" }}
              />
              <text x="180" y="198" fontSize="38" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                {blink ? "😆" : armed ? "👁️" : "💤"}
              </text>
            </g>

            {/* little feet */}
            <rect x="134" y="258" width="30" height="14" rx="7" fill="#1d2b46" stroke="#41527a" strokeWidth="2" />
            <rect x="196" y="258" width="30" height="14" rx="7" fill="#1d2b46" stroke="#41527a" strokeWidth="2" />
          </g>
        </svg>

        {/* Celebration confetti burst */}
        {won && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {["🎉", "✨", "⭐", "💡", "🎊", "✨", "⭐", "🎉", "💫", "✨"].map((c, i) => (
              <span
                key={i}
                className="absolute text-2xl"
                style={{
                  left: `${8 + i * 9}%`,
                  top: "44%",
                  animation: `jrsensor-confetti 1.1s ease-out ${i * 0.06}s forwards`,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Progress dots: one per scene ── */}
      <div className="flex items-center justify-center gap-2 text-xl" aria-hidden="true">
        {SCENES.map((s, i) => (
          <span
            key={i}
            style={{
              transform: i < good ? "scale(1.15)" : "scale(1)",
              transition: "transform 240ms cubic-bezier(.34,1.56,.64,1)",
              opacity: i === good && phase === "play" ? 1 : i < good ? 1 : 0.4,
            }}
          >
            {i < good ? "✅" : s === "night" ? "🌙" : "☀️"}
          </span>
        ))}
      </div>

      {/* ── Big action button + reset ── */}
      <div className="flex w-full items-stretch justify-center gap-3">
        {phase === "arm" ? (
          <button
            type="button"
            onPointerDown={armSensor}
            aria-label="Turn on the eye sensor"
            className="flex min-h-[72px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-extrabold transition active:scale-95"
            style={{
              touchAction: "manipulation",
              background: ACCENT,
              color: "#06120d",
              boxShadow: "0 6px 0 0 #138a5f",
            }}
          >
            <span aria-hidden="true">👁️</span>
            <span>GO</span>
          </button>
        ) : (
          <button
            type="button"
            onPointerDown={confirm}
            disabled={won}
            aria-label={isNight ? "Yes — the light is on at night" : "Yes — the light is off in the day"}
            className="flex min-h-[72px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-extrabold transition active:scale-95 disabled:opacity-60"
            style={{
              touchAction: "manipulation",
              background: won ? "rgba(52,211,153,0.25)" : ACCENT,
              color: "#06120d",
              boxShadow: won ? undefined : "0 6px 0 0 #138a5f",
            }}
          >
            <span aria-hidden="true">{won ? "🎉" : "✅"}</span>
            <span>{won ? "YAY" : "OK"}</span>
          </button>
        )}

        <button
          type="button"
          onPointerDown={reset}
          aria-label="Start over"
          className="grid min-h-[72px] w-[72px] place-items-center rounded-2xl text-3xl transition active:scale-90"
          style={{
            touchAction: "manipulation",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #27314f)",
            boxShadow: "0 6px 0 0 rgba(0,0,0,0.35)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      <style>{`
        @keyframes jrsensor-breathe {
          0%, 100% { transform: scale(1, 1); }
          50% { transform: scale(1.02, 0.985); }
        }
        @keyframes jrsensor-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes jrsensor-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        @keyframes jrsensor-scan {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes jrsensor-blink {
          0% { transform: scaleY(1); }
          45% { transform: scaleY(0.15); }
          100% { transform: scaleY(1); }
        }
        @keyframes jrsensor-glow {
          0%, 100% { opacity: 0.45; transform: scale(0.96); }
          50% { opacity: 0.85; transform: scale(1.06); }
        }
        @keyframes jrsensor-twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes jrsensor-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          60% { transform: rotate(4deg); }
          85% { transform: rotate(-2deg); }
        }
        @keyframes jrsensor-celebrate {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          30% { transform: translateY(-10px) rotate(-4deg); }
          60% { transform: translateY(0) rotate(4deg); }
        }
        @keyframes jrsensor-confetti {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(var(--dx, 0), 120px) scale(1.1) rotate(180deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jrsensor-anim, [style*="jrsensor-"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
