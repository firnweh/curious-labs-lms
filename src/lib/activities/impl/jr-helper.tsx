"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Helper Bot 🦾 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 * ONE learning goal: COMBINE sensing + acting so a robot does a useful job —
 * chain a simple rule. The child builds the rule by tapping two big cards in
 * order: 👀 SEE the toy  →  🤏 GRAB & DROP it in the bin. Then they press GO
 * and the robot arm 🦾 swings over each toy block, grabs it, arcs it into the
 * bin 🗑️ with a satisfying plop. Win when the table is tidy. Always winnable,
 * very forgiving, near-zero reading. Touch-first, big targets, deterministic.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";
const TOY_COUNT = 3;

/** The two halves of the rule the child must chain, in order. */
type RulePart = "see" | "grab";
const RULE_ORDER: readonly RulePart[] = ["see", "grab"];

interface Card {
  id: RulePart;
  glyph: string;
  word: string;
  label: string;
}
const CARDS: readonly Card[] = [
  { id: "see", glyph: "👀", word: "SEE", label: "When the robot SEES a toy" },
  { id: "grab", glyph: "🤏", word: "GRAB", label: "Then GRAB it and drop it in the bin" },
];

const TOY_GLYPHS: readonly string[] = ["🧸", "🟥", "🚗"];

type Phase = "build" | "running" | "won";

/** Per-toy on-screen x positions (SVG units) so the arm has somewhere to go. */
const TOY_X: readonly number[] = [70, 150, 230];
const TABLE_Y = 250;
const BIN_X = 300;
const BIN_Y = 250;
const ARM_BASE_X = 175;
const ARM_BASE_Y = 70;

export default function HelperBot({ onComplete }: ActivityProps) {
  // The rule the child is chaining: an ordered list of tapped parts.
  const [rule, setRule] = useState<RulePart[]>([]);
  const [phase, setPhase] = useState<Phase>("build");
  // Which toys are still on the table (true = still there).
  const [onTable, setOnTable] = useState<boolean[]>(() => Array(TOY_COUNT).fill(true));
  // The toy the arm is currently working on (-1 = none).
  const [active, setActive] = useState<number>(-1);
  // Arm hand target position, animated via CSS transition.
  const [hand, setHand] = useState<{ x: number; y: number }>({ x: ARM_BASE_X, y: ARM_BASE_Y });
  // Whether the hand is holding a toy right now (for the lift/arc visual).
  const [carrying, setCarrying] = useState<number>(-1);
  // Gentle wobble when GO is pressed with the rule not yet built.
  const [wobble, setWobble] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback((): void => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const later = useCallback((fn: () => void, ms: number): void => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  // Rule is correct when both parts are chained in the right order.
  const ruleReady = useMemo<boolean>(
    () => rule.length === RULE_ORDER.length && rule.every((p, i) => p === RULE_ORDER[i]),
    [rule],
  );

  const tidied = useMemo<number>(() => onTable.filter((t) => !t).length, [onTable]);
  const allClear = tidied === TOY_COUNT;

  const tapCard = useCallback(
    (id: RulePart): void => {
      if (phase !== "build") return;
      setRule((prev) => {
        if (prev.includes(id)) return prev; // each part used once
        return [...prev, id];
      });
    },
    [phase],
  );

  const reset = useCallback((): void => {
    clearTimers();
    reportedRef.current = false;
    setRule([]);
    setPhase("build");
    setOnTable(Array(TOY_COUNT).fill(true));
    setActive(-1);
    setCarrying(-1);
    setHand({ x: ARM_BASE_X, y: ARM_BASE_Y });
    setWobble(false);
  }, [clearTimers]);

  // Run the rule: for each toy still on the table, swing → grab → arc → drop.
  const go = useCallback((): void => {
    if (phase !== "build") return;
    if (!ruleReady) {
      // Gentle nudge, no scolding — wobble the rule strip.
      setWobble(true);
      later(() => setWobble(false), 520);
      onComplete({ passed: false, detail: "Chain both cards: 👀 see → 🤏 grab. Try again!" });
      return;
    }

    setPhase("running");
    const STEP = 700; // time per sub-move

    // Build a flat schedule of moves over the toys that are present.
    const order = onTable
      .map((present, i) => (present ? i : -1))
      .filter((i) => i >= 0);

    let clock = 0;
    order.forEach((toy) => {
      // 1) swing the hand over the toy
      later(() => {
        setActive(toy);
        setHand({ x: TOY_X[toy], y: TABLE_Y - 40 });
      }, clock);
      // 2) reach down + grab
      later(() => {
        setHand({ x: TOY_X[toy], y: TABLE_Y - 8 });
        setCarrying(toy);
      }, clock + STEP);
      // 3) lift up
      later(() => {
        setHand({ x: TOY_X[toy], y: TABLE_Y - 90 });
      }, clock + STEP * 1.5);
      // 4) arc over to the bin + drop (plop)
      later(() => {
        setHand({ x: BIN_X, y: BIN_Y - 70 });
      }, clock + STEP * 2);
      later(() => {
        setCarrying(-1);
        setOnTable((prev) => {
          const next = [...prev];
          next[toy] = false;
          return next;
        });
      }, clock + STEP * 2.6);
      clock += STEP * 3;
    });

    // 5) return home + celebrate
    later(() => {
      setActive(-1);
      setHand({ x: ARM_BASE_X, y: ARM_BASE_Y });
      setPhase("won");
    }, clock + 200);
  }, [phase, ruleReady, onTable, later, onComplete]);

  // Fire success exactly once when the table is clear.
  useEffect(() => {
    if (phase === "won" && allClear && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({ passed: true, stars: 3, detail: "The table is tidy! 🎉" });
    }
  }, [phase, allClear, onComplete]);

  const running = phase === "running";
  const won = phase === "won";

  const statusEmoji = won ? "🎉" : running ? "🦾" : ruleReady ? "👍" : "🤖";

  // Geometry for the arm "bone" from base to hand.
  const armDx = hand.x - ARM_BASE_X;
  const armDy = hand.y - ARM_BASE_Y;
  const armLen = Math.hypot(armDx, armDy);
  const armAngle = (Math.atan2(armDy, armDx) * 180) / Math.PI;

  return (
    <div className="flex w-full flex-col items-center gap-3" style={{ maxWidth: 430 }}>
      {/* ── Tiny emoji status — no paragraphs to read ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "The table is tidy"
            : running
              ? "The robot is tidying up"
              : ruleReady
                ? "Rule ready, press Go"
                : "Tap the cards to make the rule"
        }
        style={{
          background: won ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>
        {won ? (
          <span aria-hidden="true" className="jrhelper-stars text-2xl">
            <span style={{ animationDelay: "0s" }}>⭐</span>
            <span style={{ animationDelay: "0.18s" }}>⭐</span>
            <span style={{ animationDelay: "0.36s" }}>⭐</span>
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl">
            🧸→🗑️
          </span>
        )}
      </div>

      {/* ── The robot + table scene ── */}
      <div
        className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2"
        style={{
          background: won
            ? "radial-gradient(circle at 50% 40%, rgba(52,211,153,0.18), transparent 64%)"
            : undefined,
          transition: "background 400ms ease",
        }}
      >
        <svg
          viewBox="0 0 350 300"
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A robot arm above a table with toy blocks and a bin. It grabs each toy and drops it in the bin."
        >
          <defs>
            <radialGradient id="jh-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.22" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* soft halo when finished */}
          {won && (
            <circle cx="175" cy="150" r="150" fill="url(#jh-halo)">
              <animate attributeName="r" values="135;160;135" dur="2.4s" repeatCount="indefinite" />
            </circle>
          )}

          {/* ── table top ── */}
          <rect x="20" y={TABLE_Y} width="230" height="14" rx="7" fill="#1b2436" stroke="#3a4866" strokeWidth="2" />
          {/* ── the bin ── */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: carrying === -1 && running ? "jrhelper-plop 0.5s ease" : undefined,
            }}
          >
            <rect x={BIN_X - 26} y={BIN_Y - 36} width="52" height="56" rx="9" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" />
            <text x={BIN_X} y={BIN_Y - 2} textAnchor="middle" dominantBaseline="central" fontSize="30" style={{ pointerEvents: "none" }}>
              🗑️
            </text>
          </g>

          {/* ── ceiling rail + arm base ── */}
          <rect x="40" y="40" width="270" height="12" rx="6" fill="#1b2436" stroke="#3a4866" strokeWidth="2" />
          <circle cx={ARM_BASE_X} cy={ARM_BASE_Y} r="12" fill="#0f2a22" stroke={ACCENT} strokeWidth="3" />

          {/* ── the arm bone (rotates/stretches from base to hand) ── */}
          <g
            style={{
              transform: `translate(${ARM_BASE_X}px, ${ARM_BASE_Y}px) rotate(${armAngle}deg)`,
              transition: running ? "transform 600ms cubic-bezier(.34,1.4,.64,1)" : "transform 300ms ease",
            }}
          >
            <rect x="0" y="-6" width={Math.max(armLen, 4)} height="12" rx="6" fill="#0f2a22" stroke={ACCENT} strokeWidth="2.5" />
          </g>

          {/* ── the hand 🦾 (springs to its target) ── */}
          <g
            style={{
              transform: `translate(${hand.x}px, ${hand.y}px)`,
              transition: running ? "transform 600ms cubic-bezier(.34,1.4,.64,1)" : "transform 300ms ease",
            }}
          >
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation:
                  phase === "build"
                    ? "jrhelper-bob 2.6s ease-in-out infinite"
                    : carrying >= 0
                      ? "jrhelper-grip 0.4s ease"
                      : undefined,
              }}
            >
              <circle r="20" fill="#0b1220" stroke={ACCENT} strokeWidth="2.5" />
              <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fontSize="26" style={{ pointerEvents: "none" }}>
                🦾
              </text>
              {/* carried toy rides under the hand */}
              {carrying >= 0 && (
                <text x="0" y="26" textAnchor="middle" dominantBaseline="central" fontSize="24" style={{ pointerEvents: "none" }}>
                  {TOY_GLYPHS[carrying]}
                </text>
              )}
            </g>
          </g>

          {/* ── toys on the table ── */}
          {onTable.map((present, i) => {
            if (!present || carrying === i) return null;
            const looking = active === i && running && carrying === -1;
            return (
              <g
                key={`toy-${i}`}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation:
                    phase === "build"
                      ? `jrhelper-bob ${2.4 + i * 0.3}s ease-in-out infinite`
                      : looking
                        ? "jrhelper-spot 0.5s ease"
                        : undefined,
                }}
              >
                {/* a little "seen!" sensor glow */}
                {looking && (
                  <circle cx={TOY_X[i]} cy={TABLE_Y - 16} r="22" fill="none" stroke={ACCENT} strokeWidth="3">
                    <animate attributeName="r" values="14;26;14" dur="0.6s" repeatCount="1" />
                    <animate attributeName="opacity" values="0.9;0;0.9" dur="0.6s" repeatCount="1" />
                  </circle>
                )}
                <text
                  x={TOY_X[i]}
                  y={TABLE_Y - 14}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="30"
                  style={{ pointerEvents: "none" }}
                  aria-label={`toy ${i + 1}`}
                >
                  {TOY_GLYPHS[i]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* progress dots — how many toys are tidy */}
        <div className="mt-1 flex items-center justify-center gap-1 text-lg" aria-hidden="true">
          {onTable.map((present, i) => (
            <span key={`dot-${i}`}>{present ? "⚪" : "🟢"}</span>
          ))}
        </div>

        {/* celebration burst */}
        {won && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={`spark-${i}`}
                className="jrhelper-confetti"
                style={{
                  left: "50%",
                  top: "42%",
                  // spread the burst out radially
                  ["--dx" as string]: `${Math.round(Math.cos((i / 12) * Math.PI * 2) * 130)}px`,
                  ["--dy" as string]: `${Math.round(Math.sin((i / 12) * Math.PI * 2) * 130)}px`,
                  animationDelay: `${(i % 4) * 0.05}s`,
                }}
              >
                {["✨", "🎉", "⭐", "💚"][i % 4]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── The RULE: chain SEE → GRAB ── */}
      <div
        className="flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
          animation: wobble ? "jrhelper-wobble 0.5s ease-in-out" : undefined,
        }}
        aria-label="Your rule, in order"
      >
        {RULE_ORDER.map((part, i) => {
          const done = rule[i] === part;
          const card = CARDS.find((c) => c.id === part)!;
          return (
            <div key={part} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden="true" className="text-2xl" style={{ color: ACCENT }}>→</span>}
              <div
                className="grid h-[56px] w-[56px] place-items-center rounded-xl text-3xl"
                style={{
                  background: done ? "rgba(52,211,153,0.16)" : "rgba(11,16,32,0.55)",
                  border: `2px ${done ? "solid" : "dashed"} ${done ? ACCENT : "#3a4566"}`,
                  animation: done ? "jrhelper-snap 0.42s cubic-bezier(.34,1.56,.64,1)" : undefined,
                }}
                aria-label={done ? card.label : `Empty slot ${i + 1}`}
              >
                <span aria-hidden="true">{done ? card.glyph : "❔"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── The two big rule cards to tap ── */}
      <div className="flex w-full items-stretch justify-center gap-3">
        {CARDS.map((card) => {
          const used = rule.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                tapCard(card.id);
              }}
              disabled={phase !== "build" || used}
              aria-label={card.label}
              className="jrhelper-press flex min-h-[78px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 text-3xl font-bold transition disabled:opacity-50"
              style={{
                touchAction: "none",
                background: used ? "rgba(52,211,153,0.10)" : "rgba(52,211,153,0.16)",
                border: `3px solid ${ACCENT}`,
                color: ACCENT,
                boxShadow: used ? "none" : `0 6px 0 0 #128a5f`,
              }}
            >
              <span aria-hidden="true">{card.glyph}</span>
              <span aria-hidden="true" className="text-base font-extrabold tracking-wide">
                {card.word}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── GO + Reset ── */}
      <div className="flex w-full items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            go();
          }}
          disabled={running || won}
          aria-label="Go — run the rule and tidy the toys"
          className="flex h-[64px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#060810",
            boxShadow: "0 6px 0 0 #128a5f",
          }}
        >
          <span aria-hidden="true">{running ? "🦾" : "▶"}</span>
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
          className="grid h-[64px] w-[64px] place-items-center rounded-2xl text-2xl transition active:scale-90 disabled:opacity-40"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      <style>{`
        @keyframes jrhelper-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes jrhelper-grip {
          0% { transform: scale(1); }
          45% { transform: scale(0.82); }
          100% { transform: scale(1); }
        }
        @keyframes jrhelper-spot {
          0% { transform: scale(1); }
          40% { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
        @keyframes jrhelper-plop {
          0% { transform: scale(1); }
          40% { transform: scale(1.12, 0.9); }
          70% { transform: scale(0.96, 1.06); }
          100% { transform: scale(1); }
        }
        @keyframes jrhelper-snap {
          0% { transform: scale(0.5); opacity: 0.3; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes jrhelper-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          60% { transform: rotate(2.5deg); }
          85% { transform: rotate(-1.5deg); }
        }
        @keyframes jrhelper-press-pop {
          0% { transform: scale(0.9); }
          60% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        .jrhelper-press:active:not(:disabled) {
          animation: jrhelper-press-pop 0.3s cubic-bezier(.34,1.56,.64,1);
        }
        .jrhelper-stars span {
          display: inline-block;
          animation: jrhelper-snap 0.5s cubic-bezier(.34,1.56,.64,1) both;
        }
        .jrhelper-confetti {
          position: absolute;
          font-size: 20px;
          animation: jrhelper-burst 1s ease-out forwards;
        }
        @keyframes jrhelper-burst {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jrhelper-press:active:not(:disabled),
          .jrhelper-stars span,
          .jrhelper-confetti {
            animation: none !important;
          }
          [style*="jrhelper-bob"], [style*="jrhelper-spot"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
