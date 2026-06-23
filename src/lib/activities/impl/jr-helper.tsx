"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Helper Bot 🦾 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 * ONE learning goal: PROGRAM a robot by chaining sensing + acting steps in the
 * RIGHT ORDER — now a real problem to plan, not a two-tap toy. Across THREE
 * rounds the child builds the robot's rule from a PALETTE of big cards that
 * holds the right steps AND a tempting wrong one (a 😴 / 🦶 decoy). Brute force
 * fails: each round needs a different, longer chain, the cards must go in order,
 * and ROUND 3 hands the child a BROKEN rule (already filled in, but scrambled)
 * to FIX — so they must reason about what comes first, not just tap everything.
 *   • R1  👀 SEE → 🤏 GRAB → 🗑️ DROP            (learn the whole chain; decoy 😴)
 *   • R2  👀 SEE → 🤏 GRAB → 🧼 WASH → 🗑️ DROP   (a new step in the middle; decoy 🦶)
 *   • R3  the slots arrive pre-filled but JUMBLED — tap to clear, rebuild right.
 * Build the chain → press GO → the arm 🦾 swings over each toy, grabs it,
 * (washes it,) arcs it into the bin 🗑️ with a plop. Solve all three → big
 * celebration, ⭐⭐⭐, onComplete once. A wrong/short chain → gentle wobble, the
 * slots empty, try again — never a scold. Always winnable, near-zero reading.
 * Touch-first, big targets, deterministic. Preserves every bit of the polish.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";
const TOY_COUNT = 3;

/** Every step the robot can perform. WASH is a real step in later rounds;
 *  SLEEP and KICK are decoys that look fun but never belong in the rule. */
type StepId = "see" | "grab" | "wash" | "drop" | "sleep" | "kick";

interface StepCard {
  id: StepId;
  glyph: string;
  /** A tiny word for sighted readers; never required to read (emoji carries it). */
  word: string;
  label: string;
}

const STEP_CARDS: Readonly<Record<StepId, StepCard>> = {
  see: { id: "see", glyph: "👀", word: "SEE", label: "When the robot SEES a toy" },
  grab: { id: "grab", glyph: "🤏", word: "GRAB", label: "Then GRAB the toy" },
  wash: { id: "wash", glyph: "🧼", word: "WASH", label: "Then WASH the toy clean" },
  drop: { id: "drop", glyph: "🗑️", word: "DROP", label: "Then DROP it in the bin" },
  sleep: { id: "sleep", glyph: "😴", word: "NAP", label: "Take a nap (not a tidy step)" },
  kick: { id: "kick", glyph: "🦶", word: "KICK", label: "Kick the toy (not a tidy step)" },
};

const TOY_GLYPHS: readonly string[] = ["🧸", "🟥", "🚗"];

/** One round of the puzzle.
 *  - answer:  the correct ordered chain the child must build.
 *  - palette: the cards offered (answer steps + a decoy), in tap-display order.
 *  - wash:    does this round need the toys washed before the bin? (visual + timing)
 *  - preset:  if set, the slots START filled with this (scrambled) chain to FIX. */
interface Round {
  answer: readonly StepId[];
  palette: readonly StepId[];
  wash: boolean;
  preset?: readonly StepId[];
}

const ROUNDS: readonly Round[] = [
  // R1 — learn the whole chain; a sleepy decoy sits in the palette.
  {
    answer: ["see", "grab", "drop"],
    palette: ["grab", "see", "sleep", "drop"],
    wash: false,
  },
  // R2 — toys are grubby: a WASH step must slot into the MIDDLE. New decoy.
  {
    answer: ["see", "grab", "wash", "drop"],
    palette: ["wash", "drop", "see", "kick", "grab"],
    wash: true,
  },
  // R3 — DEBUG: the rule arrives already filled but JUMBLED. Fix the order.
  {
    answer: ["see", "grab", "wash", "drop"],
    palette: ["see", "grab", "wash", "drop"],
    wash: true,
    preset: ["wash", "see", "drop", "grab"], // wrong on purpose — child must repair it
  },
];

type Phase = "build" | "running" | "solved" | "won";

/** Per-toy on-screen x positions (SVG units) so the arm has somewhere to go. */
const TOY_X: readonly number[] = [70, 150, 230];
const TABLE_Y = 250;
const BIN_X = 300;
const BIN_Y = 250;
const WASH_X = 175; // a little wash station the arm dips through in wash rounds
const ARM_BASE_X = 175;
const ARM_BASE_Y = 70;

export default function HelperBot({ onComplete }: ActivityProps) {
  const [level, setLevel] = useState<number>(0);
  const round = ROUNDS[level];

  // The rule the child is chaining: an ordered list of tapped step ids.
  const [rule, setRule] = useState<StepId[]>(() => [...(ROUNDS[0].preset ?? [])]);
  const [phase, setPhase] = useState<Phase>("build");
  // Which toys are still on the table (true = still there).
  const [onTable, setOnTable] = useState<boolean[]>(() => Array(TOY_COUNT).fill(true));
  // The toy the arm is currently working on (-1 = none).
  const [active, setActive] = useState<number>(-1);
  // Arm hand target position, animated via CSS transition.
  const [hand, setHand] = useState<{ x: number; y: number }>({ x: ARM_BASE_X, y: ARM_BASE_Y });
  // Whether the hand is holding a toy right now (for the lift/arc visual).
  const [carrying, setCarrying] = useState<number>(-1);
  // Whether the carried toy is sudsy (wash rounds) for a sparkly clean visual.
  const [washing, setWashing] = useState<boolean>(false);
  // Gentle wobble when GO is pressed with the rule wrong/short.
  const [wobble, setWobble] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const timers = useRef<number[]>([]);
  const audioRef = useRef<AudioContext | null>(null);

  const clearTimers = useCallback((): void => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const later = useCallback((fn: () => void, ms: number): void => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  // ── Soft optional sound, made on the user's gesture; never throws/blocks. ──
  const blip = useCallback((freq: number, dur: number): void => {
    try {
      type WinAudio = typeof AudioContext;
      const w = window as unknown as { webkitAudioContext?: WinAudio };
      const Ctx: WinAudio | undefined = window.AudioContext ?? w.webkitAudioContext;
      if (!Ctx) return;
      const ac = audioRef.current ?? new Ctx();
      audioRef.current = ac;
      if (ac.state === "suspended") void ac.resume();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, ac.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur + 0.02);
    } catch {
      /* sound is a nicety — silently ignore any failure */
    }
  }, []);

  const chime = useCallback((): void => {
    [523, 659, 784, 1046].forEach((f, i) => {
      window.setTimeout(() => blip(f, 0.18), i * 120);
    });
  }, [blip]);

  // Fresh round: park the arm, reset toys, seed the slots (empty, or the broken preset to fix).
  useEffect(() => {
    clearTimers();
    setRule([...(ROUNDS[level].preset ?? [])]);
    setPhase("build");
    setOnTable(Array(TOY_COUNT).fill(true));
    setActive(-1);
    setCarrying(-1);
    setWashing(false);
    setHand({ x: ARM_BASE_X, y: ARM_BASE_Y });
    setWobble(false);
  }, [level, clearTimers]);

  // Rule is correct when it exactly matches this round's answer, in order.
  const ruleReady = useMemo<boolean>(
    () =>
      rule.length === round.answer.length && rule.every((p, i) => p === round.answer[i]),
    [rule, round.answer],
  );

  const tidied = useMemo<number>(() => onTable.filter((t) => !t).length, [onTable]);
  const allClear = tidied === TOY_COUNT;

  // Tap a palette card → append it to the chain (used at most once each).
  const tapCard = useCallback(
    (id: StepId): void => {
      if (phase !== "build") return;
      blip(660, 0.07);
      setRule((prev) => {
        if (prev.includes(id)) return prev;
        if (prev.length >= round.palette.length) return prev;
        return [...prev, id];
      });
    },
    [phase, round.palette.length, blip],
  );

  // Tap a filled slot → pull that card (and everything after it) back out, so the
  // child can repair the order. This is how the round-3 "fix the broken rule" works.
  const pullFromSlot = useCallback(
    (index: number): void => {
      if (phase !== "build") return;
      blip(420, 0.06);
      setRule((prev) => prev.slice(0, index));
    },
    [phase, blip],
  );

  const clearRule = useCallback((): void => {
    if (phase !== "build") return;
    blip(380, 0.07);
    setRule([]);
  }, [phase, blip]);

  const reset = useCallback((): void => {
    clearTimers();
    reportedRef.current = false;
    setLevel(0);
    setRule([...(ROUNDS[0].preset ?? [])]);
    setPhase("build");
    setOnTable(Array(TOY_COUNT).fill(true));
    setActive(-1);
    setCarrying(-1);
    setWashing(false);
    setHand({ x: ARM_BASE_X, y: ARM_BASE_Y });
    setWobble(false);
  }, [clearTimers]);

  // Run the rule: for each toy still on the table, swing → grab →(wash)→ arc → drop.
  const go = useCallback((): void => {
    if (phase !== "build") return;
    if (!ruleReady) {
      // Gentle nudge, no scolding — wobble the rule strip and empty the slots to retry.
      setWobble(true);
      blip(200, 0.16);
      later(() => setWobble(false), 520);
      later(() => setRule([...(round.preset ?? [])]), 560);
      return; // never spam onComplete(passed:false)
    }

    setPhase("running");
    blip(523, 0.1);
    const STEP = 640; // time per sub-move
    const doWash = round.wash;

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
        blip(700, 0.06);
      }, clock + STEP);
      // 3) lift up
      later(() => {
        setHand({ x: TOY_X[toy], y: TABLE_Y - 90 });
      }, clock + STEP * 1.5);

      if (doWash) {
        // 3b) dip through the wash station — suds sparkle on
        later(() => {
          setHand({ x: WASH_X, y: TABLE_Y - 120 });
          setWashing(true);
          blip(880, 0.07);
        }, clock + STEP * 2);
        later(() => setWashing(false), clock + STEP * 2.9);
        // 4) arc to bin + drop
        later(() => {
          setHand({ x: BIN_X, y: BIN_Y - 70 });
        }, clock + STEP * 3);
        later(() => {
          setCarrying(-1);
          blip(440, 0.1);
          setOnTable((prev) => {
            const next = [...prev];
            next[toy] = false;
            return next;
          });
        }, clock + STEP * 3.6);
        clock += STEP * 4;
      } else {
        // 4) arc straight to bin + drop
        later(() => {
          setHand({ x: BIN_X, y: BIN_Y - 70 });
        }, clock + STEP * 2);
        later(() => {
          setCarrying(-1);
          blip(440, 0.1);
          setOnTable((prev) => {
            const next = [...prev];
            next[toy] = false;
            return next;
          });
        }, clock + STEP * 2.6);
        clock += STEP * 3;
      }
    });

    // 5) return home, then mark the round solved
    later(() => {
      setActive(-1);
      setWashing(false);
      setHand({ x: ARM_BASE_X, y: ARM_BASE_Y });
      setPhase("solved");
    }, clock + 200);
  }, [phase, ruleReady, round.wash, round.preset, onTable, later, blip]);

  // When a round's table is clear: either advance, or (last round) finish for good.
  useEffect(() => {
    if (phase !== "solved" || !allClear) return;
    const last = level >= ROUNDS.length - 1;
    chime();
    if (last) {
      setPhase("won");
      if (!reportedRef.current) {
        reportedRef.current = true;
        onComplete({ passed: true, stars: 3, detail: "You programmed all three! 🤖🎉" });
      }
    } else {
      // Win this round, then slide the next (harder) puzzle in.
      const t = window.setTimeout(() => setLevel((l) => l + 1), 1150);
      timers.current.push(t);
    }
  }, [phase, allClear, level, chime, onComplete]);

  const running = phase === "running";
  const solved = phase === "solved";
  const won = phase === "won";
  const celebrating = solved || won;

  const statusEmoji = won ? "🏆" : solved ? "🎉" : running ? "🦾" : ruleReady ? "👍" : "🤖";

  // Geometry for the arm "bone" from base to hand.
  const armDx = hand.x - ARM_BASE_X;
  const armDy = hand.y - ARM_BASE_Y;
  const armLen = Math.hypot(armDx, armDy);
  const armAngle = (Math.atan2(armDy, armDx) * 180) / Math.PI;

  return (
    <div className="flex w-full flex-col items-center gap-3" style={{ maxWidth: 430 }}>
      {/* ── Tiny emoji status + round dots — no paragraphs to read ── */}
      <div
        className="flex items-center gap-3 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "You solved all three rounds!"
            : solved
              ? "Round solved! Next one coming up"
              : running
                ? "The robot is tidying up"
                : ruleReady
                  ? `Round ${level + 1} of 3 — rule ready, press Go`
                  : `Round ${level + 1} of 3 — put the steps in order`
        }
        style={{
          background: celebrating ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${celebrating ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: celebrating ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            animation: celebrating ? "jrhelper-cheer 0.7s cubic-bezier(.34,1.56,.64,1) infinite" : undefined,
          }}
        >
          {statusEmoji}
        </span>

        {/* round progress: solved ● / current ◉ / upcoming ○ */}
        <span aria-hidden="true" className="inline-flex items-center gap-1.5">
          {ROUNDS.map((_, i) => {
            const isSolved = i < level || won;
            const current = i === level && !won;
            return (
              <span
                key={i}
                className="grid place-items-center rounded-full"
                style={{
                  height: 14,
                  width: 14,
                  background: isSolved ? ACCENT : current ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.06)",
                  border: `2px solid ${isSolved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                  animation: current ? "jrhelper-ready 1.5s ease-in-out infinite" : undefined,
                }}
              />
            );
          })}
        </span>

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
          background: celebrating
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

          {/* ── wash station (only in wash rounds) ── */}
          {round.wash && (
            <g aria-hidden="true">
              <rect x={WASH_X - 26} y={TABLE_Y - 150} width="52" height="30" rx="9" fill="#0f2233" stroke="#3a7fbf" strokeWidth="2.5" />
              <text x={WASH_X} y={TABLE_Y - 135} textAnchor="middle" dominantBaseline="central" fontSize="22" style={{ pointerEvents: "none" }}>
                🚿
              </text>
            </g>
          )}

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
              transition: running ? "transform 560ms cubic-bezier(.34,1.4,.64,1)" : "transform 300ms ease",
            }}
          >
            <rect x="0" y="-6" width={Math.max(armLen, 4)} height="12" rx="6" fill="#0f2a22" stroke={ACCENT} strokeWidth="2.5" />
          </g>

          {/* ── the hand 🦾 (springs to its target) ── */}
          <g
            style={{
              transform: `translate(${hand.x}px, ${hand.y}px)`,
              transition: running ? "transform 560ms cubic-bezier(.34,1.4,.64,1)" : "transform 300ms ease",
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
              {/* sudsy sparkles while passing the wash station */}
              {washing && carrying >= 0 && (
                <text
                  x="0"
                  y="26"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="24"
                  style={{ pointerEvents: "none", animation: "jrhelper-suds 0.6s ease-in-out infinite" }}
                >
                  ✨
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

        {/* celebration burst (final win only) */}
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

      {/* ── The RULE strip: ordered slots the child fills (tap a slot to pull it out) ── */}
      <div
        className="flex w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px dashed var(--color-line, #33405c)",
          animation: wobble ? "jrhelper-wobble 0.5s ease-in-out" : undefined,
        }}
        aria-label="Your rule, in order — tap a step to take it back"
      >
        {Array.from({ length: round.answer.length }).map((_, i) => {
          const filledId = rule[i];
          const card = filledId ? STEP_CARDS[filledId] : null;
          return (
            <div key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden="true" className="text-2xl" style={{ color: ACCENT }}>
                  →
                </span>
              )}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (card) pullFromSlot(i);
                }}
                disabled={phase !== "build" || !card}
                aria-label={card ? `${card.label} — tap to take it back` : `Empty slot ${i + 1}`}
                className="grid h-[52px] w-[52px] place-items-center rounded-xl text-3xl transition active:scale-90 disabled:active:scale-100"
                style={{
                  touchAction: "none",
                  background: card ? "rgba(52,211,153,0.16)" : "rgba(11,16,32,0.55)",
                  border: `2px ${card ? "solid" : "dashed"} ${card ? ACCENT : "#3a4566"}`,
                  animation: card ? "jrhelper-snap 0.42s cubic-bezier(.34,1.56,.64,1)" : undefined,
                }}
              >
                <span aria-hidden="true">{card ? card.glyph : "❔"}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* ── The step palette: tap to add (holds the right steps AND a decoy) ── */}
      <div className="flex w-full flex-wrap items-stretch justify-center gap-2">
        {round.palette.map((id) => {
          const card = STEP_CARDS[id];
          const used = rule.includes(id);
          return (
            <button
              key={id}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                tapCard(id);
              }}
              disabled={phase !== "build" || used}
              aria-label={card.label}
              className="jrhelper-press flex min-h-[74px] min-w-[72px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-2 text-3xl font-bold transition disabled:opacity-45"
              style={{
                touchAction: "none",
                background: used ? "rgba(52,211,153,0.08)" : "rgba(52,211,153,0.16)",
                border: `3px solid ${ACCENT}`,
                color: ACCENT,
                boxShadow: used ? "none" : `0 6px 0 0 #128a5f`,
              }}
            >
              <span aria-hidden="true">{card.glyph}</span>
              <span aria-hidden="true" className="text-sm font-extrabold tracking-wide">
                {card.word}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── GO + clear + Reset ── */}
      <div className="flex w-full items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            go();
          }}
          disabled={running || celebrating}
          aria-label="Go — run the rule and tidy the toys"
          className="flex h-[64px] flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50"
          style={{
            touchAction: "none",
            background: ACCENT,
            color: "#060810",
            boxShadow: "0 6px 0 0 #128a5f",
            animation: !running && !celebrating && ruleReady ? "jrhelper-ready 1.5s ease-in-out infinite" : undefined,
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
            clearRule();
          }}
          disabled={phase !== "build" || rule.length === 0}
          aria-label="Empty the rule and start the chain again"
          className="grid h-[64px] w-[60px] place-items-center rounded-2xl text-2xl transition active:scale-90 disabled:opacity-30"
          style={{
            touchAction: "none",
            background: "rgba(255,255,255,0.05)",
            border: "2px solid var(--color-line, #33405c)",
          }}
        >
          <span aria-hidden="true">🧹</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          disabled={running}
          aria-label="Start over from round one"
          className="grid h-[64px] w-[60px] place-items-center rounded-2xl text-2xl transition active:scale-90 disabled:opacity-40"
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
        @keyframes jrhelper-suds {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.95; }
          50% { transform: translateY(-4px) scale(1.2); opacity: 0.55; }
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
        /* current-round dot + ready GO gently pulse */
        @keyframes jrhelper-ready {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        /* bot dances on a win — little hop + happy tilt */
        @keyframes jrhelper-cheer {
          0% { transform: translateY(0) rotate(0deg) scale(1); }
          30% { transform: translateY(-8px) rotate(-9deg) scale(1.14); }
          55% { transform: translateY(-3px) rotate(8deg) scale(1.08); }
          80% { transform: translateY(-6px) rotate(-5deg) scale(1.12); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
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
          [style*="infinite"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
