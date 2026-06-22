"use client";
// Make It Spin 🌀 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
// Single learning goal: a MOTOR turns electric power into spinning motion,
// and a SWITCH turns it on and off. The child snaps the motor ⚙️ into the rig
// (closing the loop: battery 🔋 → wire → switch → motor), then flips the big
// SWITCH to ON. The fan blades accelerate to a steady fast spin with little
// wind lines flying off → big party. Deterministic, always winnable, no reading.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useRef, useState } from "react";

const ACCENT = "#34d399";

/** Hub centre in the 300×200 viewBox — blades spin around this point. */
const HUB = { x: 200, y: 92 };

type Phase = "needsMotor" | "ready" | "spinning";

/** Confetti burst pieces for the win party. */
interface Spark {
  id: number;
  dx: number;
  dy: number;
  emoji: string;
  delay: number;
}
const PARTY = ["✨", "🎉", "⭐", "💫", "🌟"];

export default function MakeItSpin({ onComplete }: ActivityProps) {
  const [phase, setPhase] = useState<Phase>("needsMotor");
  const [spin, setSpin] = useState<number>(0); // accumulated rotation, degrees
  const [speed, setSpeed] = useState<number>(0); // current deg/sec, eases up
  const [snapping, setSnapping] = useState<boolean>(false);
  const [wobble, setWobble] = useState<boolean>(false);
  const [sparks, setSparks] = useState<Spark[]>([]);

  const rafRef = useRef<number | null>(null);
  const speedRef = useRef<number>(0);
  const targetRef = useRef<number>(0); // 0 when off, full when on
  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const on = phase === "spinning";

  // ── One rAF loop for the whole life of the lab: blades keep their angle,
  // speed eases toward a target so flipping ON *accelerates* smoothly. ──
  useEffect(() => {
    let last = 0;
    const TOP = 760; // deg/sec at full whirl
    const tick = (t: number): void => {
      if (last === 0) last = t;
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      // Ease current speed toward target (accelerate on, coast down off).
      const target = targetRef.current;
      const k = target > speedRef.current ? 3.0 : 2.2;
      const next = speedRef.current + (target - speedRef.current) * Math.min(k * dt, 1);
      speedRef.current = next;
      setSpeed(next);
      if (next > 0.5) setSpin((s) => (s + next * dt) % 360);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  useEffect(() => {
    targetRef.current = on ? 760 : 0;
  }, [on]);

  useEffect(
    () => () => {
      if (wobbleTimer.current !== null) clearTimeout(wobbleTimer.current);
    },
    [],
  );

  // Snap the motor into the rig → closes the loop, rig is now READY.
  const placeMotor = useCallback((): void => {
    if (phase !== "needsMotor") return;
    setSnapping(true);
    setPhase("ready");
    setTimeout(() => setSnapping(false), 460);
  }, [phase]);

  // Flip the switch. If the motor isn't in yet → friendly wobble nudge.
  const flipSwitch = useCallback((): void => {
    if (phase === "needsMotor") {
      setWobble(true);
      if (wobbleTimer.current !== null) clearTimeout(wobbleTimer.current);
      wobbleTimer.current = setTimeout(() => setWobble(false), 520);
      if (!reportedRef.current) {
        onComplete({ passed: false, detail: "Pop the motor ⚙️ in first, then flip the switch!" });
      }
      return;
    }
    if (phase === "ready") {
      setPhase("spinning");
      // Burst of confetti flying outward from the fan.
      const burst: Spark[] = Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return {
          id: i,
          dx: Math.cos(a) * (70 + (i % 3) * 22),
          dy: Math.sin(a) * (70 + (i % 3) * 22),
          emoji: PARTY[i % PARTY.length],
          delay: (i % 5) * 0.05,
        };
      });
      setSparks(burst);
      if (!reportedRef.current) {
        reportedRef.current = true;
        onComplete({ passed: true, stars: 3, detail: "The motor spins! Power → motion! 🌀" });
      }
      return;
    }
    // Already spinning → let them switch it off (just stops, stays won).
    setPhase("ready");
  }, [phase, onComplete]);

  const reset = useCallback((): void => {
    reportedRef.current = false;
    setPhase("needsMotor");
    setSnapping(false);
    setWobble(false);
    setSparks([]);
    targetRef.current = 0;
  }, []);

  const motorIn = phase !== "needsMotor";
  const fast = speed > 380;

  // Wind lines fly off only while the blades whirl.
  const wind = [
    { x: 252, y: 70 },
    { x: 256, y: 96 },
    { x: 248, y: 118 },
  ];

  return (
    <div className="flex w-full flex-col items-center gap-3" style={{ maxWidth: 430 }}>
      <style>{`
        @keyframes jrspin-bob {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes jrspin-snap {
          0% { transform: translateY(-26px) scale(0.7); opacity: 0; }
          60% { transform: translateY(4px) scale(1.12); opacity: 1; }
          80% { transform: translateY(-2px) scale(0.97); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes jrspin-wobble {
          0%,100% { transform: rotate(0deg); }
          20% { transform: rotate(-9deg); }
          50% { transform: rotate(8deg); }
          75% { transform: rotate(-5deg); }
        }
        @keyframes jrspin-pulse {
          0%,100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.7; }
        }
        @keyframes jrspin-wind {
          0% { transform: translateX(0); opacity: 0; }
          30% { opacity: 0.9; }
          100% { transform: translateX(34px); opacity: 0; }
        }
        @keyframes jrspin-fly {
          0% { transform: translate(0,0) scale(0.4); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.2); opacity: 0; }
        }
        @keyframes jrspin-star {
          0% { transform: scale(0) rotate(-30deg); }
          60% { transform: scale(1.35) rotate(8deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes jrspin-dance {
          0%,100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(-8deg); }
          75% { transform: translateY(-8px) rotate(8deg); }
        }
        @keyframes jrspin-press {
          0% { transform: scale(1); }
          40% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .jrspin-bob, .jrspin-pulse, .jrspin-wind { animation: none !important; }
        }
      `}</style>

      {/* ── Status: emoji only, no reading ── */}
      <div
        className="flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-3xl"
        role="status"
        aria-live="polite"
        aria-label={
          on
            ? "The motor is spinning! You did it!"
            : motorIn
              ? "Rig is ready — flip the switch on"
              : "Pop the motor into the rig"
        }
        style={{
          background: on ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${on ? ACCENT : "var(--color-line, #27314f)"}`,
          boxShadow: on ? `0 0 20px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true" style={on ? { animation: "jrspin-dance 0.7s ease-in-out infinite" } : undefined}>
          {on ? "🤖" : motorIn ? "🔌" : "⚙️"}
        </span>
        {on && (
          <span aria-hidden="true" className="inline-flex gap-0.5 text-2xl">
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ display: "inline-block", animation: `jrspin-star 0.5s ease-out ${0.15 + i * 0.18}s both` }}>
                ⭐
              </span>
            ))}
          </span>
        )}
      </div>

      {/* ── The rig scene ── */}
      <div className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2">
        {/* confetti party layer */}
        {sparks.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center" aria-hidden="true">
            {sparks.map((s) => (
              <span
                key={s.id}
                className="absolute text-2xl"
                style={
                  {
                    "--dx": `${s.dx}px`,
                    "--dy": `${s.dy}px`,
                    animation: `jrspin-fly 0.95s ease-out ${s.delay}s forwards`,
                  } as React.CSSProperties
                }
              >
                {s.emoji}
              </span>
            ))}
          </div>
        )}

        <svg
          viewBox="0 0 300 200"
          className="block w-full select-none"
          style={{ touchAction: "manipulation" }}
          role="img"
          aria-label="A battery joined by wires through a switch to a motor with a fan. Place the motor and flip the switch to make it spin."
        >
          <defs>
            <radialGradient id="jrspin-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="300" height="200" rx="12" fill="#0b1020" />

          {/* ── Wires: battery → switch → motor. Light up (green) when ON. ── */}
          <path
            d={`M58 150 L58 168 L150 168`}
            fill="none"
            stroke={on ? ACCENT : "#2a3450"}
            strokeWidth="5"
            strokeLinecap="round"
            style={{ transition: "stroke 250ms ease" }}
          />
          <path
            d={`M150 168 L${HUB.x} 168 L${HUB.x} 132`}
            fill="none"
            stroke={on && motorIn ? ACCENT : "#2a3450"}
            strokeWidth="5"
            strokeLinecap="round"
            style={{ transition: "stroke 250ms ease" }}
          />
          {/* travelling spark pulses along the live wire when spinning */}
          {on && (
            <circle r="4" fill="#fff6c4">
              <animateMotion dur="0.8s" repeatCount="indefinite" path={`M58 150 L58 168 L${HUB.x} 168 L${HUB.x} 132`} />
            </circle>
          )}

          {/* ── Battery 🔋 ── */}
          <g
            className="jrspin-bob"
            style={{ transformBox: "view-box", transformOrigin: "58px 130px", animation: on ? undefined : "jrspin-bob 2.6s ease-in-out infinite" }}
          >
            <rect x="36" y="120" width="44" height="32" rx="7" fill="#13351f" stroke={ACCENT} strokeWidth="2.5" />
            <text x="58" y="142" textAnchor="middle" fontSize="22" style={{ pointerEvents: "none" }}>
              🔋
            </text>
          </g>

          {/* ── Motor mount + fan (right). Empty slot until motor placed. ── */}
          {/* dashed empty slot when motor missing */}
          {!motorIn && (
            <g aria-hidden="true">
              <circle cx={HUB.x} cy={HUB.y} r="34" fill="none" stroke="#3a4566" strokeWidth="3" strokeDasharray="7 7" />
              <text x={HUB.x} y={HUB.y + 8} textAnchor="middle" fontSize="26" opacity="0.55" style={{ animation: "jrspin-pulse 1.6s ease-in-out infinite", transformBox: "fill-box", transformOrigin: "center" }}>
                ⚙️
              </text>
            </g>
          )}

          {motorIn && (
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: `${HUB.x}px ${HUB.y}px`,
                animation: snapping
                  ? "jrspin-snap 0.46s cubic-bezier(.34,1.56,.64,1)"
                  : on
                    ? undefined
                    : "jrspin-bob 2.8s ease-in-out infinite",
              }}
            >
              {/* glow halo when whirling fast */}
              {fast && <circle cx={HUB.x} cy={HUB.y} r="50" fill="url(#jrspin-glow)" />}

              {/* motor body */}
              <rect x={HUB.x - 16} y={HUB.y + 26} width="32" height="26" rx="6" fill="#1b2440" stroke={ACCENT} strokeWidth="2.5" />
              <text x={HUB.x} y={HUB.y + 45} textAnchor="middle" fontSize="16" style={{ pointerEvents: "none" }}>
                ⚙️
              </text>

              {/* spinning fan blades (3) */}
              <g transform={`rotate(${spin} ${HUB.x} ${HUB.y})`}>
                {[0, 120, 240].map((base) => (
                  <g key={base} transform={`rotate(${base} ${HUB.x} ${HUB.y})`}>
                    <path
                      d={`M${HUB.x} ${HUB.y}
                          Q${HUB.x - 16} ${HUB.y - 22} ${HUB.x - 3} ${HUB.y - 40}
                          Q${HUB.x + 14} ${HUB.y - 30} ${HUB.x} ${HUB.y} Z`}
                      fill={ACCENT}
                      opacity={on ? 0.95 : 0.7}
                      stroke="#0b1020"
                      strokeWidth="1.5"
                    />
                  </g>
                ))}
              </g>
              {/* hub cap */}
              <circle cx={HUB.x} cy={HUB.y} r="8" fill="#0b1020" stroke={ACCENT} strokeWidth="3" />
              <circle cx={HUB.x} cy={HUB.y} r="3" fill={ACCENT} />

              {/* wind lines flying off while spinning */}
              {on &&
                wind.map((w, i) => (
                  <g key={i} aria-hidden="true">
                    <path
                      className="jrspin-wind"
                      d={`M${w.x} ${w.y} q12 0 22 0`}
                      fill="none"
                      stroke={ACCENT}
                      strokeWidth="3"
                      strokeLinecap="round"
                      style={{ animation: `jrspin-wind ${fast ? 0.5 : 0.8}s linear ${i * 0.18}s infinite` }}
                    />
                  </g>
                ))}
            </g>
          )}
        </svg>
      </div>

      {/* ── Controls: snap motor in (only step 1), then the BIG switch ── */}
      {!motorIn ? (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            placeMotor();
          }}
          aria-label="Pop the motor into the rig"
          className="font-display flex w-full items-center justify-center gap-3 rounded-2xl px-6 font-extrabold"
          style={{
            minHeight: 84,
            touchAction: "manipulation",
            background: ACCENT,
            color: "#060810",
            fontSize: 26,
            boxShadow: "0 7px 0 0 #15916a",
            animation: "jrspin-press 0s",
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.animation = "jrspin-press 0.3s cubic-bezier(.34,1.56,.64,1)";
          }}
        >
          <span aria-hidden="true" className="text-4xl">
            ⚙️
          </span>
          PLACE
        </button>
      ) : (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            flipSwitch();
          }}
          aria-label={on ? "Switch is on, tap to turn off" : "Flip the switch on"}
          aria-pressed={on}
          className="font-display flex w-full items-center justify-between gap-3 rounded-2xl px-5 font-extrabold"
          style={{
            minHeight: 88,
            touchAction: "manipulation",
            background: on ? ACCENT : "rgba(11,16,32,0.7)",
            color: on ? "#060810" : "#9aa6cf",
            borderWidth: on ? 0 : 3,
            borderStyle: "solid",
            borderColor: "var(--color-line, #27314f)",
            boxShadow: on ? `0 7px 0 0 #15916a, 0 0 22px ${ACCENT}88` : "0 7px 0 0 #161d33",
            animation: wobble ? "jrspin-wobble 0.5s ease-in-out" : undefined,
          }}
        >
          <span aria-hidden="true" className="text-3xl">
            {on ? "🌀" : "🔘"}
          </span>
          {/* the physical toggle track */}
          <span
            className="relative inline-flex items-center rounded-full"
            aria-hidden="true"
            style={{
              width: 96,
              height: 48,
              background: on ? "rgba(6,8,16,0.35)" : "#0b1020",
              border: `2px solid ${on ? "#060810" : "#2a3450"}`,
            }}
          >
            <span
              className="absolute grid place-items-center rounded-full text-xl"
              style={{
                width: 40,
                height: 40,
                top: 2,
                left: on ? 50 : 2,
                background: on ? "#060810" : "#2a3450",
                color: on ? ACCENT : "#9aa6cf",
                transition: "left 240ms cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              {on ? "ON" : ""}
            </span>
          </span>
          <span style={{ fontSize: 22 }}>{on ? "ON" : "OFF"}</span>
        </button>
      )}

      {/* ── Reset ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over"
        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-line bg-panel/60 px-6 text-2xl font-bold text-ink-dim"
        style={{ minHeight: 56, touchAction: "manipulation" }}
      >
        <span aria-hidden="true">🔄</span>
      </button>
    </div>
  );
}
