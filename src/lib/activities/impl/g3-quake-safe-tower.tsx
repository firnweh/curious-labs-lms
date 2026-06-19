"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Earthquake-Safe Tower 🏗️ ────────────────────────────────────────────────
   GRADE 3 (junior, age ~8) · 3D / structures. Single learning goal: a DIAGONAL
   cross-brace turns a wobbly square into two stiff TRIANGLES, so a braced tower
   survives the sideways shaking of an earthquake.

   A tower of three open square floors stands on a shake-table base, with a 200g
   weight 📦 balanced on top. Each square floor has one big tappable diagonal
   SLOT — tapping it snaps a brace in (or out), splitting that square into two
   strong triangles 🔺. A counter shows "0/3 floors braced". The big SHAKE
   button runs a deterministic quake: the base slides left-right while every
   UNBRACED floor leans and jiggles (parallelogram skew) and braced floors stay
   rigid. If any floor is still an open square the tower tilts past the line and
   the weight wobbles off — a gentle "crash, brace more!" bubble, instantly
   resettable, never a harsh fail. Brace all three floors, press SHAKE, and the
   tower stands perfectly straight: "Earthquake-proof!" + confetti ✨🎉 ⭐⭐⭐.

   onComplete fires exactly once on the surviving tower (guarded by reportedRef).
   No reading required — beams, emoji and motion tell the whole story. */

const ACCENT = "#f59e0b";

/** Three stacked square floors; every one must be braced to survive. */
const FLOOR_COUNT = 3;
const NEEDED = FLOOR_COUNT;

/* ── Layout maths (virtual SVG units; CSS scales it responsively) ─────────── */
const VW = 320;
const VH = 360;
const TOWER_W = 132; // width of each square floor
const FLOOR_H = 72; // height of each square floor
const CX = VW / 2; // tower centre line
const LEFT = CX - TOWER_W / 2;
const RIGHT = CX + TOWER_W / 2;
const BASE_Y = 312; // top of the shake-table base
const TOP_Y = BASE_Y - FLOOR_COUNT * FLOOR_H; // top beam of the whole tower

/** y of the beam ABOVE floor i (floor 0 sits on the base). */
const floorTopY = (i: number): number => BASE_Y - (i + 1) * FLOOR_H;
const floorBotY = (i: number): number => BASE_Y - i * FLOOR_H;

type Phase = "build" | "shaking" | "won" | "crash";

export default function QuakeSafeTower({ onComplete }: ActivityProps) {
  // Which floors currently have a diagonal brace.
  const [braced, setBraced] = useState<boolean[]>(() => Array(FLOOR_COUNT).fill(false));
  const [phase, setPhase] = useState<Phase>("build");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const shaking = phase === "shaking";
  const won = phase === "won";
  const crashing = phase === "crash";
  const locked = shaking || won; // no editing mid-quake or after the win

  const bracedCount = useMemo<number>(
    () => braced.reduce((n, b) => n + (b ? 1 : 0), 0),
    [braced],
  );
  const triangles = bracedCount * 2; // each diagonal splits a square into two triangles

  const toggleFloor = useCallback(
    (i: number): void => {
      if (locked) return;
      setBraced((prev) => {
        const next = [...prev];
        next[i] = !next[i];
        return next;
      });
      // Coming back from a crash/idle into building keeps things tidy.
      setPhase("build");
    },
    [locked],
  );

  const reset = useCallback((): void => {
    clearTimer();
    reportedRef.current = false;
    setBraced(Array(FLOOR_COUNT).fill(false));
    setPhase("build");
  }, [clearTimer]);

  const shake = useCallback((): void => {
    if (locked) return;
    clearTimer();
    setPhase("shaking");
    const safe = bracedCount >= NEEDED;
    // Let the quake run, THEN judge — deterministic, no randomness.
    timerRef.current = setTimeout(() => {
      if (safe) {
        setPhase("won");
        if (!reportedRef.current) {
          reportedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: "Earthquake-proof! Every floor braced into strong triangles. 🏗️",
          });
        }
      } else {
        setPhase("crash");
        onComplete({
          passed: false,
          detail:
            bracedCount === 0
              ? "The wobbly squares leaned over! Add a diagonal brace to each floor."
              : "Almost! Some floors are still open squares. Brace every floor, then shake.",
        });
        // Always recoverable — settle back to building after the wobble.
        timerRef.current = setTimeout(() => setPhase("build"), 1300);
      }
    }, 1600);
  }, [locked, clearTimer, bracedCount, onComplete]);

  const statusEmoji = won ? "🎉" : crashing ? "😮" : shaking ? "〰️" : "🏗️";
  const statusLabel = won
    ? "Earthquake-proof! The braced tower stood through the quake."
    : shaking
      ? "The ground is shaking — testing the tower"
      : crashing
        ? "The tower leaned over — brace every floor with a diagonal and try again"
        : `${bracedCount} of ${FLOOR_COUNT} floors braced — tap a slot, then shake`;

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{`
        @keyframes g3quakesafetower-ground {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        @keyframes g3quakesafetower-jiggle {
          0%, 100% { transform: skewX(0deg); }
          25% { transform: skewX(14deg); }
          75% { transform: skewX(-14deg); }
        }
        @keyframes g3quakesafetower-topple {
          0% { transform: rotate(0deg); }
          60% { transform: rotate(11deg); }
          100% { transform: rotate(8deg); }
        }
        @keyframes g3quakesafetower-fall {
          0% { transform: translate(0, 0) rotate(0deg); }
          100% { transform: translate(40px, 22px) rotate(70deg); }
        }
        @keyframes g3quakesafetower-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes g3quakesafetower-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @keyframes g3quakesafetower-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>

      {/* ── Tiny visual status pill ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: won ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.04)",
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
            🔺×{triangles}
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The tower scene ── */}
      <div className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A three-floor tower with a weight on top, standing on a shake table"
        >
          <defs>
            <linearGradient id="g3qst-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b1426" />
              <stop offset="100%" stopColor="#10243b" />
            </linearGradient>
            <linearGradient id="g3qst-base" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a4866" />
              <stop offset="100%" stopColor="#1b2436" />
            </linearGradient>
          </defs>

          {/* sky */}
          <rect x={0} y={0} width={VW} height={VH} fill="url(#g3qst-sky)" />

          {/* the tilt / safety line — if the tower leans past this it crashes */}
          <line
            x1={RIGHT + 6}
            y1={TOP_Y - 6}
            x2={RIGHT + 6}
            y2={BASE_Y}
            stroke="rgba(248,113,113,0.55)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />

          {/* ── the whole tower group: leans (rigid) on crash, stays straight on win ── */}
          <g
            style={{
              transformBox: "view-box",
              transformOrigin: `${CX}px ${BASE_Y}px`,
              animation: crashing ? "g3quakesafetower-topple 1s ease-in forwards" : undefined,
            }}
          >
            {/* horizontal beams (floor + ceilings) */}
            {Array.from({ length: FLOOR_COUNT + 1 }, (_, i) => {
              const y = BASE_Y - i * FLOOR_H;
              return (
                <line
                  key={`beam-${i}`}
                  x1={LEFT}
                  y1={y}
                  x2={RIGHT}
                  y2={y}
                  stroke={won ? ACCENT : "#cbd5e1"}
                  strokeWidth={7}
                  strokeLinecap="round"
                  style={{ transition: "stroke 200ms ease" }}
                />
              );
            })}

            {/* each floor = two posts + (when braced) a diagonal; unbraced floors jiggle */}
            {Array.from({ length: FLOOR_COUNT }, (_, i) => {
              const top = floorTopY(i);
              const bot = floorBotY(i);
              const isOn = braced[i];
              return (
                <g
                  key={`floor-${i}`}
                  style={{
                    transformBox: "view-box",
                    transformOrigin: `${CX}px ${bot}px`,
                    // Unbraced squares shear like a parallelogram during the quake.
                    animation:
                      shaking && !isOn
                        ? "g3quakesafetower-jiggle 0.5s ease-in-out infinite"
                        : undefined,
                  }}
                >
                  {/* left + right posts */}
                  <line
                    x1={LEFT}
                    y1={top}
                    x2={LEFT}
                    y2={bot}
                    stroke={won ? ACCENT : "#cbd5e1"}
                    strokeWidth={7}
                    strokeLinecap="round"
                    style={{ transition: "stroke 200ms ease" }}
                  />
                  <line
                    x1={RIGHT}
                    y1={top}
                    x2={RIGHT}
                    y2={bot}
                    stroke={won ? ACCENT : "#cbd5e1"}
                    strokeWidth={7}
                    strokeLinecap="round"
                    style={{ transition: "stroke 200ms ease" }}
                  />
                  {/* the diagonal brace — only when this floor is braced */}
                  {isOn && (
                    <line
                      x1={LEFT}
                      y1={bot}
                      x2={RIGHT}
                      y2={top}
                      stroke={ACCENT}
                      strokeWidth={7}
                      strokeLinecap="round"
                      style={{
                        filter: `drop-shadow(0 0 4px ${ACCENT}aa)`,
                        transformBox: "fill-box",
                        transformOrigin: "center",
                        animation: "g3quakesafetower-pop 0.35s ease-out",
                      }}
                    />
                  )}
                </g>
              );
            })}

            {/* the 200g weight balanced on the top beam */}
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: `${CX}px ${TOP_Y}px`,
                animation: crashing ? "g3quakesafetower-fall 1s ease-in 0.3s forwards" : undefined,
              }}
            >
              <text
                x={CX}
                y={TOP_Y - 18}
                fontSize={30}
                textAnchor="middle"
                dominantBaseline="central"
                aria-label="200 gram weight"
                style={{
                  animation: won ? "g3quakesafetower-float 1.2s ease-in-out infinite" : undefined,
                }}
              >
                📦
              </text>
            </g>
          </g>

          {/* ── the shake table base: slides left-right during the quake ── */}
          <g
            style={{
              transformBox: "view-box",
              transformOrigin: `${CX}px ${BASE_Y}px`,
              animation: shaking ? "g3quakesafetower-ground 0.5s ease-in-out infinite" : undefined,
            }}
          >
            <rect
              x={LEFT - 28}
              y={BASE_Y}
              width={TOWER_W + 56}
              height={26}
              rx={6}
              fill="url(#g3qst-base)"
              stroke="#475569"
              strokeWidth={1.5}
            />
            <text x={LEFT - 12} y={BASE_Y + 14} fontSize={16} textAnchor="middle" aria-hidden="true">
              ⬅️
            </text>
            <text x={RIGHT + 12} y={BASE_Y + 14} fontSize={16} textAnchor="middle" aria-hidden="true">
              ➡️
            </text>
          </g>
        </svg>

        {/* ── Tappable floor slots, overlaid on the tower ── */}
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: FLOOR_COUNT }, (_, i) => {
            const top = floorTopY(i);
            const leftPct = (LEFT / VW) * 100;
            const widthPct = (TOWER_W / VW) * 100;
            const topPct = (top / VH) * 100;
            const heightPct = (FLOOR_H / VH) * 100;
            const isOn = braced[i];
            const floorNo = FLOOR_COUNT - i; // top floor reads as "floor 3" etc.
            return (
              <button
                key={`slot-${i}`}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  toggleFloor(i);
                }}
                disabled={locked}
                aria-label={
                  isOn
                    ? `Floor ${floorNo} braced with a triangle beam. Tap to remove it.`
                    : `Floor ${floorNo} is an open square. Tap to add a triangle brace.`
                }
                aria-pressed={isOn}
                className="pointer-events-auto absolute grid place-items-center rounded-lg text-2xl transition active:scale-95 disabled:opacity-100"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  touchAction: "none",
                  background: isOn ? "rgba(245,158,11,0.10)" : "rgba(255,255,255,0.04)",
                  border: `2px dashed ${isOn ? ACCENT : "rgba(148,163,184,0.5)"}`,
                  color: isOn ? ACCENT : "rgba(203,213,225,0.85)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    animation:
                      !isOn && !locked ? "g3quakesafetower-glow 1.6s ease-in-out infinite" : undefined,
                  }}
                >
                  {isOn ? "🔺" : "➕"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Brace counter (visual, one tile per floor) ── */}
      <div
        className="flex w-full max-w-[420px] items-center justify-center gap-2 rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
        }}
        aria-label={`${bracedCount} of ${FLOOR_COUNT} floors braced`}
      >
        <span aria-hidden="true" className="mr-1 text-sm opacity-70">
          {bracedCount}/{FLOOR_COUNT}
        </span>
        {braced.map((b, i) => (
          <span
            key={`dot-${i}`}
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-lg text-xl"
            style={{
              background: b ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.03)",
              border: `1.5px solid ${b ? ACCENT : "var(--color-line, #33405c)"}`,
            }}
          >
            {b ? "🔺" : "⬜"}
          </span>
        ))}
      </div>

      {/* ── Controls: SHAKE · Reset ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            shake();
          }}
          disabled={locked}
          aria-label="Shake the ground — run the earthquake test"
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#1a1206",
            boxShadow: "0 6px 0 0 #b4790a",
          }}
        >
          <span aria-hidden="true">{shaking ? "〰️" : "🌐"}</span>
          <span aria-hidden="true" className="text-xl font-extrabold">
            SHAKE
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={shaking}
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

      {/* crash nudge bubble — gentle, never scolding, instantly resettable */}
      {crashing && (
        <div
          className="rounded-2xl px-4 py-2 text-center text-sm"
          aria-hidden="true"
          style={{
            background: "rgba(248,113,113,0.12)",
            border: "2px solid rgba(248,113,113,0.5)",
            color: "#fca5a5",
          }}
        >
          💥 Crash — brace more floors!
        </div>
      )}

      {/* win banner + celebratory floaters */}
      {won && (
        <>
          <div
            className="rounded-2xl px-4 py-2 text-center text-base font-extrabold"
            aria-hidden="true"
            style={{
              background: "rgba(245,158,11,0.16)",
              border: `2px solid ${ACCENT}`,
              color: ACCENT,
              boxShadow: `0 0 18px ${ACCENT}55`,
            }}
          >
            🏗️ Earthquake-proof!
          </div>
          <div className="pointer-events-none flex justify-center gap-2 text-2xl">
            <span style={{ animation: "g3quakesafetower-float 1.1s ease-in-out infinite" }} aria-hidden="true">
              ✨
            </span>
            <span
              style={{ animation: "g3quakesafetower-float 1.1s ease-in-out infinite", animationDelay: "0.2s" }}
              aria-hidden="true"
            >
              🎉
            </span>
            <span
              style={{ animation: "g3quakesafetower-float 1.1s ease-in-out infinite", animationDelay: "0.4s" }}
              aria-hidden="true"
            >
              ✨
            </span>
          </div>
        </>
      )}
    </div>
  );
}
