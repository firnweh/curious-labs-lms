"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Buzz Wire Game ⚡ ─────────────────────────────────────────────────────────
   JUNIOR (Grade 2, age ~7), ROBOTICS. Concept: touching the wire completes a
   circuit and BUZZES — steady, careful control keeps the circuit OPEN.
   A wavy wire 〰️ runs from START 🟢 to END 🏁. The child drags a glowing RING 💍
   along the wire toward the end. Stay NEAR the wire and the ring slides happily.
   Stray too far (a generous, forgiving tolerance) and the circuit closes: red
   flash, ⚡ "BZZT!", the ring zips back to START — no scolding, always retry.
   Reach the end cleanly → big celebration + onComplete({passed:true,stars:3})
   once. Reset returns to START. Touch-first, pointer-dragged, deterministic,
   and ALWAYS winnable. No reading required — it's all glow and buzz. */

const ACCENT = "#34d399";

// ── Virtual SVG canvas (CSS scales it responsively) ───────────────────────────
const VW = 320;
const VH = 220;
// A forgiving corridor: the ring may wander this far from the wire before buzzing.
const TOLERANCE = 30; // generous for little hands
const RING_R = 16; // big, easy-to-grab handle
// Fraction of the path the ring must reach (near the END pad) to win.
const WIN_T = 0.985;

/** A point in virtual SVG units. */
interface Pt {
  x: number;
  y: number;
}

// ── The wavy wire: one smooth cubic curve from START to END ───────────────────
const START: Pt = { x: 34, y: 174 };
const END: Pt = { x: 286, y: 46 };
const C1: Pt = { x: 96, y: 18 };
const C2: Pt = { x: 224, y: 210 };
const WIRE_D = `M ${START.x} ${START.y} C ${C1.x} ${C1.y}, ${C2.x} ${C2.y}, ${END.x} ${END.y}`;

/** Point on the cubic Bézier at parameter t∈[0,1]. */
function bezier(t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * START.x + b * C1.x + c * C2.x + d * END.x,
    y: a * START.y + b * C1.y + c * C2.y + d * END.y,
  };
}

// Pre-sample the curve so distance + progress checks are deterministic & cheap.
const SAMPLES = 200;
const CURVE: readonly Pt[] = Array.from({ length: SAMPLES + 1 }, (_, i) => bezier(i / SAMPLES));

/** Nearest point on the sampled wire: returns its distance and progress t∈[0,1]. */
function nearestOnWire(p: Pt): { dist: number; t: number } {
  let best = Infinity;
  let bestI = 0;
  for (let i = 0; i < CURVE.length; i++) {
    const dx = p.x - CURVE[i].x;
    const dy = p.y - CURVE[i].y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      bestI = i;
    }
  }
  return { dist: Math.sqrt(best), t: bestI / SAMPLES };
}

type Phase = "ready" | "moving" | "buzz" | "won";

export default function BuzzWire({ onComplete }: ActivityProps) {
  // Ring position (virtual units) + how far along the wire it has travelled.
  const [ring, setRing] = useState<Pt>(START);
  const [progress, setProgress] = useState<number>(0);
  const [best, setBest] = useState<number>(0); // furthest clean progress so far
  const [phase, setPhase] = useState<Phase>("ready");

  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef<boolean>(false);
  const reportedRef = useRef<boolean>(false);
  const buzzTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const won = phase === "won";
  const buzzing = phase === "buzz";

  const clearBuzzTimer = useCallback(() => {
    if (buzzTimer.current !== null) {
      clearTimeout(buzzTimer.current);
      buzzTimer.current = null;
    }
  }, []);
  useEffect(() => () => clearBuzzTimer(), [clearBuzzTimer]);

  const sendHome = useCallback(() => {
    draggingRef.current = false;
    setRing(START);
    setProgress(0);
  }, []);

  /** Convert a pointer event into virtual SVG coordinates. */
  const toLocal = useCallback((e: { clientX: number; clientY: number }): Pt | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * VW,
      y: ((e.clientY - rect.top) / rect.height) * VH,
    };
  }, []);

  const buzz = useCallback(() => {
    clearBuzzTimer();
    draggingRef.current = false;
    setPhase("buzz");
    onComplete({ passed: false, detail: "BZZT! You touched the wire — glide back from START." });
    buzzTimer.current = setTimeout(() => {
      sendHome();
      setPhase("ready");
    }, 620);
  }, [clearBuzzTimer, onComplete, sendHome]);

  const finish = useCallback(() => {
    clearBuzzTimer();
    draggingRef.current = false;
    setRing(END);
    setProgress(1);
    setBest(1);
    setPhase("won");
    if (!reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3, detail: "Steady hands! You reached the end without a buzz. ⚡" });
    }
  }, [clearBuzzTimer, onComplete]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (won || buzzing) return;
      const p = toLocal(e);
      if (!p) return;
      // Only grab when the tap lands on/near the ring (forgiving grab radius).
      const dx = p.x - ring.x;
      const dy = p.y - ring.y;
      if (Math.sqrt(dx * dx + dy * dy) > RING_R * 2.2) return;
      e.preventDefault();
      (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
      draggingRef.current = true;
      setPhase("moving");
    },
    [won, buzzing, ring.x, ring.y, toLocal],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!draggingRef.current || won || buzzing) return;
      const p = toLocal(e);
      if (!p) return;
      const { dist, t } = nearestOnWire(p);
      if (dist > TOLERANCE) {
        buzz();
        return;
      }
      // Snap the ring onto the wire so it always rides the path — feels guided.
      const onWire = CURVE[Math.round(t * SAMPLES)];
      setRing(onWire);
      setProgress(t);
      setBest((b) => (t > b ? t : b));
      if (t >= WIN_T) finish();
    },
    [won, buzzing, toLocal, buzz, finish],
  );

  const endDrag = useCallback(() => {
    if (won || buzzing) return;
    draggingRef.current = false;
    setPhase("ready");
  }, [won, buzzing]);

  const reset = useCallback(() => {
    clearBuzzTimer();
    reportedRef.current = false;
    setBest(0);
    sendHome();
    setPhase("ready");
  }, [clearBuzzTimer, sendHome]);

  const statusEmoji = useMemo<string>(() => {
    if (won) return "🎉";
    if (buzzing) return "⚡";
    if (phase === "moving") return "💍";
    return "👆";
  }, [won, buzzing, phase]);

  const statusLabel = won
    ? "You reached the end with steady hands!"
    : buzzing
      ? "Bzzt! The wire buzzed — gliding back to start"
      : phase === "moving"
        ? "Guiding the ring along the wire"
        : "Press the ring and glide it to the flag";

  const pct = Math.round(best * 100);

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      {/* ── Tiny visual status (emoji, not paragraphs) ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: won
            ? "rgba(52,211,153,0.16)"
            : buzzing
              ? "rgba(248,113,113,0.18)"
              : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : buzzing ? "#f87171" : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {won ? (
          <span aria-hidden="true" className="text-2xl">
            ⭐⭐⭐
          </span>
        ) : buzzing ? (
          <span aria-hidden="true" className="text-xl font-bold" style={{ color: "#f87171" }}>
            BZZT!
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            💍→🏁
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The buzz-wire board ── */}
      <div
        className="panel relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line p-2"
        style={{
          animation: buzzing ? "g2buzzwire-flash 0.6s ease-out" : undefined,
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none", cursor: phase === "moving" ? "grabbing" : "grab" }}
          role="img"
          aria-label="A wavy wire from a green start pad to a checkered finish flag, with a ring to slide along it"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <defs>
            <radialGradient id="g2bw-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Forgiving corridor: a soft wide halo shows the safe zone. */}
          <path
            d={WIRE_D}
            fill="none"
            stroke={buzzing ? "rgba(248,113,113,0.18)" : "rgba(52,211,153,0.12)"}
            strokeWidth={TOLERANCE * 2}
            strokeLinecap="round"
          />

          {/* The wire itself. */}
          <path
            d={WIRE_D}
            fill="none"
            stroke={buzzing ? "#f87171" : ACCENT}
            strokeWidth={5}
            strokeLinecap="round"
            style={{ filter: buzzing ? "drop-shadow(0 0 6px #f87171)" : `drop-shadow(0 0 4px ${ACCENT}88)` }}
          />

          {/* Clean progress trail drawn over the wire so far. */}
          {!buzzing && progress > 0 && (
            <path
              d={WIRE_D}
              fill="none"
              stroke="#fde68a"
              strokeWidth={6}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - progress}
              style={{ filter: "drop-shadow(0 0 5px #fde68a)" }}
            />
          )}

          {/* START pad. */}
          <circle cx={START.x} cy={START.y} r={15} fill="url(#g2bw-glow)" />
          <circle cx={START.x} cy={START.y} r={11} fill="#0b1220" stroke={ACCENT} strokeWidth={2} />
          <text x={START.x} y={START.y + 1} fontSize={13} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
            🟢
          </text>

          {/* END / finish flag. */}
          <circle cx={END.x} cy={END.y} r={16} fill="url(#g2bw-glow)" opacity={won ? 1 : 0.7} />
          <g
            style={{
              transformOrigin: `${END.x}px ${END.y}px`,
              transformBox: "fill-box",
              animation: won ? "g2buzzwire-pop 0.7s ease-out" : undefined,
            }}
          >
            <text x={END.x} y={END.y + 1} fontSize={20} textAnchor="middle" dominantBaseline="central" aria-label="finish flag">
              🏁
            </text>
          </g>

          {/* The draggable RING handle. */}
          <g
            style={{
              transform: `translate(${ring.x}px, ${ring.y}px)`,
              transition: phase === "moving" ? "none" : "transform 220ms ease-out",
            }}
          >
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: buzzing
                  ? "g2buzzwire-wobble 0.5s ease-in-out"
                  : won
                    ? "g2buzzwire-pop 0.6s ease-out"
                    : phase === "ready"
                      ? "g2buzzwire-pulse 1.6s ease-in-out infinite"
                      : undefined,
              }}
            >
              <circle r={RING_R} fill="rgba(11,18,32,0.85)" stroke={buzzing ? "#f87171" : ACCENT} strokeWidth={4} />
              <circle
                r={RING_R - 7}
                fill="none"
                stroke={buzzing ? "#f87171" : ACCENT}
                strokeWidth={2}
                opacity={0.6}
                style={won ? { filter: `drop-shadow(0 0 6px ${ACCENT})` } : undefined}
              />
              <text x={0} y={1} fontSize={16} textAnchor="middle" dominantBaseline="central" aria-label="ring handle">
                {buzzing ? "⚡" : "💍"}
              </text>
            </g>
          </g>
        </svg>

        {/* Tiny progress meter — how far the ring has reached, cleanly. */}
        <div
          className="mt-2 flex items-center gap-2 px-1"
          aria-label={`Progress: ${pct} percent of the way to the flag`}
        >
          <span aria-hidden="true" className="text-base">
            🟢
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: ACCENT,
                boxShadow: `0 0 8px ${ACCENT}`,
              }}
            />
          </div>
          <span aria-hidden="true" className="text-base">
            🏁
          </span>
        </div>
      </div>

      {/* ── Hint line + Reset ── */}
      <div className="flex w-full max-w-[420px] items-stretch gap-2">
        <div
          className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-center text-sm"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "2px dashed var(--color-line, #33405c)",
          }}
          aria-hidden="true"
        >
          {won ? (
            <span style={{ color: ACCENT }}>Steady hands win! ⚡</span>
          ) : (
            <span className="text-ink-dim">Press 💍, then glide it along the wire 〰️</span>
          )}
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          aria-label="Start over"
          className="grid h-[56px] w-[56px] place-items-center rounded-2xl text-2xl transition active:scale-90"
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
        @keyframes g2buzzwire-flash {
          0% { background: rgba(248,113,113,0.35); }
          100% { background: transparent; }
        }
        @keyframes g2buzzwire-wobble {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-14deg) scale(1.1); }
          45% { transform: rotate(12deg) scale(1.1); }
          70% { transform: rotate(-8deg); }
          90% { transform: rotate(5deg); }
        }
        @keyframes g2buzzwire-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @keyframes g2buzzwire-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
