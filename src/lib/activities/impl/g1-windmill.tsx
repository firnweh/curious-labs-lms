"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#34d399";

/** The blade angle that catches the most wind. */
const SWEET = 40;
/** Power (0–1) the windmill must reach to fully light the bulb and win. */
const WIN_POWER = 0.9;
/** Blade angle starts flat, tilts up to here. */
const MAX_ANGLE = 60;

/** Hub centre in the 360×260 viewBox — the blades spin around this point. */
const HUB = { x: 180, y: 96 };

/**
 * Power curve: a smooth hill peaking at SWEET°.
 * Flat blades (≈0°) barely catch wind; too-steep (≈60°) stalls too.
 * Returns 0..1.
 */
function powerFor(angle: number): number {
  // Bell shape centred on SWEET. Width chosen so ~35–45° is the bright zone
  // and 0°/60° stay dim.
  const spread = 22;
  const d = (angle - SWEET) / spread;
  return Math.exp(-(d * d));
}

export default function WindmillPower({ onComplete }: ActivityProps) {
  const [angle, setAngle] = useState<number>(0);
  const [windOn, setWindOn] = useState<boolean>(false);
  const [spin, setSpin] = useState<number>(0); // accumulated rotation, degrees
  const [won, setWon] = useState<boolean>(false);

  const rafRef = useRef<number | null>(null);
  const reportedRef = useRef<boolean>(false);
  // Live mirrors so the rAF loop reads fresh values without restarting.
  const angleRef = useRef<number>(0);
  const windRef = useRef<boolean>(false);

  useEffect(() => {
    angleRef.current = angle;
  }, [angle]);
  useEffect(() => {
    windRef.current = windOn;
  }, [windOn]);

  // Power 0..1 for the *current* angle, only meaningful while wind blows.
  const power = useMemo(
    () => (windOn ? powerFor(angle) : 0),
    [windOn, angle],
  );
  const litUp = power >= WIN_POWER;

  // rAF spin loop: keeps accumulating rotation; speed tracks live power so
  // the slider feels instant without tearing down the animation.
  useEffect(() => {
    let last = 0;
    const tick = (t: number): void => {
      if (last === 0) last = t;
      const dt = (t - last) / 1000; // seconds
      last = t;
      const p = windRef.current ? powerFor(angleRef.current) : 0;
      // Max ~320°/s at full power; a tiny idle drift so it never looks frozen.
      const degPerSec = windRef.current ? 30 + p * 320 : 0;
      if (degPerSec > 0) {
        setSpin((s) => (s + degPerSec * dt) % 360);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  // Celebrate exactly once when the bulb is fully lit with the wind on.
  useEffect(() => {
    if (litUp && windOn && !reportedRef.current) {
      reportedRef.current = true;
      setWon(true);
      onComplete({ passed: true, stars: 3 });
    }
  }, [litUp, windOn, onComplete]);

  const onAngle = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    setAngle(Number(e.target.value));
  }, []);

  const toggleWind = useCallback((): void => {
    setWindOn((w) => !w);
  }, []);

  const reset = useCallback((): void => {
    reportedRef.current = false;
    setAngle(0);
    setWindOn(false);
    setSpin(0);
    setWon(false);
  }, []);

  // Status emoji — no reading needed.
  const statusEmoji = won
    ? "🎉"
    : !windOn
      ? "🌬️"
      : litUp
        ? "💡"
        : power > 0.45
          ? "🙂"
          : "💤";

  // Bulb brightness 0..1.
  const glow = power;
  // The four blades, each tilted by `angle` so the tilt is actually visible.
  const blades = [0, 90, 180, 270];

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Scene */}
      <div
        className="panel relative overflow-hidden rounded-2xl border border-line p-2"
        style={{
          background: litUp
            ? "radial-gradient(circle at 50% 30%, rgba(52,211,153,0.16), transparent 62%)"
            : undefined,
          transition: "background 400ms ease",
        }}
      >
        <svg
          viewBox="0 0 360 260"
          className="block w-full select-none"
          role="img"
          aria-label="A windmill on a hill with a sun and a light bulb. Tilt the blades with the slider and turn the wind on to spin it and light the bulb."
        >
          <defs>
            <radialGradient id="wm-sky" cx="50%" cy="20%" r="90%">
              <stop offset="0%" stopColor="#0e1630" />
              <stop offset="100%" stopColor="#0b1020" />
            </radialGradient>
            <radialGradient id="wm-bulb" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff6c4" />
              <stop offset="50%" stopColor={ACCENT} />
              <stop offset="100%" stopColor="rgba(52,211,153,0)" />
            </radialGradient>
            <filter id="wm-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* sky */}
          <rect x="0" y="0" width="360" height="260" fill="url(#wm-sky)" />

          {/* sun */}
          <g transform="translate(50 48)">
            <circle r="22" fill="#ffd75e" opacity="0.9" />
            <text x="0" y="9" textAnchor="middle" fontSize="30" style={{ pointerEvents: "none" }}>
              ☀️
            </text>
          </g>

          {/* drifting wind puffs when wind is ON */}
          {windOn && (
            <g aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <text key={i} fontSize="22" opacity="0.7" style={{ pointerEvents: "none" }}>
                  💨
                  <animateMotion
                    dur={`${2.6 - power * 1.4}s`}
                    begin={`${i * 0.7}s`}
                    repeatCount="indefinite"
                    path="M-30 70 L120 70"
                  />
                </text>
              ))}
            </g>
          )}

          {/* hill / landscape */}
          <path
            d="M0 230 Q90 196 180 214 T360 224 L360 260 L0 260 Z"
            fill="#13351f"
            stroke={ACCENT}
            strokeWidth="2"
            opacity="0.55"
          />
          <text x="300" y="246" fontSize="22" style={{ pointerEvents: "none" }}>
            🌿
          </text>
          <text x="24" y="250" fontSize="20" style={{ pointerEvents: "none" }}>
            🌸
          </text>

          {/* windmill tower / stand */}
          <path
            d={`M${HUB.x - 12} 222 L${HUB.x - 4} ${HUB.y + 6} L${HUB.x + 4} ${HUB.y + 6} L${HUB.x + 12} 222 Z`}
            fill="#1b2440"
            stroke={ACCENT}
            strokeWidth="2.5"
          />

          {/* spinning blade group */}
          <g transform={`rotate(${spin} ${HUB.x} ${HUB.y})`}>
            {blades.map((base) => (
              <g key={base} transform={`rotate(${base} ${HUB.x} ${HUB.y})`}>
                {/* A blade pointing up from the hub. `angle` tilts (skews) it so
                    the pitch is visibly different as the slider moves. */}
                <path
                  d={`M${HUB.x} ${HUB.y}
                      L${HUB.x - 7 - angle * 0.25} ${HUB.y - 30}
                      L${HUB.x - 2} ${HUB.y - 70}
                      L${HUB.x + 9 + angle * 0.35} ${HUB.y - 62}
                      Z`}
                  fill={ACCENT}
                  opacity={0.55 + power * 0.45}
                  stroke="#0b1020"
                  strokeWidth="1.5"
                />
              </g>
            ))}
          </g>

          {/* hub */}
          <circle cx={HUB.x} cy={HUB.y} r="9" fill="#0b1020" stroke={ACCENT} strokeWidth="3" />
          <circle cx={HUB.x} cy={HUB.y} r="3.5" fill={ACCENT} />

          {/* power wire down to the bulb */}
          <path
            d={`M${HUB.x + 12} 210 Q300 210 314 176`}
            fill="none"
            stroke={litUp ? ACCENT : "#2a3450"}
            strokeWidth="4"
            strokeLinecap="round"
            style={{ transition: "stroke 300ms ease" }}
          />

          {/* bulb the windmill powers (top-right) */}
          {glow > 0.02 && (
            <circle cx="314" cy="150" r={20 + glow * 26} fill="url(#wm-bulb)" opacity={glow} filter="url(#wm-soft)" />
          )}
          <g transform="translate(314 150)">
            <circle
              r="22"
              fill={litUp ? "rgba(255,246,196,0.22)" : "#0b1020"}
              stroke={litUp ? ACCENT : "#3a4566"}
              strokeWidth="2.5"
              style={{ transition: "fill 250ms ease, stroke 250ms ease" }}
            />
            <text
              x="0"
              y="9"
              textAnchor="middle"
              fontSize="26"
              opacity={0.4 + glow * 0.6}
              style={{ pointerEvents: "none" }}
            >
              💡
            </text>
          </g>

          {/* power gauge bar along the bottom */}
          <g transform="translate(0 0)">
            <rect x="24" y="240" width="200" height="12" rx="6" fill="#0b1020" stroke="#2a3450" strokeWidth="1.5" />
            <rect
              x="24"
              y="240"
              width={200 * power}
              height="12"
              rx="6"
              fill={ACCENT}
              style={{ transition: "width 120ms linear" }}
            />
            {/* sweet-spot marker on the gauge */}
            <rect x={24 + 200 * WIN_POWER - 1.5} y="237" width="3" height="18" rx="1.5" fill="#fff6c4" opacity="0.9" />
          </g>
        </svg>

        {/* emoji-only status */}
        <div className="mt-1 flex items-center justify-center gap-2 text-2xl" aria-live="polite">
          <span aria-hidden="true">{statusEmoji}</span>
        </div>
      </div>

      {/* Blade-angle slider */}
      <div className="panel flex flex-col gap-2 rounded-2xl border border-line p-3">
        <div className="flex items-center justify-between">
          <span aria-hidden="true" className="text-2xl">
            🪶
          </span>
          <span className="font-display tabular-nums text-lg" style={{ color: ACCENT }}>
            {angle}°
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_ANGLE}
          step={1}
          value={angle}
          onChange={onAngle}
          aria-label={`Blade tilt, ${angle} degrees`}
          className="h-3 w-full cursor-pointer appearance-none rounded-full bg-panel"
          style={{ accentColor: ACCENT, minHeight: 44 }}
        />
        <div className="flex items-center justify-between text-2xl" aria-hidden="true">
          <span>🟰</span>
          <span>📐</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Big wind toggle */}
        <button
          type="button"
          onClick={toggleWind}
          aria-label={windOn ? "Wind is on, tap to turn off" : "Tap to turn the wind on"}
          aria-pressed={windOn}
          className="font-display flex min-h-[56px] items-center gap-2 rounded-2xl px-6 py-3 text-lg font-bold transition active:scale-95"
          style={
            windOn
              ? { background: ACCENT, color: "#060810", boxShadow: `0 0 18px ${ACCENT}` }
              : {
                  background: "rgba(11,16,32,0.6)",
                  color: "#9aa6cf",
                  borderWidth: 2,
                  borderStyle: "solid",
                  borderColor: "var(--color-line, #27314f)",
                }
          }
        >
          <span aria-hidden="true" className="text-2xl">
            🌬️
          </span>
          {windOn ? "ON" : "OFF"}
        </button>

        {/* Reset */}
        <button
          type="button"
          onClick={reset}
          aria-label="Start over"
          className="flex min-h-[56px] items-center gap-2 rounded-2xl border-2 border-line bg-panel/60 px-5 py-3 text-lg font-bold text-ink-dim transition active:scale-95"
        >
          <span aria-hidden="true" className="text-2xl">
            🔄
          </span>
        </button>
      </div>

      {/* celebration */}
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
    </div>
  );
}
