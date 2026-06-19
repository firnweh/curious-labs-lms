"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Water Level Watcher 💧 ───────────────────────────────────────────────────
   GRADE 3 (junior, age ~8). Subject: ROBOTICS.
   ONE learning goal: a SENSOR can measure HOW MUCH — three probe wires at
   different heights tell a machine whether water is Low, Mid, or High.

   A clear tank has three horizontal probe wires: Low (green), Mid (yellow) and
   High (red, with a buzzer 🔔). Each probe is wired to its own lamp. The child
   DRAGS a big tap handle 🚰 up and down to raise or lower the animated water.
   As the wobbly water surface passes a probe, that probe glows, its lamp turns
   on with a soft chime. Passing the High probe trips the buzzer → "OVERFLOW!"
   and a shake — but it never ends the game, just nudges the water back down.

   TASK (target card): "Fill to the YELLOW line" — raise the water so EXACTLY
   the Low and Mid lamps are lit (green + yellow), without tripping red overflow.
   Hold it steady in the yellow band for a moment → "Just right!" celebration →
   onComplete({passed:true, stars:3}) once. Fully draggable, generous band,
   always winnable, never scolds. No reading needed — colours + lamps + emoji.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";

// ── Virtual SVG world (CSS scales it responsively) ───────────────────────────
const VW = 360;
const VH = 280;

// The tank rectangle.
const TANK_X = 70;
const TANK_W = 150;
const TANK_TOP = 24;
const TANK_BOTTOM = 244; // floor of the water
const TANK_H = TANK_BOTTOM - TANK_TOP;

// Water level is a fraction 0..1 (0 = empty/bottom, 1 = full/brim).
// y position of the surface for a given level.
const surfaceY = (level: number): number => TANK_BOTTOM - level * TANK_H;

// Probe heights as fractions of fullness. A probe fires once the water level
// rises past it. Generous spacing keeps each band easy to land in.
const LOW_LEVEL = 0.3;
const MID_LEVEL = 0.58;
const HIGH_LEVEL = 0.86;

// The target band: water must rest above Mid but below High → Low+Mid lit,
// red NOT tripped. A wide, forgiving sweet spot for little fingers.
const TARGET_LO = MID_LEVEL + 0.02; // just past the yellow probe
const TARGET_HI = HIGH_LEVEL - 0.04; // safely short of overflow
const HOLD_MS = 900; // rest steady this long → "Just right!"

const START_LEVEL = 0.08;

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

interface Probe {
  id: "low" | "mid" | "high";
  level: number;
  color: string;
  glow: string;
  label: string;
}

const PROBES: readonly Probe[] = [
  { id: "low", level: LOW_LEVEL, color: "#34d399", glow: "#34d399", label: "Low probe, green" },
  { id: "mid", level: MID_LEVEL, color: "#fbbf24", glow: "#fbbf24", label: "Mid probe, yellow" },
  { id: "high", level: HIGH_LEVEL, color: "#f87171", glow: "#f87171", label: "High probe, red, with buzzer" },
];

type Phase = "play" | "won";

export default function WaterLevelWatcher({ onComplete }: ActivityProps) {
  const [level, setLevel] = useState<number>(START_LEVEL);
  const [phase, setPhase] = useState<Phase>("play");
  const [dragging, setDragging] = useState<boolean>(false);
  const [overflow, setOverflow] = useState<boolean>(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const reportedRef = useRef<boolean>(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overflowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const won = phase === "won";

  // ── Which lamps are lit at the current level (deterministic). ──────────────
  const lit = useMemo<Record<Probe["id"], boolean>>(
    () => ({
      low: level >= LOW_LEVEL,
      mid: level >= MID_LEVEL,
      high: level >= HIGH_LEVEL,
    }),
    [level],
  );

  // In the winning yellow band → Low+Mid on, High off.
  const inTarget = level >= TARGET_LO && level <= TARGET_HI;

  const clearHold = useCallback((): void => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
      if (overflowTimer.current !== null) clearTimeout(overflowTimer.current);
    },
    [],
  );

  // ── Trip / clear the overflow buzzer as the level crosses the High probe. ──
  useEffect(() => {
    if (won) return;
    if (lit.high && !overflow) {
      setOverflow(true);
      // Gently ease the water back below the brim so it's recoverable.
      if (overflowTimer.current !== null) clearTimeout(overflowTimer.current);
      overflowTimer.current = setTimeout(() => {
        setLevel((l) => (l >= HIGH_LEVEL ? HIGH_LEVEL - 0.07 : l));
        setOverflow(false);
      }, 850);
    }
  }, [lit.high, overflow, won]);

  // ── Hold-in-band → win. Restart the timer whenever the band state changes. ─
  useEffect(() => {
    if (won) return;
    clearHold();
    if (inTarget && !dragging && !overflow) {
      holdTimer.current = setTimeout(() => {
        setPhase("won");
        if (!reportedRef.current) {
          reportedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: "Just right! Low and Mid lamps lit — no overflow. 💧✨",
          });
        }
      }, HOLD_MS);
    }
    return clearHold;
  }, [inTarget, dragging, overflow, won, clearHold, onComplete]);

  // ── Dragging the tap handle (pointer y → water level). ─────────────────────
  const pointerToLevel = useCallback((clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return level;
    const rect = svg.getBoundingClientRect();
    const ratioY = (clientY - rect.top) / rect.height; // 0 = top of svg
    const yInVirtual = ratioY * VH;
    const lvl = (TANK_BOTTOM - yInVirtual) / TANK_H;
    return clamp(lvl, 0, 1);
  }, [level]);

  const onHandleDown = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (won) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragging(true);
      setLevel(pointerToLevel(e.clientY));
    },
    [won, pointerToLevel],
  );

  const onHandleMove = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!dragging) return;
      e.preventDefault();
      setLevel(pointerToLevel(e.clientY));
    },
    [dragging, pointerToLevel],
  );

  const onHandleUp = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!dragging) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      setDragging(false);
    },
    [dragging],
  );

  // ── Big +/- nudge buttons (keyboard / no-drag fallback). ───────────────────
  const nudge = useCallback(
    (delta: number): void => {
      if (won) return;
      setLevel((l) => clamp(l + delta, 0, 1));
    },
    [won],
  );

  const reset = useCallback((): void => {
    clearHold();
    if (overflowTimer.current !== null) clearTimeout(overflowTimer.current);
    reportedRef.current = false;
    setLevel(START_LEVEL);
    setPhase("play");
    setDragging(false);
    setOverflow(false);
  }, [clearHold]);

  // ── Status (emoji + short label, no paragraphs). ───────────────────────────
  const statusEmoji = useMemo<string>(() => {
    if (won) return "🎉";
    if (overflow) return "🔔";
    if (inTarget) return "👍";
    if (lit.mid) return "💧";
    return "🚰";
  }, [won, overflow, inTarget, lit.mid]);

  const statusLabel = won
    ? "Just right! Low and Mid lamps are lit with no overflow."
    : overflow
      ? "Overflow! The water is too high — pull the tap down a little."
      : inTarget
        ? "Perfect level — hold it steady in the yellow band!"
        : lit.mid
          ? "Mid lamp on. Keep it between yellow and red."
          : "Drag the tap up to fill the tank to the yellow line.";

  const handleY = surfaceY(level);
  const waterY = handleY;
  const waterH = TANK_BOTTOM - waterY;

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status pill ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: won
            ? "rgba(52,211,153,0.16)"
            : overflow
              ? "rgba(248,113,113,0.16)"
              : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : overflow ? "#f87171" : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : overflow ? "0 0 18px #f8717166" : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {won ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            💧→🟡
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── Target card: fill to the YELLOW line ── */}
      <div
        className="flex w-full max-w-[420px] items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold"
        style={{
          background: "rgba(251,191,36,0.12)",
          border: "2px solid #fbbf24",
          color: "#fbbf24",
        }}
        aria-label="Goal: fill the tank to the yellow line so the green and yellow lamps light up, without the red overflow."
      >
        <span aria-hidden="true" className="text-xl">
          🎯
        </span>
        <span aria-hidden="true">Fill to the</span>
        <span aria-hidden="true" className="text-xl">
          🟡
        </span>
        <span aria-hidden="true">YELLOW line</span>
      </div>

      {/* ── The tank + probes + lamps ── */}
      <div className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none", animation: overflow ? "g3waterlevelalert-shake 0.5s ease" : undefined }}
          role="img"
          aria-label="A clear water tank with green, yellow and red probe wires, each wired to a lamp."
        >
          <defs>
            <linearGradient id="g3waterlevelalert-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.78" />
            </linearGradient>
            <clipPath id="g3waterlevelalert-tankclip">
              <rect x={TANK_X} y={TANK_TOP} width={TANK_W} height={TANK_H} rx={10} />
            </clipPath>
          </defs>

          {/* tank back glass */}
          <rect
            x={TANK_X}
            y={TANK_TOP}
            width={TANK_W}
            height={TANK_H}
            rx={10}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(120,140,170,0.4)"
            strokeWidth={2}
          />

          {/* ── Water fill (clipped to tank), with a wobbly surface ── */}
          <g clipPath="url(#g3waterlevelalert-tankclip)">
            <rect
              x={TANK_X}
              y={waterY + 4}
              width={TANK_W}
              height={waterH + 20}
              fill="url(#g3waterlevelalert-water)"
              style={{ transition: dragging ? "none" : "y 220ms ease, height 220ms ease" }}
            />
            {/* wobbly surface — two offset waves riding the water top */}
            <g
              style={{
                transform: `translateY(${waterY}px)`,
                transition: dragging ? "none" : "transform 220ms ease",
              }}
            >
              <path
                d={`M ${TANK_X} 6 q 18 -9 36 0 t 36 0 t 36 0 t 36 0 t 36 0 V 30 H ${TANK_X} Z`}
                fill="#7dd3fc"
                opacity={0.55}
                style={{ animation: "g3waterlevelalert-wave 2.6s ease-in-out infinite" }}
              />
              <path
                d={`M ${TANK_X} 4 q 18 8 36 0 t 36 0 t 36 0 t 36 0 t 36 0 V 30 H ${TANK_X} Z`}
                fill="url(#g3waterlevelalert-water)"
                style={{ animation: "g3waterlevelalert-wave 2.1s ease-in-out infinite reverse" }}
              />
            </g>
          </g>

          {/* ── Target band highlight (yellow sweet spot) ── */}
          <rect
            x={TANK_X - 2}
            y={surfaceY(TARGET_HI)}
            width={TANK_W + 4}
            height={surfaceY(TARGET_LO) - surfaceY(TARGET_HI)}
            fill="#fbbf24"
            opacity={inTarget ? 0.22 : 0.1}
            style={{ pointerEvents: "none" }}
          />

          {/* ── Probe wires + lamps ── */}
          {PROBES.map((p) => {
            const py = surfaceY(p.level);
            const on = lit[p.id];
            const lampX = TANK_X + TANK_W + 44;
            const lampY = py;
            return (
              <g key={p.id} aria-label={`${p.label}: ${on ? "on" : "off"}`}>
                {/* probe wire across the tank */}
                <line
                  x1={TANK_X}
                  y1={py}
                  x2={TANK_X + TANK_W}
                  y2={py}
                  stroke={p.color}
                  strokeWidth={on ? 3.5 : 2}
                  strokeDasharray="6 4"
                  opacity={on ? 1 : 0.55}
                  style={{ filter: on ? `drop-shadow(0 0 5px ${p.glow})` : undefined }}
                />
                {/* probe tip dot inside tank */}
                <circle
                  cx={TANK_X + 8}
                  cy={py}
                  r={on ? 5 : 3.5}
                  fill={on ? p.color : "#1b2436"}
                  stroke={p.color}
                  strokeWidth={1.5}
                  style={{ filter: on ? `drop-shadow(0 0 6px ${p.glow})` : undefined }}
                />
                {/* wire out to the lamp */}
                <line
                  x1={TANK_X + TANK_W}
                  y1={py}
                  x2={lampX - 11}
                  y2={lampY}
                  stroke={on ? p.color : "#3a4866"}
                  strokeWidth={2}
                  opacity={on ? 1 : 0.6}
                />
                {/* the indicator lamp */}
                <circle
                  cx={lampX}
                  cy={lampY}
                  r={11}
                  fill={on ? p.color : "#16202f"}
                  stroke={p.color}
                  strokeWidth={2.5}
                  style={{
                    filter: on ? `drop-shadow(0 0 9px ${p.glow})` : undefined,
                    animation: on && p.id === "high" ? "g3waterlevelalert-flash 0.5s steps(2) infinite" : undefined,
                  }}
                />
                {/* buzzer icon on the High lamp */}
                {p.id === "high" && (
                  <text
                    x={lampX}
                    y={lampY - 22}
                    fontSize={15}
                    textAnchor="middle"
                    dominantBaseline="central"
                    aria-hidden="true"
                    style={{ animation: on ? "g3waterlevelalert-ring 0.4s ease-in-out infinite" : undefined }}
                  >
                    🔔
                  </text>
                )}
              </g>
            );
          })}

          {/* OVERFLOW! banner */}
          {overflow && !won && (
            <text
              x={TANK_X + TANK_W / 2}
              y={TANK_TOP - 8}
              fontSize={16}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#f87171"
              aria-hidden="true"
              style={{ animation: "g3waterlevelalert-flash 0.4s steps(2) infinite" }}
            >
              OVERFLOW!
            </text>
          )}

          {/* ── The draggable TAP handle on the left of the tank ── */}
          <g
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            style={{
              cursor: won ? "default" : "grab",
              transform: `translate(${TANK_X - 40}px, ${handleY}px)`,
              transition: dragging ? "none" : "transform 220ms ease",
              touchAction: "none",
            }}
            role="slider"
            tabIndex={0}
            aria-label="Water tap — drag up to fill, down to drain"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                nudge(0.05);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                nudge(-0.05);
              }
            }}
          >
            {/* generous invisible hit pad */}
            <rect x={-18} y={-22} width={56} height={44} fill="transparent" />
            {/* pipe from handle into the tank */}
            <rect x={20} y={-4} width={24} height={8} rx={2} fill="#3a4866" />
            {/* handle knob */}
            <circle
              cx={6}
              cy={0}
              r={15}
              fill="rgba(52,211,153,0.18)"
              stroke={ACCENT}
              strokeWidth={2.5}
              style={{
                filter: dragging ? `drop-shadow(0 0 8px ${ACCENT})` : undefined,
                animation: dragging ? "g3waterlevelalert-lift 0.4s ease" : undefined,
              }}
            />
            <text
              x={6}
              y={1}
              fontSize={16}
              textAnchor="middle"
              dominantBaseline="central"
              aria-hidden="true"
            >
              🚰
            </text>
            {/* up/down nudge hint when idle and not yet in target */}
            {!dragging && !won && !inTarget && (
              <text
                x={6}
                y={-26}
                fontSize={14}
                textAnchor="middle"
                dominantBaseline="central"
                aria-hidden="true"
                style={{ animation: "g3waterlevelalert-nudge 1.2s ease-in-out infinite" }}
              >
                ↕️
              </text>
            )}
          </g>
        </svg>
      </div>

      {/* ── Big up / down nudge controls + Reset ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            nudge(-0.05);
          }}
          disabled={won}
          aria-label="Lower the water a little"
          className="grid h-[60px] w-[64px] place-items-center rounded-2xl text-2xl transition active:scale-90 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">⬇️</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            nudge(0.05);
          }}
          disabled={won}
          aria-label="Raise the water a little"
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#04130d",
            boxShadow: "0 6px 0 0 #15916a",
          }}
        >
          <span aria-hidden="true">⬆️</span>
          <span aria-hidden="true" className="text-xl font-extrabold">
            FILL
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          aria-label="Start over"
          className="grid h-[60px] w-[64px] place-items-center rounded-2xl text-2xl transition active:scale-90"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* tiny coaching line (emoji + few words) */}
      <div className="flex items-center gap-2 text-sm text-ink-dim" aria-hidden="true">
        {won ? (
          <span>Green + yellow lamps on — just right! 💧✨</span>
        ) : overflow ? (
          <span>Too high! Pull the 🚰 down below the 🔴</span>
        ) : inTarget ? (
          <span>Hold it steady in the 🟡 band…</span>
        ) : lit.mid ? (
          <span>Yellow on — stay under the 🔴 red line</span>
        ) : (
          <span>Drag the 🚰 up to the 🟡 yellow line</span>
        )}
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
        @keyframes g3waterlevelalert-wave {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-12px); }
        }
        @keyframes g3waterlevelalert-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(3px); }
        }
        @keyframes g3waterlevelalert-flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes g3waterlevelalert-ring {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-14deg); }
          75% { transform: rotate(14deg); }
        }
        @keyframes g3waterlevelalert-lift {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        @keyframes g3waterlevelalert-nudge {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
