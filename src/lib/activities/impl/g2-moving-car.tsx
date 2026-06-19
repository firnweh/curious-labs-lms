"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Moving Car 🚗 ────────────────────────────────────────────────────────────
   JUNIORS (Grade 2, age ~7). Subject: ROBOTICS. Single learning goal: a car
   needs WHEELS + AXLES and a MOTOR (powered by a battery) to turn stored energy
   into motion. BUILD then DRIVE: the child taps to add FOUR wheels to the empty
   chassis and snaps in a MOTOR + BATTERY, then presses GO. With every part in
   place the car rolls left → right along the road to the finish flag 🏁 (a CSS
   transform) → big celebration + onComplete({passed:true, stars:3}) once. Press
   GO with parts still missing and the car only WOBBLES in place — a friendly
   nudge, never a scold, always recoverable. Understood from visuals alone, no
   reading required. Touch-first, big targets, deterministic, always winnable. */

const ACCENT = "#34d399";
const TOTAL_WHEELS = 4;

type Phase = "build" | "wobble" | "driving" | "won";

/** A wheel slot on the chassis — front/back, left side (visual only). */
interface WheelSlot {
  id: number;
  /** x position along the chassis in virtual SVG units. */
  x: number;
}

// ── Layout maths (virtual SVG units; CSS scales it responsively) ─────────────
const VW = 360;
const VH = 150;
const ROAD_Y = 116; // top of the road strip
const CAR_W = 96;
const START_X = 14; // car's resting left edge
const FINISH_X = VW - 40; // x of the finish flag
const DRIVE_X = FINISH_X - CAR_W - 6; // how far the car body travels

// The four wheel anchor points under the chassis body (local car coords).
const WHEEL_SLOTS: readonly WheelSlot[] = [
  { id: 0, x: 24 },
  { id: 1, x: 72 },
];

export default function MovingCar({ onComplete }: ActivityProps) {
  const [wheels, setWheels] = useState<number>(0);
  const [hasMotor, setHasMotor] = useState<boolean>(false);
  const [phase, setPhase] = useState<Phase>("build");

  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (wobbleTimer.current !== null) {
      clearTimeout(wobbleTimer.current);
      wobbleTimer.current = null;
    }
    if (driveTimer.current !== null) {
      clearTimeout(driveTimer.current);
      driveTimer.current = null;
    }
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const won = phase === "won";
  const driving = phase === "driving";
  const wobbling = phase === "wobble";
  const ready = wheels >= TOTAL_WHEELS && hasMotor;

  const addWheel = useCallback(() => {
    if (driving || won) return;
    setPhase("build");
    setWheels((w) => (w >= TOTAL_WHEELS ? w : w + 1));
  }, [driving, won]);

  const addMotor = useCallback(() => {
    if (driving || won) return;
    setPhase("build");
    setHasMotor(true);
  }, [driving, won]);

  const reset = useCallback(() => {
    clearTimers();
    reportedRef.current = false;
    setWheels(0);
    setHasMotor(false);
    setPhase("build");
  }, [clearTimers]);

  const go = useCallback(() => {
    if (driving || won) return;
    clearTimers();

    if (!ready) {
      // Missing parts → a gentle wobble in place, no scolding, fully recoverable.
      setPhase("wobble");
      onComplete({
        passed: false,
        detail:
          wheels < TOTAL_WHEELS
            ? "Add all 4 wheels so the car can roll!"
            : "Pop in the motor and battery to give it power!",
      });
      wobbleTimer.current = setTimeout(() => setPhase("build"), 620);
      return;
    }

    // Fully built → drive across to the finish flag, then celebrate once.
    setPhase("driving");
    driveTimer.current = setTimeout(() => {
      setPhase("won");
      if (!reportedRef.current) {
        reportedRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail: "Wheels, axle and motor — your car reached the finish! 🏁",
        });
      }
    }, 1700);
  }, [driving, won, ready, wheels, clearTimers, onComplete]);

  const statusEmoji = useMemo<string>(() => {
    if (won) return "🎉";
    if (driving) return "💨";
    if (wobbling) return "😅";
    if (ready) return "🚗";
    return "🛠️";
  }, [won, driving, wobbling, ready]);

  // The car body's horizontal travel (CSS transform).
  const carShift = won || driving ? DRIVE_X : 0;

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      {/* ── Tiny visual status (emoji, not paragraphs) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "The car reached the finish flag!"
            : driving
              ? "The car is driving"
              : wobbling
                ? "The car wobbled — add the missing part"
                : ready
                  ? "The car is built — press Go to drive"
                  : "Build the car: add wheels and a motor"
        }
        style={{
          background: won ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.04)",
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
          <span aria-hidden="true" className="text-xl">
            🚗→🏁
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The road + car scene ── */}
      <div className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A car on a road driving towards a finish flag"
        >
          <defs>
            <radialGradient id="g2mc-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* sky / scene backdrop */}
          <rect x={0} y={0} width={VW} height={ROAD_Y} fill="rgba(255,255,255,0.03)" />

          {/* road strip */}
          <rect x={0} y={ROAD_Y} width={VW} height={VH - ROAD_Y} fill="#1b2436" />
          {/* dashed centre line */}
          {Array.from({ length: 9 }).map((_, i) => (
            <rect
              key={`dash-${i}`}
              x={8 + i * 40}
              y={ROAD_Y + (VH - ROAD_Y) / 2 - 2}
              width={20}
              height={4}
              rx={2}
              fill="rgba(120,140,170,0.5)"
            />
          ))}

          {/* finish flag + glow when won */}
          <circle
            cx={FINISH_X + 6}
            cy={ROAD_Y - 18}
            r={26}
            fill="url(#g2mc-glow)"
            opacity={won ? 1 : 0.5}
          />
          <g
            style={{
              transformOrigin: `${FINISH_X + 6}px ${ROAD_Y - 18}px`,
              transformBox: "fill-box",
              animation: won ? "g2movingcar-pop 0.7s ease-out" : undefined,
            }}
          >
            <text
              x={FINISH_X + 6}
              y={ROAD_Y - 16}
              fontSize={30}
              textAnchor="middle"
              dominantBaseline="central"
              aria-label="finish flag"
            >
              🏁
            </text>
          </g>

          {/* ── The car (chassis + parts), translated as it drives ── */}
          <g
            style={{
              transform: `translateX(${carShift}px)`,
              transition: driving
                ? "transform 1.6s cubic-bezier(0.4, 0, 0.2, 1)"
                : "transform 200ms ease-out",
            }}
          >
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: wobbling
                  ? "g2movingcar-wobble 0.6s ease-in-out"
                  : won
                    ? "g2movingcar-pop 0.6s ease-out"
                    : undefined,
              }}
            >
              {/* chassis body */}
              <rect
                x={START_X}
                y={ROAD_Y - 34}
                width={CAR_W}
                height={26}
                rx={9}
                fill="#0b1220"
                stroke={ready ? ACCENT : "rgba(120,140,170,0.45)"}
                strokeWidth={ready ? 2.5 : 1.5}
                style={ready ? { filter: `drop-shadow(0 0 5px ${ACCENT})` } : undefined}
              />
              {/* cabin */}
              <rect
                x={START_X + 22}
                y={ROAD_Y - 50}
                width={42}
                height={20}
                rx={7}
                fill="#101a2c"
                stroke={ready ? ACCENT : "rgba(120,140,170,0.4)"}
                strokeWidth={1.5}
              />

              {/* motor + battery slot (centre of chassis) */}
              <g transform={`translate(${START_X + 48}, ${ROAD_Y - 21})`}>
                {hasMotor ? (
                  <text
                    x={0}
                    y={1}
                    fontSize={18}
                    textAnchor="middle"
                    dominantBaseline="central"
                    aria-label="motor and battery installed"
                    style={{ animation: "g2movingcar-pop 0.4s ease-out" }}
                  >
                    🔋
                  </text>
                ) : (
                  <>
                    <circle
                      r={11}
                      fill="rgba(255,255,255,0.03)"
                      stroke="rgba(120,140,170,0.55)"
                      strokeWidth={1.4}
                      strokeDasharray="4 3"
                      aria-label="empty motor slot"
                    />
                    <text
                      x={0}
                      y={1}
                      fontSize={12}
                      textAnchor="middle"
                      dominantBaseline="central"
                      aria-hidden="true"
                      opacity={0.6}
                    >
                      ➕
                    </text>
                  </>
                )}
              </g>

              {/* the four wheel slots (two visible anchors, doubled for axle look) */}
              {WHEEL_SLOTS.map((slot) => {
                // Each slot shows a wheel once that pair's first wheel is added,
                // so 4 taps fill the two visible axle anchors front-to-back.
                const half = wheels >= slot.id * 2 + 1;
                const cxPos = START_X + slot.x;
                const cyPos = ROAD_Y - 6;
                return (
                  <g key={`wheel-${slot.id}`}>
                    {/* axle line */}
                    <rect
                      x={cxPos - 1.5}
                      y={cyPos - 3}
                      width={3}
                      height={6}
                      rx={1}
                      fill={half ? "rgba(120,140,170,0.7)" : "rgba(120,140,170,0.3)"}
                    />
                    <g transform={`translate(${cxPos}, ${cyPos})`}>
                      {half ? (
                        <g
                          style={{
                            transformBox: "fill-box",
                            transformOrigin: "center",
                            animation: driving
                              ? "g2movingcar-spin 0.5s linear infinite"
                              : undefined,
                          }}
                        >
                          <text
                            x={0}
                            y={1}
                            fontSize={20}
                            textAnchor="middle"
                            dominantBaseline="central"
                            aria-label="wheel"
                            style={{ animation: "g2movingcar-pop 0.35s ease-out" }}
                          >
                            ⚫
                          </text>
                        </g>
                      ) : (
                        <circle
                          r={9}
                          fill="rgba(255,255,255,0.02)"
                          stroke="rgba(120,140,170,0.45)"
                          strokeWidth={1.3}
                          strokeDasharray="3 3"
                          aria-label="empty wheel slot"
                        />
                      )}
                    </g>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>

      {/* ── Build tray: progress for wheels + motor ── */}
      <div
        className="flex w-full max-w-[420px] items-center justify-center gap-3 rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
        }}
        aria-label={`Parts added: ${wheels} of 4 wheels, motor ${hasMotor ? "in" : "missing"}`}
      >
        {/* wheel dots */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: TOTAL_WHEELS }).map((_, i) => (
            <span
              key={`wd-${i}`}
              className="grid h-7 w-7 place-items-center rounded-full text-base transition-all"
              style={{
                background: i < wheels ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.03)",
                border: `2px solid ${i < wheels ? ACCENT : "var(--color-line, #33405c)"}`,
                boxShadow: i < wheels ? `0 0 8px ${ACCENT}66` : undefined,
              }}
            >
              {i < wheels ? "⚫" : "○"}
            </span>
          ))}
        </div>
        <span aria-hidden="true" className="text-lg opacity-50">
          +
        </span>
        {/* motor chip */}
        <span
          aria-hidden="true"
          className="grid h-7 w-7 place-items-center rounded-full text-base transition-all"
          style={{
            background: hasMotor ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.03)",
            border: `2px solid ${hasMotor ? ACCENT : "var(--color-line, #33405c)"}`,
            boxShadow: hasMotor ? `0 0 8px ${ACCENT}66` : undefined,
          }}
        >
          {hasMotor ? "🔋" : "○"}
        </span>
      </div>

      {/* ── Part buttons: ADD WHEEL · ADD MOTOR ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            addWheel();
          }}
          disabled={driving || won || wheels >= TOTAL_WHEELS}
          aria-label="Add a wheel to the car"
          className="flex h-[62px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl transition active:scale-95 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(52,211,153,0.10)",
            border: `2px solid ${ACCENT}`,
            color: ACCENT,
          }}
        >
          <span aria-hidden="true">⚫</span>
          <span aria-hidden="true" className="text-base font-extrabold">
            WHEEL
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            addMotor();
          }}
          disabled={driving || won || hasMotor}
          aria-label="Add the motor and battery"
          className="flex h-[62px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl transition active:scale-95 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(52,211,153,0.10)",
            border: `2px solid ${ACCENT}`,
            color: ACCENT,
          }}
        >
          <span aria-hidden="true">🔋</span>
          <span aria-hidden="true" className="text-base font-extrabold">
            MOTOR
          </span>
        </button>
      </div>

      {/* ── GO + Reset ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            go();
          }}
          disabled={driving || won}
          aria-label="Go — drive the car to the finish flag"
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#06140d",
            boxShadow: "0 6px 0 0 #1d9b6e",
          }}
        >
          <span aria-hidden="true">{driving ? "💨" : "▶"}</span>
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
          disabled={driving}
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
        @keyframes g2movingcar-wobble {
          0%, 100% { transform: rotate(0deg) translateX(0); }
          15% { transform: rotate(-3deg) translateX(-3px); }
          35% { transform: rotate(3deg) translateX(3px); }
          55% { transform: rotate(-2deg) translateX(-2px); }
          75% { transform: rotate(2deg) translateX(2px); }
        }
        @keyframes g2movingcar-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes g2movingcar-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.28); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
