"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Press to Go 🔘 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 * ONE learning goal: pressing a button (an INPUT) makes the robot DO something
 * (an OUTPUT) — cause and effect.
 *
 * A friendly robot has an empty slot in its chest. The child first TAPS to
 * snap the big glowing button into the circuit, then PRESSES it — the robot
 * springs to life: eyes light up, the fan on its head spins, and it bounces
 * and dances with a confetti party. Win when the robot is activated.
 * Round 1 = snap + press to turn ON. Round 2 = press AGAIN to make it dance.
 *
 * Understood from VISUALS alone — emoji, colour, big shapes; near-zero reading.
 * Touch-first, huge tap targets, deterministic, always winnable, no scolding.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";

type Phase = "needsButton" | "ready" | "on" | "won";

interface Spark {
  id: number;
  angle: number;
  dist: number;
  emoji: string;
}

const CONFETTI = ["⭐", "✨", "🎉", "💚", "🌟", "🎊"] as const;

let SPARK_UID = 1;

export default function PresstoGo({ onComplete }: ActivityProps) {
  const [phase, setPhase] = useState<Phase>("needsButton");
  // How many times the live button has been pressed (drives the 2 rounds).
  const [presses, setPresses] = useState<number>(0);
  // Brief springy "depress" pulse on the live button.
  const [poke, setPoke] = useState<number>(0);
  // Gentle friendly wobble when the child taps the empty button (pre-snap).
  const [nudge, setNudge] = useState<number>(0);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [stars, setStars] = useState<number>(0);

  const reportedRef = useRef<boolean>(false);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const addTimer = useCallback((fn: () => void, ms: number): void => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  }, []);

  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const buttonPlaced = phase !== "needsButton";
  const robotOn = phase === "on" || phase === "won";
  const won = phase === "won";

  // ── Snap the button into the chest slot ──
  const snapButton = useCallback((): void => {
    if (phase !== "needsButton") return;
    setPhase("ready");
  }, [phase]);

  // ── Throw a burst of confetti outward from the robot ──
  const burst = useCallback((count: number): void => {
    const next: Spark[] = Array.from({ length: count }).map((_, i) => ({
      id: SPARK_UID++,
      angle: (360 / count) * i + Math.random() * 18,
      dist: 80 + Math.random() * 56,
      emoji: CONFETTI[i % CONFETTI.length],
    }));
    setSparks(next);
    addTimer(() => setSparks([]), 1100);
  }, [addTimer]);

  // ── Press the LIVE button: the cause → effect moment ──
  const pressButton = useCallback((): void => {
    if (phase === "needsButton" || phase === "won") return;
    setPoke((p) => p + 1);
    const n = presses + 1;
    setPresses(n);

    if (phase === "ready") {
      // Round 1: robot wakes up.
      setPhase("on");
      burst(8);
    } else if (phase === "on") {
      // Round 2: robot does a happy dance → WIN.
      setPhase("won");
      burst(14);
      // Pop the three stars in one at a time.
      setStars(0);
      addTimer(() => setStars(1), 180);
      addTimer(() => setStars(2), 460);
      addTimer(() => setStars(3), 740);
      if (!reportedRef.current) {
        reportedRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail: "Press → Go! The button switched the robot on. 🔘🤖",
        });
      }
    }
  }, [phase, presses, burst, addTimer, onComplete]);

  // ── Tapping the EMPTY button: gentle nudge, no scolding ──
  const wiggleHint = useCallback((): void => {
    if (phase !== "needsButton") return;
    setNudge((n) => n + 1);
  }, [phase]);

  const reset = useCallback((): void => {
    clearTimers();
    reportedRef.current = false;
    setPhase("needsButton");
    setPresses(0);
    setPoke(0);
    setNudge(0);
    setSparks([]);
    setStars(0);
  }, [clearTimers]);

  // Big visual hint emoji for the floating coach bubble.
  const coach = useMemo<string>(() => {
    if (phase === "needsButton") return "👇🔘";
    if (phase === "ready") return "👆";
    if (phase === "on") return "👆";
    return "🎉";
  }, [phase]);

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{`
        @keyframes jrbutton-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-5px) scale(1.015); }
        }
        @keyframes jrbutton-dance {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-10px) rotate(-6deg); }
          50% { transform: translateY(0) rotate(0deg); }
          75% { transform: translateY(-10px) rotate(6deg); }
        }
        @keyframes jrbutton-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes jrbutton-pulse {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 3px ${ACCENT}); }
          50% { opacity: 0.55; filter: drop-shadow(0 0 10px ${ACCENT}); }
        }
        @keyframes jrbutton-snap {
          0% { transform: translateY(-26px) scale(0.4); opacity: 0; }
          60% { transform: translateY(4px) scale(1.18); opacity: 1; }
          80% { transform: translateY(-2px) scale(0.94); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes jrbutton-poke {
          0% { transform: scale(1); }
          35% { transform: scale(0.8) translateY(6px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes jrbutton-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-7deg); }
          60% { transform: rotate(5deg); }
          85% { transform: rotate(-3deg); }
        }
        @keyframes jrbutton-starpop {
          0% { transform: scale(0) rotate(-40deg); opacity: 0; }
          60% { transform: scale(1.4) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes jrbutton-fly {
          0% { transform: translate(0,0) scale(0.4); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.2); opacity: 0; }
        }
        @keyframes jrbutton-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .jrbutton-anim { animation: none !important; }
        }
      `}</style>

      {/* ── Coach bubble (emoji only) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-5 py-1.5 text-3xl"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "The robot is dancing! You did it!"
            : phase === "needsButton"
              ? "Tap to snap the button in"
              : "Press the button to start the robot"
        }
        style={{
          background: robotOn ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${robotOn ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 20px ${ACCENT}66` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          className="jrbutton-anim"
          style={{ animation: won ? undefined : "jrbutton-bob 1.6s ease-in-out infinite" }}
        >
          {coach}
        </span>
        {won && (
          <span aria-hidden="true" className="text-2xl">
            {stars >= 1 && (
              <span className="jrbutton-anim" style={{ display: "inline-block", animation: "jrbutton-starpop 0.5s ease-out" }}>⭐</span>
            )}
            {stars >= 2 && (
              <span className="jrbutton-anim" style={{ display: "inline-block", animation: "jrbutton-starpop 0.5s ease-out" }}>⭐</span>
            )}
            {stars >= 3 && (
              <span className="jrbutton-anim" style={{ display: "inline-block", animation: "jrbutton-starpop 0.5s ease-out" }}>⭐</span>
            )}
          </span>
        )}
      </div>

      {/* ── The robot stage ── */}
      <div
        className="panel relative w-full overflow-hidden rounded-3xl border border-line p-3"
        style={{ maxWidth: 430 }}
      >
        {/* confetti layer (centred on the robot) */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          {sparks.map((s) => {
            const rad = (s.angle * Math.PI) / 180;
            const dx = Math.cos(rad) * s.dist;
            const dy = Math.sin(rad) * s.dist;
            return (
              <span
                key={s.id}
                aria-hidden="true"
                className="jrbutton-anim absolute text-2xl"
                style={
                  {
                    "--dx": `${dx}px`,
                    "--dy": `${dy}px`,
                    animation: "jrbutton-fly 1s ease-out forwards",
                  } as React.CSSProperties
                }
              >
                {s.emoji}
              </span>
            );
          })}
        </div>

        <svg
          viewBox="0 0 300 320"
          className="block w-full select-none"
          style={{ touchAction: "manipulation" }}
          role="img"
          aria-label="A friendly robot with a fan on its head and a button slot in its chest"
        >
          <defs>
            <filter id="jrb-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* whole robot: idle breathing while waiting, happy dance on win */}
          <g
            className="jrbutton-anim"
            style={{
              transformOrigin: "150px 200px",
              transformBox: "view-box",
              animation: won
                ? "jrbutton-dance 0.7s ease-in-out infinite"
                : "jrbutton-breathe 2.6s ease-in-out infinite",
            }}
          >
            {/* head fan ── spins only when the robot is ON */}
            <g
              className="jrbutton-anim"
              style={{
                transformOrigin: "150px 54px",
                transformBox: "view-box",
                animation: robotOn ? "jrbutton-spin 0.5s linear infinite" : "none",
              }}
            >
              <text
                x="150"
                y="66"
                textAnchor="middle"
                fontSize="40"
                aria-hidden="true"
                opacity={robotOn ? 1 : 0.45}
              >
                {robotOn ? "🌀" : "✜"}
              </text>
            </g>
            {/* fan post */}
            <rect x="146" y="70" width="8" height="20" rx="4" fill="#3a4866" />

            {/* head */}
            <rect
              x="92"
              y="88"
              width="116"
              height="92"
              rx="24"
              fill="#0b1220"
              stroke={robotOn ? ACCENT : "#3a4866"}
              strokeWidth="4"
              style={{ transition: "stroke 240ms ease" }}
            />

            {/* eyes ── light up when ON */}
            {[120, 180].map((ex) => (
              <g key={ex}>
                <circle
                  cx={ex}
                  cy="126"
                  r="15"
                  fill={robotOn ? ACCENT : "#1b2436"}
                  stroke={robotOn ? ACCENT : "#3a4866"}
                  strokeWidth="3"
                  filter={robotOn ? "url(#jrb-glow)" : undefined}
                  style={{ transition: "fill 240ms ease, stroke 240ms ease" }}
                />
                <circle cx={ex} cy="126" r="6" fill={robotOn ? "#05140d" : "#2a3550"} />
              </g>
            ))}

            {/* mouth: flat when off, big smile when on */}
            <path
              d={robotOn ? "M120 158 Q150 178 180 158" : "M122 160 H178"}
              fill="none"
              stroke={robotOn ? ACCENT : "#3a4866"}
              strokeWidth="4"
              strokeLinecap="round"
              style={{ transition: "stroke 240ms ease" }}
            />

            {/* body */}
            <rect
              x="80"
              y="186"
              width="140"
              height="104"
              rx="22"
              fill="#0b1220"
              stroke={robotOn ? ACCENT : "#3a4866"}
              strokeWidth="4"
              style={{ transition: "stroke 240ms ease" }}
            />

            {/* arms ── raised & cheering on win */}
            <g style={{ transition: "transform 240ms ease" }}>
              <rect
                x="56"
                y={won ? 176 : 200}
                width="22"
                height="60"
                rx="11"
                fill="#0b1220"
                stroke={robotOn ? ACCENT : "#3a4866"}
                strokeWidth="4"
                style={{ transition: "y 240ms ease, stroke 240ms ease" }}
              />
              <rect
                x="222"
                y={won ? 176 : 200}
                width="22"
                height="60"
                rx="11"
                fill="#0b1220"
                stroke={robotOn ? ACCENT : "#3a4866"}
                strokeWidth="4"
                style={{ transition: "y 240ms ease, stroke 240ms ease" }}
              />
            </g>

            {/* CHEST SLOT — empty dashed circle, or the snapped-in button */}
            {!buttonPlaced ? (
              <circle
                cx="150"
                cy="238"
                r="30"
                fill="#05080f"
                stroke="#4a567e"
                strokeWidth="3"
                strokeDasharray="7 6"
              >
                <animate
                  attributeName="opacity"
                  values="0.55;1;0.55"
                  dur="1.4s"
                  repeatCount="indefinite"
                />
              </circle>
            ) : (
              <g
                key={`slot-${presses}`}
                className="jrbutton-anim"
                style={{
                  transformOrigin: "150px 238px",
                  transformBox: "view-box",
                  animation:
                    presses === 0
                      ? "jrbutton-snap 0.5s cubic-bezier(.34,1.56,.64,1)"
                      : undefined,
                }}
              >
                <circle cx="150" cy="238" r="32" fill="#05140d" stroke={ACCENT} strokeWidth="3" />
                <circle
                  cx="150"
                  cy="238"
                  r="22"
                  fill={robotOn ? ACCENT : "#0e3b29"}
                  className={robotOn ? "jrbutton-anim" : undefined}
                  style={{
                    transition: "fill 200ms ease",
                    transformBox: "view-box",
                    transformOrigin: "150px 238px",
                    animation: robotOn ? "jrbutton-pulse 1s ease-in-out infinite" : undefined,
                  }}
                />
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* ── THE BIG BUTTON ──
          Before snap: tap to snap it in (gentle wiggle if pressed prematurely
          handled elsewhere). After snap: the live cause→effect button. */}
      {!buttonPlaced ? (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            snapButton();
          }}
          aria-label="Snap the button into the robot"
          className="jrbutton-anim grid place-items-center rounded-full"
          style={{
            width: 132,
            height: 132,
            touchAction: "manipulation",
            background: "radial-gradient(circle at 50% 38%, #10b981, #065f46)",
            border: `4px solid ${ACCENT}`,
            color: "#05140d",
            fontSize: 56,
            boxShadow: `0 9px 0 0 #043d2c`,
            animation: "jrbutton-bob 2.2s ease-in-out infinite",
          }}
        >
          <span aria-hidden="true">🔘</span>
        </button>
      ) : (
        <button
          type="button"
          key={`live-${poke}`}
          onPointerDown={(e) => {
            e.preventDefault();
            pressButton();
          }}
          disabled={won}
          aria-label={won ? "The robot is dancing" : "Press the button to start the robot"}
          className="jrbutton-anim grid place-items-center rounded-full disabled:opacity-95"
          style={{
            width: 132,
            height: 132,
            touchAction: "manipulation",
            background: "radial-gradient(circle at 50% 38%, #34d399, #047857)",
            border: `5px solid ${ACCENT}`,
            color: "#05140d",
            fontSize: 40,
            fontWeight: 800,
            boxShadow: `0 10px 0 0 #045c41, 0 0 22px ${ACCENT}88`,
            animation:
              poke > 0
                ? "jrbutton-poke 0.32s cubic-bezier(.34,1.56,.64,1)"
                : won
                  ? undefined
                  : "jrbutton-bob 1.5s ease-in-out infinite",
          }}
        >
          <span aria-hidden="true">{won ? "🎉" : "GO"}</span>
        </button>
      )}

      {/* gentle wobble target: tapping anywhere on the empty slot hint
          (handled by the snap button above); the empty-button wiggle is a
          friendly nudge if needed. Invisible helper keeps lints happy. */}
      <span
        aria-hidden="true"
        className="jrbutton-anim"
        style={{
          height: 0,
          animation: nudge > 0 ? "jrbutton-wobble 0.5s ease-in-out" : undefined,
        }}
        onPointerDown={wiggleHint}
      />

      {/* ── Reset ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over"
        className="grid h-[64px] w-[64px] place-items-center rounded-2xl text-3xl transition active:scale-90"
        style={{
          touchAction: "manipulation",
          background: "rgba(255,255,255,0.05)",
          border: "2px solid var(--color-line, #33405c)",
          boxShadow: "0 5px 0 0 rgba(0,0,0,0.35)",
        }}
      >
        <span aria-hidden="true">🔄</span>
      </button>
    </div>
  );
}
