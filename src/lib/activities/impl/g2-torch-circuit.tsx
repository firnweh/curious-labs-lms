"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Torch Light Circuit 🔦 ──────────────────────────────────────────────────
   JUNIOR (Grade 2, age ~7), ROBOTICS. ONE learning goal: a circuit must be a
   complete LOOP, and a switch opens/closes that loop. A board shows a BATTERY
   🔋, a SWITCH and a BULB 💡 joined by wires — but ONE gap is missing. The child
   closes the loop by tapping the parts in order battery → switch → bulb (or by
   tapping the glowing gap to drop in the missing wire). Then a big SWITCH toggle
   flips ON: the bulb lights with a warm glow + rays ONLY when the loop is whole.
   Win = circuit complete AND switched on so the bulb glows → onComplete(once).
   Tapping the wrong part, or flipping the switch with a gap, gives a gentle
   nudge — never a scold. Always winnable, no reading required. ───────────── */

const ACCENT = "#34d399";

/** The three parts the child taps, in the order that closes the loop. */
type PartId = "battery" | "switch" | "bulb";
const ORDER: readonly PartId[] = ["battery", "switch", "bulb"];

interface PartInfo {
  glyph: string;
  word: string;
}
const PARTS: Record<PartId, PartInfo> = {
  battery: { glyph: "🔋", word: "battery" },
  switch: { glyph: "🎚️", word: "switch" },
  bulb: { glyph: "💡", word: "bulb" },
};

// ── Board layout (virtual SVG units; CSS scales it responsively) ──────────
const VW = 320;
const VH = 240;

/** Where each part sits on the rectangular wire loop. */
const POS: Record<PartId, { x: number; y: number }> = {
  battery: { x: 60, y: 190 }, // bottom-left
  bulb: { x: 160, y: 50 }, // top-centre
  switch: { x: 260, y: 190 }, // bottom-right
};

/** The four wire segments of the loop. The bottom segment holds the GAP that
 *  the child must close; the other three are drawn solid from the start. */
const GAP = { x1: 110, y1: 200, x2: 210, y2: 200 } as const;

export default function TorchLightCircuit({ onComplete }: ActivityProps) {
  /** Parts joined so far, in tap order. A full [battery,switch,bulb] = closed loop. */
  const [joined, setJoined] = useState<PartId[]>([]);
  /** Is the big toggle flipped to ON? */
  const [switchedOn, setSwitchedOn] = useState<boolean>(false);
  /** Part id currently wobbling from a wrong tap (gentle, no penalty). */
  const [wobble, setWobble] = useState<PartId | null>(null);
  /** True briefly when the toggle is flipped ON with the loop still open. */
  const [nudgeSwitch, setNudgeSwitch] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const wobbleTimer = useRef<number | null>(null);
  const nudgeTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  /** The loop is closed once all three parts have been joined in order. */
  const loopClosed = joined.length === ORDER.length;
  /** Win: loop closed AND switched on → the bulb glows. */
  const glowing = loopClosed && switchedOn;

  // Report success exactly once, the moment the bulb glows.
  useEffect(() => {
    if (glowing && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail: "Loop closed and switched on — the torch glows! 🔦",
      });
    }
  }, [glowing, onComplete]);

  /** Which part the child should tap next (null once the loop is closed). */
  const nextPart: PartId | null = loopClosed ? null : ORDER[joined.length];

  const tapPart = useCallback(
    (id: PartId) => {
      if (loopClosed) return;
      if (id === nextPart) {
        setJoined((j) => [...j, id]);
        return;
      }
      // Wrong order → gentle wobble, no penalty, no scold.
      setWobble(id);
      if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
      wobbleTimer.current = window.setTimeout(() => setWobble(null), 480);
      onComplete({ passed: false, detail: "Almost! Join the parts in a loop, one at a time." });
    },
    [loopClosed, nextPart, onComplete],
  );

  const flip = useCallback(() => {
    if (glowing) return;
    if (!loopClosed) {
      // Flipping with a gap open: nothing lights — a friendly hint, then settle.
      setNudgeSwitch(true);
      if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
      nudgeTimer.current = window.setTimeout(() => setNudgeSwitch(false), 620);
      onComplete({ passed: false, detail: "No light yet — close the gap in the loop first." });
      return;
    }
    setSwitchedOn((on) => !on);
  }, [glowing, loopClosed, onComplete]);

  const reset = useCallback(() => {
    clearTimers();
    reportedRef.current = false;
    setJoined([]);
    setSwitchedOn(false);
    setWobble(null);
    setNudgeSwitch(false);
  }, [clearTimers]);

  const statusEmoji = useMemo<string>(() => {
    if (glowing) return "🎉";
    if (loopClosed) return "🔌";
    if (joined.length > 0) return "🔧";
    return "🔦";
  }, [glowing, loopClosed, joined.length]);

  const statusLabel = glowing
    ? "The torch is glowing!"
    : loopClosed
      ? "Loop closed — now flip the switch on"
      : nextPart
        ? `Tap the ${PARTS[nextPart].word} to join the loop`
        : "Build the circuit";

  // Is a given part already joined into the loop?
  const isJoined = (id: PartId): boolean => joined.includes(id);

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      <style>{KEYFRAMES}</style>

      {/* ── Tiny visual status (emoji, not paragraphs) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: glowing ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${glowing ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: glowing ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {glowing ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            🔋→💡
          </span>
        )}
        {glowing && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The circuit board ── */}
      <div className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A circuit board with a battery, a switch and a bulb joined by wires, with one gap to close"
        >
          <defs>
            <radialGradient id="g2tc-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde68a" stopOpacity={glowing ? 0.95 : 0} />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* ── Solid wires (the three permanent sides of the loop) ── */}
          {/* battery → bulb (left side, up) */}
          <Wire x1={POS.battery.x} y1={POS.battery.y} x2={POS.bulb.x} y2={POS.bulb.y} live={glowing} />
          {/* bulb → switch (right side, down) */}
          <Wire x1={POS.bulb.x} y1={POS.bulb.y} x2={POS.switch.x} y2={POS.switch.y} live={glowing} />
          {/* switch → gap-end (bottom-right stub) */}
          <Wire x1={POS.switch.x} y1={POS.switch.y} x2={GAP.x2} y2={GAP.y2} live={glowing} />
          {/* battery → gap-start (bottom-left stub) */}
          <Wire x1={POS.battery.x} y1={POS.battery.y} x2={GAP.x1} y2={GAP.y1} live={glowing} />

          {/* ── The GAP segment: dashed + tappable while open, solid once closed ── */}
          {loopClosed ? (
            <line
              x1={GAP.x1}
              y1={GAP.y1}
              x2={GAP.x2}
              y2={GAP.y2}
              stroke={glowing ? "#fde68a" : ACCENT}
              strokeWidth={6}
              strokeLinecap="round"
              style={glowing ? { filter: "drop-shadow(0 0 5px #fde68a)" } : undefined}
            />
          ) : (
            <g
              role="button"
              aria-label="Tap to drop the missing wire into the gap"
              style={{ cursor: "pointer" }}
              onPointerDown={(e) => {
                e.preventDefault();
                // The gap stands in for the LAST part in the loop (the bulb wire).
                // Tapping it only helps once battery + switch are already joined.
                if (joined.length >= 2) tapPart("bulb");
                else if (nextPart) tapPart(nextPart);
              }}
            >
              {/* wide invisible hit area for little fingers */}
              <rect x={GAP.x1 - 8} y={GAP.y1 - 18} width={GAP.x2 - GAP.x1 + 16} height={36} fill="transparent" />
              <line
                x1={GAP.x1}
                y1={GAP.y1}
                x2={GAP.x2}
                y2={GAP.y2}
                stroke={ACCENT}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray="7 9"
                style={{ animation: "g2torchcircuit-flow 0.9s linear infinite" }}
              />
              <text
                x={(GAP.x1 + GAP.x2) / 2}
                y={GAP.y1 + 22}
                fontSize={14}
                textAnchor="middle"
                fill={ACCENT}
                aria-hidden="true"
              >
                gap
              </text>
            </g>
          )}

          {/* ── Warm glow + rays behind the bulb when it lights ── */}
          {glowing && (
            <>
              <circle cx={POS.bulb.x} cy={POS.bulb.y} r={56} fill="url(#g2tc-glow)" />
              <g style={{ transformOrigin: `${POS.bulb.x}px ${POS.bulb.y}px`, animation: "g2torchcircuit-spin 6s linear infinite" }}>
                {Array.from({ length: 8 }).map((_, i) => {
                  const a = (i / 8) * Math.PI * 2;
                  const r1 = 30;
                  const r2 = 42;
                  return (
                    <line
                      key={`ray-${i}`}
                      x1={POS.bulb.x + Math.cos(a) * r1}
                      y1={POS.bulb.y + Math.sin(a) * r1}
                      x2={POS.bulb.x + Math.cos(a) * r2}
                      y2={POS.bulb.y + Math.sin(a) * r2}
                      stroke="#fde68a"
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
            </>
          )}

          {/* ── The three parts, sitting on the loop ── */}
          {ORDER.map((id) => {
            const p = POS[id];
            const done = isJoined(id);
            const isNext = id === nextPart;
            const lit = id === "bulb" && glowing;
            return (
              <g
                key={id}
                role="button"
                aria-label={
                  done
                    ? `${PARTS[id].word}, joined`
                    : isNext
                      ? `Tap the ${PARTS[id].word} to join it next`
                      : `${PARTS[id].word}`
                }
                style={{ cursor: loopClosed ? "default" : "pointer" }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  tapPart(id);
                }}
              >
                <g
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    animation:
                      wobble === id
                        ? "g2torchcircuit-wobble 0.48s ease-in-out"
                        : isNext
                          ? "g2torchcircuit-pulse 1.4s ease-in-out infinite"
                          : lit
                            ? "g2torchcircuit-pop 0.6s ease-out"
                            : undefined,
                  }}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={26}
                    fill={lit ? "rgba(253,230,138,0.22)" : done ? "rgba(52,211,153,0.16)" : "#0b1220"}
                    stroke={lit ? "#fde68a" : done || isNext ? ACCENT : "var(--color-line, #33405c)"}
                    strokeWidth={isNext ? 3 : 2}
                    style={lit ? { filter: "drop-shadow(0 0 8px #fde68a)" } : undefined}
                  />
                  <text
                    x={p.x}
                    y={p.y + 1}
                    fontSize={26}
                    textAnchor="middle"
                    dominantBaseline="central"
                    aria-hidden="true"
                  >
                    {id === "bulb" && lit ? "💡" : PARTS[id].glyph}
                  </text>
                </g>
                {/* a small tick on joined parts */}
                {done && (
                  <text x={p.x + 18} y={p.y - 16} fontSize={16} textAnchor="middle" aria-hidden="true">
                    ✅
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── The big SWITCH toggle ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          flip();
        }}
        aria-label={switchedOn ? "Switch is on. Tap to turn off." : "Switch is off. Tap to turn the torch on."}
        aria-pressed={switchedOn}
        className="flex w-full max-w-[300px] items-center justify-between rounded-2xl px-4 py-3 transition active:scale-95"
        style={{
          touchAction: "none",
          background: glowing ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.05)",
          border: `2px solid ${glowing ? ACCENT : "var(--color-line, #33405c)"}`,
          animation: nudgeSwitch ? "g2torchcircuit-wobble 0.5s ease-in-out" : undefined,
        }}
      >
        <span aria-hidden="true" className="text-2xl">
          {switchedOn ? "🔆" : "🔦"}
        </span>
        {/* the sliding track */}
        <span
          aria-hidden="true"
          className="relative mx-3 inline-block h-9 flex-1 rounded-full"
          style={{
            background: switchedOn ? ACCENT : "rgba(255,255,255,0.10)",
            border: `2px solid ${switchedOn ? ACCENT : "var(--color-line, #33405c)"}`,
            transition: "background 180ms ease",
          }}
        >
          <span
            className="absolute top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-sm"
            style={{
              left: switchedOn ? "calc(100% - 30px)" : "2px",
              background: "#0b1220",
              transition: "left 200ms ease",
            }}
          >
            {switchedOn ? "⚡" : "○"}
          </span>
        </span>
        <span aria-hidden="true" className="text-lg font-extrabold" style={{ color: switchedOn ? "#0b1220" : ACCENT }}>
          {switchedOn ? "ON" : "OFF"}
        </span>
      </button>

      {/* ── Reset ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over"
        className="grid h-[52px] w-[52px] place-items-center rounded-2xl text-2xl transition active:scale-90"
        style={{
          touchAction: "none",
          background: "rgba(255,255,255,0.05)",
          border: "2px solid var(--color-line, #33405c)",
        }}
      >
        <span aria-hidden="true">🔄</span>
      </button>

      {/* celebratory floaters when solved */}
      {glowing && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span style={{ animation: "g2torchcircuit-float 1.6s ease-in-out infinite" }} aria-hidden="true">
            ✨
          </span>
          <span style={{ animation: "g2torchcircuit-float 1.6s ease-in-out 0.2s infinite" }} aria-hidden="true">
            🎉
          </span>
          <span style={{ animation: "g2torchcircuit-float 1.6s ease-in-out 0.4s infinite" }} aria-hidden="true">
            ✨
          </span>
        </div>
      )}
    </div>
  );
}

/** One straight wire segment; turns warm + glows when current flows. */
function Wire({
  x1,
  y1,
  x2,
  y2,
  live,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  live: boolean;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={live ? "#fde68a" : "#4a5a78"}
      strokeWidth={6}
      strokeLinecap="round"
      style={live ? { filter: "drop-shadow(0 0 5px #fde68a)" } : undefined}
    />
  );
}

const KEYFRAMES = `
@keyframes g2torchcircuit-wobble {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-12deg); }
  45% { transform: rotate(10deg); }
  70% { transform: rotate(-6deg); }
  90% { transform: rotate(3deg); }
}
@keyframes g2torchcircuit-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}
@keyframes g2torchcircuit-pop {
  0% { transform: scale(1); }
  45% { transform: scale(1.28); }
  100% { transform: scale(1); }
}
@keyframes g2torchcircuit-flow {
  to { stroke-dashoffset: -16; }
}
@keyframes g2torchcircuit-spin {
  to { transform: rotate(360deg); }
}
@keyframes g2torchcircuit-float {
  0%, 100% { transform: translateY(0); opacity: 0.85; }
  50% { transform: translateY(-8px); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation: none !important; }
}
`;
