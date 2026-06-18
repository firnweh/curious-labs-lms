"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Traffic Light Sequence 🚦 — a JUNIOR (Grade 1) CODING activity: SEQUENCING.
 * ORDER matters. A traffic light has three empty lamps and a road with a car
 * 🚗. Below sits a program strip of 3 slots and a tray of 3 light cards
 * (RED, GREEN, YELLOW). Tap a card → it drops into the next open slot. Tap a
 * filled slot → it clears. Press GO ▶ → the signal runs the strip top-to-
 * bottom, lighting each lamp (~0.8s) while the car reacts: STOP on red, GO on
 * green, slow on yellow. Correct order [RED, GREEN, YELLOW] → car drives off
 * happily + onComplete({passed:true,stars:3}) once. Wrong order → friendly
 * honk + shake, then rearrange. Built to read from VISUALS alone, touch-first.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#22d3ee";

type Light = "red" | "green" | "yellow";
const ORDER: readonly Light[] = ["red", "green", "yellow"];

const EMOJI: Record<Light, string> = { red: "🔴", green: "🟢", yellow: "🟡" };
const HUE: Record<Light, string> = {
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#facc15",
};
const LABEL: Record<Light, string> = { red: "red", green: "green", yellow: "yellow" };

/** Vertical position of each lamp in the housing (SVG units). */
const LAMP_Y: Record<Light, number> = { red: 52, green: 96, yellow: 140 };

type Slot = Light | null;
type Phase = "build" | "running" | "won" | "wrong";

const VW = 360;
const VH = 220;
const ROAD_Y = 188;
const CAR_START = 96;
const CAR_END = 332;
const STEP_MS = 820;

export default function TrafficLightSequence({ onComplete }: ActivityProps) {
  const [slots, setSlots] = useState<Slot[]>([null, null, null]);
  const [phase, setPhase] = useState<Phase>("build");
  const [activeStep, setActiveStep] = useState<number>(-1); // which slot is lit while running
  const [carX, setCarX] = useState<number>(CAR_START);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const running = phase === "running";
  const won = phase === "won";
  const locked = running || won;

  const filledCount = useMemo<number>(
    () => slots.filter((s) => s !== null).length,
    [slots],
  );
  const full = filledCount === 3;

  // The lamp currently lit during playback (or while showing the win).
  const litLight = useMemo<Light | null>(() => {
    if (activeStep < 0) return null;
    return slots[activeStep] ?? null;
  }, [activeStep, slots]);

  // Tap a tray card → drop into the next open slot.
  const dropCard = useCallback(
    (light: Light): void => {
      if (locked) return;
      setSlots((prev) => {
        const idx = prev.findIndex((s) => s === null);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = light;
        return next;
      });
    },
    [locked],
  );

  // Tap a filled slot → clear it.
  const clearSlot = useCallback(
    (idx: number): void => {
      if (locked) return;
      setSlots((prev) => {
        if (prev[idx] === null) return prev;
        const next = [...prev];
        next[idx] = null;
        return next;
      });
    },
    [locked],
  );

  const reset = useCallback((): void => {
    clearTimer();
    reportedRef.current = false;
    setSlots([null, null, null]);
    setPhase("build");
    setActiveStep(-1);
    setCarX(CAR_START);
  }, [clearTimer]);

  const go = useCallback((): void => {
    if (locked || !full) return;
    clearTimer();
    setCarX(CAR_START);

    const seq = slots as Light[];
    const correct = ORDER.every((c, i) => seq[i] === c);

    let i = 0;
    const tick = (): void => {
      if (i >= seq.length) {
        if (correct) {
          setActiveStep(-1);
          setPhase("won");
          setCarX(CAR_END); // car drives off happily
        } else {
          setActiveStep(-1);
          setPhase("wrong");
          onComplete({ passed: false, detail: "Wrong order — red comes first!" });
          timerRef.current = setTimeout(() => {
            setPhase("build");
            setCarX(CAR_START);
          }, 900);
        }
        return;
      }
      const light = seq[i];
      setActiveStep(i);
      // Car reacts to the lamp that just lit.
      if (light === "green") setCarX((x) => Math.min(x + 70, CAR_END - 8));
      else if (light === "yellow") setCarX((x) => Math.min(x + 22, CAR_END - 8));
      // red → stay put (stop)
      i += 1;
      timerRef.current = setTimeout(tick, STEP_MS);
    };

    setPhase("running");
    setActiveStep(-1);
    timerRef.current = setTimeout(tick, 220);
  }, [locked, full, slots, onComplete]);

  // Celebrate exactly once when won.
  useEffect(() => {
    if (won && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3 });
    }
  }, [won, onComplete]);

  const statusEmoji = won
    ? "🎉"
    : phase === "wrong"
      ? "📣"
      : running
        ? "🚦"
        : full
          ? "👉"
          : "🚗";

  const statusLabel = won
    ? "The cars are happy! You did it!"
    : phase === "wrong"
      ? "Wrong order — try red first"
      : running
        ? "The signal is running"
        : full
          ? "Press Go to run the signal"
          : "Tap the colour cards to fill the slots";

  const wrong = phase === "wrong";

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status: emoji + aria-live, no reading required ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: won ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        )}
      </div>

      {/* ── The scene: traffic light + road + car ── */}
      <div className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A traffic light with three lamps and a road with a car."
        >
          <defs>
            <radialGradient id="tl-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="55%" stopColor="#fff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* sky-ish backdrop band behind the housing */}
          {/* ── Traffic-light housing ── */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: wrong ? "tl-shake 0.5s ease-in-out" : undefined,
            }}
          >
            <rect
              x="58"
              y="22"
              width="64"
              height="148"
              rx="18"
              fill="#0b1220"
              stroke="#3a4866"
              strokeWidth="3"
            />
            {/* pole */}
            <rect x="84" y="170" width="12" height="20" rx="3" fill="#3a4866" />

            {ORDER.map((light) => {
              const on = litLight === light || (won && light === "green");
              return (
                <g key={light}>
                  {on && (
                    <circle
                      cx="90"
                      cy={LAMP_Y[light]}
                      r="28"
                      fill="url(#tl-halo)"
                      opacity="0.85"
                    />
                  )}
                  <circle
                    cx="90"
                    cy={LAMP_Y[light]}
                    r="17"
                    fill={on ? HUE[light] : "#1b2436"}
                    stroke={on ? HUE[light] : "#33405c"}
                    strokeWidth="2.5"
                    style={{
                      transition: "fill 200ms ease, stroke 200ms ease",
                      filter: on ? `drop-shadow(0 0 8px ${HUE[light]})` : undefined,
                    }}
                  >
                    {on && (
                      <animate
                        attributeName="r"
                        values="16;18;16"
                        dur="0.8s"
                        repeatCount="indefinite"
                      />
                    )}
                  </circle>
                </g>
              );
            })}
          </g>

          {/* ── Road ── */}
          <rect x="0" y={ROAD_Y - 8} width={VW} height="40" fill="#1b2436" />
          {/* lane dashes */}
          {[20, 80, 140, 200, 260, 320].map((x) => (
            <rect
              key={x}
              x={x}
              y={ROAD_Y + 9}
              width="22"
              height="4"
              rx="2"
              fill="#3a4866"
            />
          ))}

          {/* ── Car ── */}
          <g
            style={{
              transform: `translate(${carX}px, ${ROAD_Y}px)`,
              transition: won
                ? "transform 900ms ease-in"
                : `transform ${STEP_MS}ms ease-in-out`,
            }}
          >
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: wrong
                  ? "tl-shake 0.5s ease-in-out"
                  : won
                    ? "tl-pop 0.6s ease-out"
                    : undefined,
              }}
            >
              <text
                x="0"
                y="0"
                fontSize="34"
                textAnchor="middle"
                dominantBaseline="central"
                aria-label="car"
              >
                🚗
              </text>
              {wrong && (
                <text
                  x="22"
                  y="-22"
                  fontSize="18"
                  textAnchor="middle"
                  dominantBaseline="central"
                  aria-hidden="true"
                >
                  💢
                </text>
              )}
            </g>
          </g>
        </svg>
      </div>

      {/* ── Program strip: 3 slots, filled top-to-bottom order ── */}
      <div
        className="flex w-full max-w-[420px] items-center justify-center gap-2 rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
        }}
        aria-label="Program strip — the order the lights will run"
      >
        {slots.map((s, i) => {
          const isLit = running && activeStep === i;
          return (
            <button
              key={i}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                clearSlot(i);
              }}
              disabled={locked || s === null}
              aria-label={
                s
                  ? `Slot ${i + 1}: ${LABEL[s]} — tap to remove`
                  : `Slot ${i + 1}: empty`
              }
              className="grid h-16 w-16 place-items-center rounded-2xl text-3xl transition active:scale-90 disabled:active:scale-100"
              style={{
                touchAction: "none",
                background: s ? "rgba(34,211,238,0.10)" : "rgba(255,255,255,0.03)",
                border: `2px solid ${isLit ? HUE[s as Light] : s ? ACCENT : "var(--color-line, #33405c)"}`,
                boxShadow: isLit ? `0 0 14px ${HUE[s as Light]}` : undefined,
              }}
            >
              <span aria-hidden="true">
                {s ? EMOJI[s] : <span className="text-2xl opacity-40">{i + 1}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Tray of light cards ── */}
      <div className="flex w-full max-w-[420px] items-center justify-center gap-3">
        {(["red", "green", "yellow"] as const).map((light) => (
          <button
            key={light}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              dropCard(light);
            }}
            disabled={locked || full}
            aria-label={`Add ${LABEL[light]} light to the strip`}
            className="grid h-[72px] w-[72px] place-items-center rounded-2xl text-4xl transition active:scale-90 disabled:opacity-40"
            style={{
              touchAction: "none",
              background: "rgba(255,255,255,0.05)",
              border: `2px solid ${HUE[light]}`,
            }}
          >
            <span aria-hidden="true">{EMOJI[light]}</span>
          </button>
        ))}
      </div>

      {/* ── Controls: GO · Start over ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            go();
          }}
          disabled={locked || !full}
          aria-label="Go — run the signal"
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#060810",
            boxShadow: `0 6px 0 0 #0e8aa0`,
          }}
        >
          <span aria-hidden="true">{running ? "🚦" : "▶"}</span>
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
          disabled={running}
          aria-label="Start over"
          className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-2xl transition active:scale-90 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* ── Celebration ── */}
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
        @keyframes tl-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          20% { transform: translateX(-5px) rotate(-4deg); }
          50% { transform: translateX(5px) rotate(4deg); }
          80% { transform: translateX(-3px) rotate(-2deg); }
        }
        @keyframes tl-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
