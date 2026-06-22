"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Drive It! 🚗 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 * ONE learning goal: BUILD a robot car (snap on 4 wheels + a motor), then
 * CONTROL it — drive forward ⬆️ and turn ↪️ — to roll along a winding road to
 * the 🏁 flag. Reach the flag → big party. Deterministic + always winnable.
 * Near-zero reading; emoji + big chunky buttons; touch-first; very forgiving.
 *
 * The car follows a FIXED set of road stops. Each ⬆️ rolls to the NEXT stop on
 * the road; ↪️ just spins the car to aim at the next stop (delight, not a
 * puzzle). So tapping ⬆️ enough times always reaches the flag — never lost.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";

/** The two parts the child snaps on to finish the car. */
type PartId = "wheels" | "motor";

/** A stop along the winding road, in SVG units. heading = car nose angle. */
interface Stop {
  x: number;
  y: number;
  heading: number;
}

// A gentle S-shaped road. Car starts at stop 0, flag sits at the last stop.
const ROAD: readonly Stop[] = [
  { x: 60, y: 250, heading: 0 },
  { x: 130, y: 245, heading: -12 },
  { x: 190, y: 200, heading: -48 },
  { x: 205, y: 140, heading: -78 },
  { x: 250, y: 100, heading: -30 },
  { x: 320, y: 95, heading: 0 },
];
const LAST = ROAD.length - 1;

export default function DriveIt({ onComplete }: ActivityProps) {
  // ── Build phase ──
  const [wheels, setWheels] = useState<boolean>(false);
  const [motor, setMotor] = useState<boolean>(false);
  const [snap, setSnap] = useState<PartId | null>(null);
  const built = wheels && motor;

  // ── Drive phase ──
  const [stop, setStop] = useState<number>(0);
  const [aimed, setAimed] = useState<boolean>(false); // turned to face next?
  const [rolling, setRolling] = useState<boolean>(false);
  const [wobble, setWobble] = useState<boolean>(false);
  const won = stop >= LAST;

  const reportedRef = useRef<boolean>(false);
  const snapTimer = useRef<number | null>(null);
  const rollTimer = useRef<number | null>(null);
  const wobbleTimer = useRef<number | null>(null);

  const clearTimers = useCallback((): void => {
    [snapTimer, rollTimer, wobbleTimer].forEach((t) => {
      if (t.current !== null) window.clearTimeout(t.current);
      t.current = null;
    });
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  // Place a part — it springs into its slot with a happy pop.
  const place = useCallback((id: PartId): void => {
    if (id === "wheels") setWheels(true);
    else setMotor(true);
    setSnap(id);
    if (snapTimer.current !== null) window.clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => setSnap(null), 460);
  }, []);

  // Turn: aim the car at the next road stop (pure delight, always OK).
  const turn = useCallback((): void => {
    if (!built || won || rolling) return;
    setAimed(true);
    setWobble(true);
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    wobbleTimer.current = window.setTimeout(() => setWobble(false), 420);
  }, [built, won, rolling]);

  // Forward: roll to the next stop. Gentle nudge if not aimed yet.
  const forward = useCallback((): void => {
    if (!built || won || rolling) return;
    if (!aimed) {
      // Not pointed at the road yet — friendly wobble, no scolding.
      setWobble(true);
      if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
      wobbleTimer.current = window.setTimeout(() => setWobble(false), 420);
      onComplete({ passed: false, detail: "Turn the wheel first, then go! ↪️" });
      return;
    }
    setRolling(true);
    setAimed(false);
    if (rollTimer.current !== null) window.clearTimeout(rollTimer.current);
    rollTimer.current = window.setTimeout(() => {
      setRolling(false);
      setStop((s) => Math.min(s + 1, LAST));
    }, 720);
  }, [built, won, rolling, aimed, onComplete]);

  const reset = useCallback((): void => {
    clearTimers();
    reportedRef.current = false;
    setWheels(false);
    setMotor(false);
    setSnap(null);
    setStop(0);
    setAimed(false);
    setRolling(false);
    setWobble(false);
  }, [clearTimers]);

  // Win exactly once when the car reaches the flag.
  useEffect(() => {
    if (won && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3, detail: "You drove to the flag! 🏁" });
    }
  }, [won, onComplete]);

  const here = ROAD[stop];
  // The car heading: when aimed, point at the next stop; else rest heading.
  const heading = useMemo<number>(() => {
    if (won) return 0;
    if (aimed && stop < LAST) return ROAD[stop + 1].heading;
    return here.heading;
  }, [won, aimed, stop, here.heading]);

  const statusEmoji = won
    ? "🎉"
    : !built
      ? "🔧"
      : rolling
        ? "💨"
        : aimed
          ? "👉"
          : "🚗";

  return (
    <div className="flex w-full flex-col items-center gap-3" style={{ maxWidth: 430 }}>
      {/* ── Tiny emoji status (no paragraphs to read) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "You reached the flag!"
            : !built
              ? "Build the car"
              : "Drive to the flag"
        }
        style={{
          background: won ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #27314f)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {won ? (
          <span aria-hidden="true">⭐⭐⭐</span>
        ) : (
          <span aria-hidden="true" className="text-xl">🚗→🏁</span>
        )}
      </div>

      {/* ── Stage: the road + car ── */}
      <div className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox="0 0 380 300"
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A winding road from the car to a flag"
        >
          <defs>
            <radialGradient id="jrdrive-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* grass-ish backdrop */}
          <rect x="0" y="0" width="380" height="300" fill="#0c1322" />

          {/* ── the winding ROAD (thick rounded path through every stop) ── */}
          <polyline
            points={ROAD.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#26304a"
            strokeWidth="34"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* dashed centre line */}
          <polyline
            points={ROAD.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#3f4d70"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="9 10"
          />

          {/* glow under the flag when won */}
          {won && <circle cx={ROAD[LAST].x} cy={ROAD[LAST].y} r="44" fill="url(#jrdrive-halo)" />}

          {/* ── FLAG goal ── */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: won ? "jrdrive-pop 0.7s ease-out" : "jrdrive-flag 2.4s ease-in-out infinite",
            }}
          >
            <text
              x={ROAD[LAST].x}
              y={ROAD[LAST].y + 2}
              fontSize="34"
              textAnchor="middle"
              dominantBaseline="central"
              aria-hidden="true"
            >
              🏁
            </text>
          </g>

          {/* ── the CAR ── */}
          <g
            style={{
              transform: `translate(${here.x}px, ${here.y}px)`,
              transition: rolling
                ? "transform 0.72s cubic-bezier(.45,.05,.55,.95)"
                : "transform 0.2s ease-out",
            }}
          >
            {/* exhaust puffs while rolling */}
            {rolling && (
              <g aria-hidden="true">
                <text x="-26" y="6" fontSize="16" style={{ animation: "jrdrive-puff 0.7s ease-out infinite" }}>💨</text>
                <text x="-34" y="-4" fontSize="13" style={{ animation: "jrdrive-puff 0.7s ease-out 0.2s infinite" }}>💨</text>
              </g>
            )}

            {/* heading turn + idle bob + wrong-wobble all on this group */}
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                transition: "transform 0.32s cubic-bezier(.34,1.56,.64,1)",
                transform: `rotate(${heading}deg)`,
              }}
            >
              <g
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: won
                    ? "jrdrive-cheer 0.6s ease-out 2"
                    : wobble
                      ? "jrdrive-wobble 0.42s ease-in-out"
                      : built && !rolling
                        ? "jrdrive-bob 2.6s ease-in-out infinite"
                        : undefined,
                }}
              >
                {/* car body */}
                <rect x="-26" y="-14" width="52" height="22" rx="9" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" />
                <rect x="-12" y="-22" width="26" height="14" rx="6" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" />
                {/* headlight */}
                <circle cx="22" cy="-3" r="3.5" fill="#fde68a" />
                {/* the MOTOR (only after it's snapped on) */}
                {motor && (
                  <text x="0" y="-12" fontSize="13" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                    ⚙️
                  </text>
                )}
                {/* the WHEELS (only after snapped on) — spin while rolling */}
                {wheels && (
                  <g aria-hidden="true">
                    <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: rolling ? "jrdrive-spin 0.5s linear infinite" : undefined }}>
                      <text x="-16" y="12" fontSize="16" textAnchor="middle" dominantBaseline="central">⚫</text>
                    </g>
                    <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: rolling ? "jrdrive-spin 0.5s linear infinite" : undefined }}>
                      <text x="16" y="12" fontSize="16" textAnchor="middle" dominantBaseline="central">⚫</text>
                    </g>
                  </g>
                )}
              </g>
            </g>
          </g>

          {/* confetti burst at the flag on win */}
          {won &&
            Array.from({ length: 12 }).map((_, i) => {
              const ang = (i / 12) * Math.PI * 2;
              const glyph = ["🎉", "✨", "⭐", "🎊"][i % 4];
              return (
                <text
                  key={i}
                  x={ROAD[LAST].x}
                  y={ROAD[LAST].y}
                  fontSize="16"
                  textAnchor="middle"
                  dominantBaseline="central"
                  aria-hidden="true"
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    // each particle flies out along its own angle
                    ["--dx" as string]: `${Math.cos(ang) * 60}px`,
                    ["--dy" as string]: `${Math.sin(ang) * 60}px`,
                    animation: `jrdrive-confetti 0.9s ease-out ${i * 0.03}s both`,
                  }}
                >
                  {glyph}
                </text>
              );
            })}
        </svg>
      </div>

      {/* ── BUILD tray (before the car is built) ── */}
      {!built ? (
        <div className="flex w-full flex-col items-center gap-2">
          <div className="text-2xl" aria-hidden="true">👇 🔧</div>
          <div className="flex items-center justify-center gap-3">
            <BuildButton
              label="Add wheels"
              glyph="🛞"
              done={wheels}
              springing={snap === "wheels"}
              onPress={() => place("wheels")}
            />
            <BuildButton
              label="Add motor"
              glyph="⚙️"
              done={motor}
              springing={snap === "motor"}
              onPress={() => place("motor")}
            />
          </div>
        </div>
      ) : (
        /* ── DRIVE controls (after the car is built) ── */
        <div className="flex w-full items-center justify-center gap-3">
          <DriveButton
            label="Turn"
            glyph="↪️"
            tint="rgba(52,211,153,0.12)"
            disabled={won || rolling}
            active={aimed && !won}
            onPress={turn}
          />
          <DriveButton
            label="Go forward"
            glyph="⬆️"
            tint={ACCENT}
            solid
            disabled={won || rolling}
            active={false}
            onPress={forward}
          />
        </div>
      )}

      {/* progress dots — how far along the road, no reading */}
      <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
        {ROAD.map((_, i) => (
          <span key={i} className="text-sm">
            {i === LAST ? (i <= stop ? "🏁" : "🏁") : i <= stop ? "🟢" : "⚪"}
          </span>
        ))}
      </div>

      {/* Reset */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over"
        className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-2xl active:scale-90"
        style={{
          touchAction: "none",
          background: "rgba(255,255,255,0.05)",
          border: "2px solid var(--color-line, #27314f)",
          transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <span aria-hidden="true">🔄</span>
      </button>

      {/* celebratory floaters */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span style={{ animation: "jrdrive-float 1.6s ease-in-out infinite" }} aria-hidden="true">✨</span>
          <span style={{ animation: "jrdrive-float 1.6s ease-in-out 0.2s infinite" }} aria-hidden="true">🎉</span>
          <span style={{ animation: "jrdrive-float 1.6s ease-in-out 0.4s infinite" }} aria-hidden="true">✨</span>
        </div>
      )}

      <style>{`
        @keyframes jrdrive-bob {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.03); }
        }
        @keyframes jrdrive-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes jrdrive-puff {
          0% { transform: translateX(0) scale(0.7); opacity: 0.9; }
          100% { transform: translateX(-14px) scale(1.3); opacity: 0; }
        }
        @keyframes jrdrive-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-7deg); }
          60% { transform: rotate(5deg); }
          85% { transform: rotate(-3deg); }
        }
        @keyframes jrdrive-cheer {
          0%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-12px) scale(1.12); }
          70% { transform: translateY(0) scale(0.96); }
        }
        @keyframes jrdrive-pop {
          0% { transform: scale(0.5); }
          55% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @keyframes jrdrive-flag {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }
        @keyframes jrdrive-confetti {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity: 0; }
        }
        @keyframes jrdrive-float {
          0%, 100% { transform: translateY(0); opacity: 0.85; }
          50% { transform: translateY(-10px); opacity: 1; }
        }
        @keyframes jrdrive-snap {
          0% { transform: scale(0.4); }
          60% { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="jrdrive-bob"], [style*="jrdrive-flag"], [style*="jrdrive-float"],
          [style*="jrdrive-puff"], [style*="jrdrive-spin"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/** A chunky build button with a solid drop "lip" and springy press. */
interface BuildButtonProps {
  label: string;
  glyph: string;
  done: boolean;
  springing: boolean;
  onPress: () => void;
}

function BuildButton({ label, glyph, done, springing, onPress }: BuildButtonProps) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        if (!done) onPress();
      }}
      disabled={done}
      aria-label={done ? `${label} done` : label}
      className="grid h-[78px] w-[78px] place-items-center rounded-2xl text-4xl active:scale-90 disabled:opacity-100"
      style={{
        touchAction: "none",
        background: done ? "rgba(52,211,153,0.18)" : "rgba(11,16,32,0.6)",
        border: `3px solid ${done ? ACCENT : "var(--color-line, #27314f)"}`,
        boxShadow: done ? "none" : `0 6px 0 0 #0e3a2c`,
        transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1)",
        animation: springing ? "jrdrive-snap 0.46s cubic-bezier(.34,1.56,.64,1)" : undefined,
      }}
    >
      <span aria-hidden="true">{done ? "✅" : glyph}</span>
    </button>
  );
}

/** A big drive button. solid = the main GO; lip via boxShadow offset. */
interface DriveButtonProps {
  label: string;
  glyph: string;
  tint: string;
  solid?: boolean;
  disabled: boolean;
  active: boolean;
  onPress: () => void;
}

function DriveButton({ label, glyph, tint, solid, disabled, active, onPress }: DriveButtonProps) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      disabled={disabled}
      aria-label={label}
      className="grid h-[84px] w-[110px] place-items-center rounded-2xl text-4xl active:scale-90 disabled:opacity-50"
      style={{
        touchAction: "none",
        background: solid ? tint : tint,
        color: solid ? "#060810" : ACCENT,
        border: `3px solid ${ACCENT}`,
        boxShadow: solid ? `0 7px 0 0 #0e8a63` : `0 7px 0 0 #15392c`,
        outline: active ? `3px solid ${ACCENT}` : undefined,
        transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1)",
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}
