"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Build-a-Bot 🤖 — a JUNIOR (Class 1-3, age ~6-8) ROBOTICS lab.
 *
 * Old version: drop six parts into six obvious slots — solvable by poking every
 * slot until something snaps. Now it is a real PROBLEM across THREE rounds:
 * a BLUEPRINT robot 📋 glows at the top, each part painted a COLOUR. The child
 * must build a robot whose every part matches the blueprint's colour, slot by
 * slot. The shapes still only fit their own kind of socket, but the tray now
 * holds the SAME shape in several colours — so you must LOOK at the plan, find
 * the right-coloured part, and place it. A wrong-colour part → a gentle wobble.
 *
 * Escalation:           R1 one colour (learn to read the plan)
 *                       R2 mixed colours (must check each slot)
 *  guess-defeating R3 → the blueprint is MIRRORED 🪞: the arm/leg on the plan's
 *                       LEFT belongs on the robot's RIGHT (and the ghost
 *                       outlines vanish) — so copying by position fails and the
 *                       child has to reason about the flip.
 *
 * Build all three robots → each wakes up, ⭐⭐⭐ pop in, confetti, onComplete
 * fires exactly once. Deterministic, always winnable, never scolds, near-zero
 * reading — colour, shape, emoji, animation carry everything.
 * ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";

/** The kind of body part — picks the SHAPE / which socket it fits. */
type PartKind = "head" | "body" | "arm" | "leg";
/** Which physical slot on the silhouette. Left/right matter for the mirror. */
type SlotId = "head" | "body" | "armL" | "armR" | "legL" | "legR";

/** Hand-authored colours: distinct hue, name only used for aria + matching. */
interface Paint {
  id: string;
  fill: string; // dark backing for the part body
  stroke: string; // bright outline / glow colour
  dot: string; // a colour pip the child can match by eye
  name: string;
}
const PAINTS: Record<string, Paint> = {
  green: { id: "green", fill: "#0f2a22", stroke: "#34d399", dot: "#34d399", name: "green" },
  blue: { id: "blue", fill: "#10243a", stroke: "#38bdf8", dot: "#38bdf8", name: "blue" },
  amber: { id: "amber", fill: "#2e2410", stroke: "#fbbf24", dot: "#fbbf24", name: "yellow" },
  pink: { id: "pink", fill: "#2e1322", stroke: "#f472b6", dot: "#f472b6", name: "pink" },
};

const kindOf = (s: SlotId): PartKind =>
  s === "head" ? "head" : s === "body" ? "body" : s.startsWith("arm") ? "arm" : "leg";

/** Static geometry of each slot on the robot silhouette. */
interface SlotGeo {
  id: SlotId;
  x: number;
  y: number;
  r: number;
  ghost: string;
}
const SLOTS: readonly SlotGeo[] = [
  { id: "head", x: 150, y: 66, r: 40, ghost: "🤖" },
  { id: "body", x: 150, y: 178, r: 46, ghost: "🟩" },
  { id: "armL", x: 64, y: 170, r: 28, ghost: "🦾" },
  { id: "armR", x: 236, y: 170, r: 28, ghost: "💪" },
  { id: "legL", x: 116, y: 290, r: 28, ghost: "🦵" },
  { id: "legR", x: 184, y: 290, r: 28, ghost: "🦿" },
];
const slotGeo = (id: SlotId): SlotGeo => SLOTS.find((s) => s.id === id) as SlotGeo;

/** What colour each slot must be painted to satisfy this round + the tray of
 *  parts on offer. The tray is hand-authored so the right answer is always
 *  reachable but never trivially the only choice (decoy colours included). */
interface TrayPart {
  uid: string; // unique tray-item id
  kind: PartKind;
  paint: string; // PAINTS key
  glyph: string;
}
interface Round {
  /** Required colour for each slot (the "blueprint"). */
  target: Record<SlotId, string>;
  /** Parts on offer in the tray (jumbled, includes decoys). */
  tray: readonly TrayPart[];
  /** Hide the faint ghost outlines (round 3 — must read the plan, not the hole). */
  hideGhosts: boolean;
  /** Mirror the blueprint left↔right for arms & legs (round 3 twist). */
  mirror: boolean;
}

/* Glyph per kind+side so the placed part still reads as a proper limb. */
const armGlyph = (side: "L" | "R"): string => (side === "L" ? "🦾" : "💪");
const legGlyph = (side: "L" | "R"): string => (side === "L" ? "🦵" : "🦿");

/* ── Three hand-authored rounds (fully deterministic) ───────────────────────
 * R1: everything green — just learn to read the plan & fill in.
 * R2: four colours, every slot a different demand — must check each one.
 * R3: mirrored plan + no ghosts — the guess-defeater. */
const ROUNDS: readonly Round[] = [
  {
    hideGhosts: false,
    mirror: false,
    target: { head: "green", body: "green", armL: "green", armR: "green", legL: "green", legR: "green" },
    tray: [
      { uid: "h-g", kind: "head", paint: "green", glyph: "🤖" },
      { uid: "b-g", kind: "body", paint: "green", glyph: "🟩" },
      { uid: "aL-g", kind: "arm", paint: "green", glyph: "🦾" },
      { uid: "aR-g", kind: "arm", paint: "green", glyph: "💪" },
      { uid: "lL-g", kind: "leg", paint: "green", glyph: "🦵" },
      { uid: "lR-g", kind: "leg", paint: "green", glyph: "🦿" },
      // decoys: wrong-colour parts that must NOT be used this round
      { uid: "b-b", kind: "body", paint: "blue", glyph: "🟦" },
      { uid: "aL-p", kind: "arm", paint: "pink", glyph: "🦾" },
    ],
  },
  {
    hideGhosts: false,
    mirror: false,
    target: { head: "amber", body: "blue", armL: "pink", armR: "pink", legL: "green", legR: "green" },
    tray: [
      { uid: "h-a", kind: "head", paint: "amber", glyph: "🤖" },
      { uid: "b-bl", kind: "body", paint: "blue", glyph: "🟦" },
      { uid: "aL-pk", kind: "arm", paint: "pink", glyph: "🦾" },
      { uid: "aR-pk", kind: "arm", paint: "pink", glyph: "💪" },
      { uid: "lL-gn", kind: "leg", paint: "green", glyph: "🦵" },
      { uid: "lR-gn", kind: "leg", paint: "green", glyph: "🦿" },
      // decoys
      { uid: "h-gn", kind: "head", paint: "green", glyph: "🤖" },
      { uid: "b-am", kind: "body", paint: "amber", glyph: "🟨" },
    ],
  },
  {
    // TWIST round: blueprint is mirrored & ghosts are hidden.
    hideGhosts: true,
    mirror: true,
    // target = what the BUILT robot must end up as (already resolved).
    // Blueprint will be drawn mirrored, so the plan's left arm shows what the
    // robot's RIGHT arm must be — the child must flip it in their head.
    target: { head: "blue", body: "amber", armL: "green", armR: "pink", legL: "amber", legR: "blue" },
    tray: [
      { uid: "h-bl3", kind: "head", paint: "blue", glyph: "🤖" },
      { uid: "b-am3", kind: "body", paint: "amber", glyph: "🟨" },
      { uid: "aL-gn3", kind: "arm", paint: "green", glyph: "🦾" },
      { uid: "aR-pk3", kind: "arm", paint: "pink", glyph: "💪" },
      { uid: "lL-am3", kind: "leg", paint: "amber", glyph: "🦵" },
      { uid: "lR-bl3", kind: "leg", paint: "blue", glyph: "🦿" },
      // decoys: same kinds in the OTHER colour, to punish "grab any limb"
      { uid: "aL-pk3", kind: "arm", paint: "pink", glyph: "🦾" },
      { uid: "lR-gn3", kind: "leg", paint: "green", glyph: "🦿" },
    ],
  },
];

/** Filled state: which paint sits in each slot, or null. */
type Filled = Record<SlotId, string | null>;
const EMPTY_FILLED: Filled = { head: null, body: null, armL: null, armR: null, legL: null, legR: null };

/** Stable confetti pieces for the win burst (angle + delay + glyph). */
const CONFETTI: readonly { dx: number; dy: number; delay: number; g: string }[] =
  Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return {
      dx: Math.cos(a) * 96,
      dy: Math.sin(a) * 96 - 20,
      delay: (i % 5) * 0.05,
      g: ["✨", "🎉", "⭐", "💚", "🎊"][i % 5],
    };
  });

/** For the mirrored blueprint: which slot's target a plan-cell should DISPLAY. */
const mirrorSource = (id: SlotId): SlotId => {
  switch (id) {
    case "armL":
      return "armR";
    case "armR":
      return "armL";
    case "legL":
      return "legR";
    case "legR":
      return "legL";
    default:
      return id;
  }
};

export default function BuildABot({ onComplete }: ActivityProps) {
  const [level, setLevel] = useState<number>(0);
  const [selected, setSelected] = useState<string | null>(null); // tray uid held
  const [filled, setFilled] = useState<Filled>(EMPTY_FILLED);
  const [pop, setPop] = useState<SlotId | null>(null);
  const [wobble, setWobble] = useState<SlotId | null>(null);
  /** A tray part that was just rejected (wrong colour for the tapped slot). */
  const [trayShake, setTrayShake] = useState<string | null>(null);
  const [stars, setStars] = useState<number>(0);
  /** Brief "this round done!" celebration before the next plan slides in. */
  const [roundWin, setRoundWin] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);
  const popTimer = useRef<number | null>(null);
  const wobbleTimer = useRef<number | null>(null);
  const shakeTimer = useRef<number | null>(null);
  const nextTimer = useRef<number | null>(null);
  const starTimers = useRef<number[]>([]);

  const round = ROUNDS[level];
  const isLastRound = level >= ROUNDS.length - 1;

  const placedCount = useMemo<number>(
    () => SLOTS.reduce((n, s) => n + (filled[s.id] !== null ? 1 : 0), 0),
    [filled],
  );

  /** Round is solved when EVERY slot holds a part of its required colour. */
  const roundSolved = useMemo<boolean>(
    () => SLOTS.every((s) => filled[s.id] === round.target[s.id]),
    [filled, round],
  );
  /** Final win = last round just solved AND its celebration is showing. */
  const done = roundSolved && isLastRound;

  const clearStarTimers = useCallback((): void => {
    for (const t of starTimers.current) window.clearTimeout(t);
    starTimers.current = [];
  }, []);

  const clearAllTimers = useCallback((): void => {
    if (popTimer.current !== null) window.clearTimeout(popTimer.current);
    if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    if (nextTimer.current !== null) window.clearTimeout(nextTimer.current);
    clearStarTimers();
  }, [clearStarTimers]);

  // The part currently held in hand (if any).
  const heldPart = useMemo<TrayPart | null>(
    () => round.tray.find((p) => p.uid === selected) ?? null,
    [round, selected],
  );

  // Tap a slot: drop the held part if it's the right KIND and right COLOUR;
  // wrong kind or wrong colour → a gentle wobble, never a scold.
  const tapSlot = useCallback(
    (id: SlotId): void => {
      if (roundSolved || roundWin) return;
      if (filled[id] !== null) {
        // Already filled — let the child pull it back out to rethink.
        if (selected === null) {
          setFilled((prev) => ({ ...prev, [id]: null }));
        }
        return;
      }
      const part = heldPart;
      if (part === null) return;

      const wantKind = kindOf(id);
      const wantPaint = round.target[id];
      const good = part.kind === wantKind && part.paint === wantPaint;

      if (good) {
        setFilled((prev) => ({ ...prev, [id]: part.paint }));
        setSelected(null);
        setPop(id);
        if (popTimer.current !== null) window.clearTimeout(popTimer.current);
        popTimer.current = window.setTimeout(() => setPop(null), 460);
      } else {
        // wobble the slot AND shimmy the held part so the mismatch is felt
        setWobble(id);
        setTrayShake(part.uid);
        if (wobbleTimer.current !== null) window.clearTimeout(wobbleTimer.current);
        wobbleTimer.current = window.setTimeout(() => setWobble(null), 500);
        if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
        shakeTimer.current = window.setTimeout(() => setTrayShake(null), 500);
      }
    },
    [roundSolved, roundWin, filled, selected, heldPart, round],
  );

  const reset = useCallback((): void => {
    clearAllTimers();
    reportedRef.current = false;
    setLevel(0);
    setSelected(null);
    setFilled(EMPTY_FILLED);
    setPop(null);
    setWobble(null);
    setTrayShake(null);
    setStars(0);
    setRoundWin(false);
  }, [clearAllTimers]);

  // When a round is solved: celebrate. If not the last, slide the next plan in.
  // If it is the last, fire onComplete once and pop the stars.
  useEffect(() => {
    if (!roundSolved) return;
    setSelected(null);

    if (!isLastRound) {
      setRoundWin(true);
      if (nextTimer.current !== null) window.clearTimeout(nextTimer.current);
      nextTimer.current = window.setTimeout(() => {
        setRoundWin(false);
        setFilled(EMPTY_FILLED);
        setPop(null);
        setWobble(null);
        setLevel((l) => l + 1);
      }, 1500);
      return;
    }

    // FINAL round solved → report once, then pop the three stars.
    if (!reportedRef.current) {
      reportedRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail: "Three robots built to plan — even the tricky mirror one! 🤖🪞",
      });
    }
    clearStarTimers();
    setStars(0);
    starTimers.current = [1, 2, 3].map((n) =>
      window.setTimeout(() => setStars(n), 360 * n),
    );
  }, [roundSolved, isLastRound, onComplete, clearStarTimers]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  // Emoji-only status.
  const statusEmoji = done ? "🎉" : roundWin ? "👍" : selected !== null ? "👇" : "📋";

  return (
    <div className="flex w-full max-w-[460px] flex-col items-center gap-3">
      {/* ── Tiny emoji status + round dots (no paragraph to read) ── */}
      <div
        className="flex items-center gap-3 rounded-full px-4 py-1.5 text-2xl"
        role="status"
        aria-live="polite"
        aria-label={
          done
            ? "All three robots are built and awake!"
            : roundWin
              ? "Robot built! Next plan coming up"
              : selected !== null
                ? "Now tap the matching spot"
                : round.mirror
                  ? `Round ${level + 1} of 3. The plan is a mirror — left and right are swapped. Match each colour.`
                  : `Round ${level + 1} of 3. Match each part to the plan's colour.`
        }
        style={{
          background: done ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${done ? ACCENT : "var(--color-line, #27314f)"}`,
          boxShadow: done ? `0 0 20px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{statusEmoji}</span>

        {/* round progress: solved ● / current ◉ / upcoming ○ */}
        <span aria-hidden="true" className="inline-flex items-center gap-1.5">
          {ROUNDS.map((_, i) => {
            const solved = i < level || done;
            const current = i === level && !done;
            return (
              <span
                key={i}
                className="grid place-items-center rounded-full"
                style={{
                  height: 14,
                  width: 14,
                  background: solved ? ACCENT : current ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                  animation: current ? "jrbuild-picked 1.6s ease-in-out infinite" : undefined,
                }}
              />
            );
          })}
        </span>

        {done ? (
          <span aria-hidden="true" className="text-2xl">
            {"⭐".repeat(stars)}
            {"·".repeat(3 - stars)}
          </span>
        ) : (
          <span aria-hidden="true" className="text-xl opacity-80">
            🧩 {placedCount}/6
          </span>
        )}
      </div>

      {/* ── Blueprint plan + Build canvas, side by side ── */}
      <div className="flex w-full items-stretch gap-2">
        {/* ── BLUEPRINT (the goal): a small robot painted to plan ── */}
        <div
          className="panel relative shrink-0 overflow-hidden rounded-2xl border p-1"
          style={{
            width: "38%",
            borderColor: round.mirror ? "#fbbf24" : "var(--color-line, #27314f)",
            background: "rgba(255,255,255,0.03)",
          }}
          aria-label={
            round.mirror
              ? "The plan to copy — but it is mirrored, so its left is the robot's right"
              : "The plan to copy — match each part's colour"
          }
        >
          {/* plan label: 📋 normally, 🪞 when mirrored (still no words) */}
          <div className="absolute left-1 top-1 z-10 text-lg" aria-hidden="true">
            {round.mirror ? "🪞" : "📋"}
          </div>
          <Blueprint round={round} />
        </div>

        {/* ── Build canvas (the child's robot) ── */}
        <div
          className="panel relative flex-1 overflow-hidden rounded-2xl border border-line p-2"
          style={{
            background: done
              ? "radial-gradient(circle at 50% 42%, rgba(52,211,153,0.18), transparent 64%)"
              : undefined,
            transition: "background 400ms ease",
          }}
        >
          <svg
            viewBox="0 0 300 350"
            className="block w-full select-none"
            style={{ touchAction: "none" }}
            role="img"
            aria-label="Your robot. Pick a part the right colour, then tap its matching spot to copy the plan."
          >
            <defs>
              <filter id="jb-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="jb-halo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.22" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Soft pulsing halo once the robot is alive (round solved) */}
            {roundSolved && (
              <circle cx="150" cy="178" r="150" fill="url(#jb-halo)">
                <animate attributeName="r" values="135;158;135" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}

            {/* The whole robot idle-bobs / wakes-wiggles as a group */}
            <g
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: roundSolved
                  ? "jrbuild-wiggle 1.6s ease-in-out 1, jrbuild-bob 2.6s ease-in-out 1.6s infinite"
                  : "jrbuild-bob 2.8s ease-in-out infinite",
              }}
            >
              {/* connector spine so parts feel joined */}
              <line x1="150" y1="100" x2="150" y2="262" stroke="#27314f" strokeWidth="6" strokeLinecap="round" />

              {/* ── LEGS ── */}
              <SlotPiece slot={slotGeo("legL")} fill={filled.legL} hideGhost={round.hideGhosts} live={roundSolved} state={cell("legL", filled, selected, pop, wobble)} onTap={tapSlot} />
              <SlotPiece slot={slotGeo("legR")} fill={filled.legR} hideGhost={round.hideGhosts} live={roundSolved} state={cell("legR", filled, selected, pop, wobble)} onTap={tapSlot} />

              {/* ── BODY ── */}
              <SlotPiece slot={slotGeo("body")} fill={filled.body} hideGhost={round.hideGhosts} live={roundSolved} state={cell("body", filled, selected, pop, wobble)} onTap={tapSlot} />

              {/* ── RIGHT ARM (still) ── */}
              <SlotPiece slot={slotGeo("armR")} fill={filled.armR} hideGhost={round.hideGhosts} live={roundSolved} state={cell("armR", filled, selected, pop, wobble)} onTap={tapSlot} />

              {/* ── LEFT ARM (waves when awake) ── */}
              <g
                style={{
                  transformBox: "fill-box",
                  transformOrigin: `${slotGeo("armL").x + 9}px ${slotGeo("armL").y - 18}px`,
                  animation: roundSolved ? "jrbuild-wave 0.55s ease-in-out 4" : undefined,
                }}
              >
                <SlotPiece slot={slotGeo("armL")} fill={filled.armL} hideGhost={round.hideGhosts} live={roundSolved} state={cell("armL", filled, selected, pop, wobble)} onTap={tapSlot} />
              </g>

              {/* ── HEAD ── */}
              <SlotPiece slot={slotGeo("head")} fill={filled.head} hideGhost={round.hideGhosts} live={roundSolved} state={cell("head", filled, selected, pop, wobble)} onTap={tapSlot} />
            </g>
          </svg>
        </div>
      </div>

      {/* ── Parts tray ── */}
      <div
        className="flex min-h-[84px] w-full flex-wrap items-center justify-center gap-2 rounded-2xl px-2 py-2"
        style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed var(--color-line, #27314f)" }}
        aria-label="Tray of robot parts in different colours — pick the one that matches the plan"
      >
        {roundSolved ? (
          <span aria-hidden="true" className="text-3xl">
            🤖 ✨ 🎉 ✨
          </span>
        ) : (
          round.tray.map((p) => {
            // Hide exactly the tray copies that have been placed into the robot.
            if (isConsumed(p, round, filled)) return null;
            const active = selected === p.uid;
            const paint = PAINTS[p.paint];
            return (
              <button
                key={p.uid}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setSelected(active ? null : p.uid);
                }}
                aria-pressed={active}
                aria-label={`Pick ${paint.name} ${p.kind}`}
                className="relative grid h-[68px] w-[68px] place-items-center rounded-2xl text-4xl"
                style={{
                  touchAction: "none",
                  border: `2px solid ${active ? paint.stroke : "var(--color-line, #27314f)"}`,
                  background: active ? `${paint.fill}` : "rgba(11,16,32,0.6)",
                  boxShadow: active
                    ? `0 0 18px ${paint.stroke}, 0 5px 0 0 ${paint.fill}`
                    : "0 5px 0 0 #1a2236",
                  transform: active ? "translateY(-2px)" : undefined,
                  animation:
                    trayShake === p.uid
                      ? "jrbuild-wobble 0.5s ease"
                      : active
                        ? "jrbuild-picked 0.9s ease-in-out infinite"
                        : undefined,
                  transition: "transform 120ms cubic-bezier(.34,1.56,.64,1)",
                }}
              >
                <span aria-hidden="true">{p.glyph}</span>
                {/* colour pip so the child matches by colour, not just shape */}
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 rounded-full"
                  style={{ height: 12, width: 12, background: paint.dot, boxShadow: `0 0 6px ${paint.stroke}` }}
                />
              </button>
            );
          })
        )}
      </div>

      {/* ── Reset ── */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Start over from round one"
        className="grid h-[56px] w-[72px] place-items-center rounded-2xl text-3xl"
        style={{
          touchAction: "none",
          border: "2px solid var(--color-line, #27314f)",
          background: "rgba(255,255,255,0.05)",
          boxShadow: "0 5px 0 0 #1a2236",
        }}
      >
        <span aria-hidden="true">🔄</span>
      </button>

      {/* ── Confetti party on FINAL win ── */}
      {done && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 -z-0" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="absolute text-2xl"
              style={{
                left: 0,
                top: 0,
                animation: `jrbuild-confetti 1100ms cubic-bezier(.22,.61,.36,1) ${c.delay}s both`,
                ["--dx" as string]: `${c.dx}px`,
                ["--dy" as string]: `${c.dy}px`,
              }}
            >
              {c.g}
            </span>
          ))}
        </div>
      )}

      <style>{`
        @keyframes jrbuild-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes jrbuild-wiggle {
          0%, 100% { transform: rotate(0deg) scale(1); }
          20% { transform: rotate(-5deg) scale(1.04); }
          50% { transform: rotate(5deg) scale(1.06); }
          80% { transform: rotate(-3deg) scale(1.03); }
        }
        @keyframes jrbuild-wave {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(36deg); }
        }
        @keyframes jrbuild-pop {
          0% { transform: scale(0.4) translateY(-10px); opacity: 0.3; }
          55% { transform: scale(1.22) translateY(0); opacity: 1; }
          75% { transform: scale(0.94); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes jrbuild-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-7deg); }
          60% { transform: rotate(6deg); }
          85% { transform: rotate(-3deg); }
        }
        @keyframes jrbuild-picked {
          0%, 100% { transform: translateY(-2px) scale(1); }
          50% { transform: translateY(-6px) scale(1.06); }
        }
        @keyframes jrbuild-ghost {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.95; }
        }
        @keyframes jrbuild-confetti {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="jrbuild-bob"], [style*="jrbuild-picked"],
          [style*="jrbuild-ghost"], [style*="jrbuild-wiggle"],
          [style*="jrbuild-wave"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ── Tray consumption: hide exactly the placed copies ───────────────────────
 * A tray part is consumed when a slot of its kind is filled with its paint AND
 * that paint is what the slot wants. Because each (kind,paint) the plan needs
 * appears once in the "correct" set, we hide the first tray entry that matches
 * each filled (kind,paint). Decoys are never consumed (no slot wants them). */
function isConsumed(part: TrayPart, round: Round, filled: Filled): boolean {
  // Count how many slots are currently filled with this (kind,paint).
  let needHidden = 0;
  for (const s of SLOTS) {
    if (kindOf(s.id) === part.kind && filled[s.id] === part.paint) needHidden += 1;
  }
  if (needHidden === 0) return false;
  // Hide the first `needHidden` tray entries of this (kind,paint).
  const matches = round.tray.filter((t) => t.kind === part.kind && t.paint === part.paint);
  const idx = matches.findIndex((t) => t.uid === part.uid);
  return idx > -1 && idx < needHidden;
}

/* ── Slot visual state, derived once per render ─────────────────────────── */
interface SlotState {
  filled: boolean;
  selected: boolean;
  pop: boolean;
  wobble: boolean;
}
const cell = (
  id: SlotId,
  filled: Filled,
  selected: string | null,
  pop: SlotId | null,
  wobble: SlotId | null,
): SlotState => ({
  filled: filled[id] !== null,
  selected: selected !== null,
  pop: pop === id,
  wobble: wobble === id,
});

/** Shared "no pointer events" style for inner SVG art (hits go to the group). */
const NOHIT: React.CSSProperties = { pointerEvents: "none" };

/* ── A slot on the child's robot: empty ghost target, or the painted part ─── */
interface SlotPieceProps {
  slot: SlotGeo;
  fill: string | null; // PAINTS key once placed
  hideGhost: boolean;
  live: boolean; // round solved → robot is alive (lights pulse, eyes open)
  state: SlotState;
  onTap: (id: SlotId) => void;
}

function SlotPiece({ slot, fill, hideGhost, live, state, onTap }: SlotPieceProps) {
  const { selected, pop, wobble } = state;
  const placed = fill !== null;
  const paint = placed ? PAINTS[fill] : null;

  return (
    <g
      onPointerDown={(e) => {
        e.preventDefault();
        onTap(slot.id);
      }}
      role="button"
      aria-label={`${slot.id} spot`}
      style={{
        cursor: "pointer",
        touchAction: "none",
        transformBox: "fill-box",
        transformOrigin: "center",
        animation: wobble
          ? "jrbuild-wobble 0.5s ease"
          : pop
            ? "jrbuild-pop 0.46s cubic-bezier(.34,1.56,.64,1)"
            : undefined,
      }}
    >
      {/* big invisible hit-area for little fingers */}
      <circle cx={slot.x} cy={slot.y} r={Math.max(slot.r, 30)} fill="transparent" />

      {placed && paint ? (
        <g filter={pop || live ? "url(#jb-glow)" : undefined}>
          <PartArt slot={slot} paint={paint} live={live} />
        </g>
      ) : (
        <>
          <circle
            cx={slot.x}
            cy={slot.y}
            r={slot.r}
            fill={selected ? "rgba(52,211,153,0.16)" : "rgba(11,16,32,0.55)"}
            stroke={selected ? ACCENT : "#3a4566"}
            strokeWidth="3"
            strokeDasharray="7 6"
            style={{ transition: "stroke 200ms ease, fill 200ms ease" }}
          >
            {selected && (
              <animate attributeName="r" values={`${slot.r};${slot.r + 4};${slot.r}`} dur="1.2s" repeatCount="indefinite" />
            )}
          </circle>
          {/* faint ghost glyph — hidden in the twist round so you read the plan */}
          {!hideGhost && (
            <text
              x={slot.x}
              y={slot.y + 9}
              textAnchor="middle"
              fontSize="26"
              style={{
                pointerEvents: "none",
                animation: selected ? "jrbuild-ghost 1s ease-in-out infinite" : undefined,
                opacity: 0.5,
              }}
            >
              {slot.ghost}
            </text>
          )}
          {/* in the ghost-less round, a small "?" pip keeps the hole readable */}
          {hideGhost && (
            <text x={slot.x} y={slot.y + 8} textAnchor="middle" fontSize="22" opacity={0.4} style={NOHIT}>
              ❔
            </text>
          )}
        </>
      )}
    </g>
  );
}

/* ── The actual painted part art for a given slot + colour ──────────────────
 * Reuses the original silhouette shapes, recoloured to the placed paint. */
function PartArt({ slot, paint, live }: { slot: SlotGeo; paint: Paint; live: boolean }) {
  const k = kindOf(slot.id);
  const { x, y } = slot;
  const stroke = paint.stroke;
  const fill = paint.fill;

  if (k === "head") {
    return (
      <>
        <line x1={x} y1={y - 34} x2={x} y2={y - 52} stroke={stroke} strokeWidth="3" style={NOHIT} />
        <circle cx={x} cy={y - 54} r="5" fill={stroke} style={NOHIT}>
          {live && <animate attributeName="r" values="5;7;5" dur="0.9s" repeatCount="indefinite" />}
        </circle>
        <rect x={x - 38} y={y - 34} width="76" height="68" rx="18" fill={fill} stroke={stroke} strokeWidth="3" style={NOHIT} />
        <text x={x} y={y + 8} textAnchor="middle" fontSize="26" style={NOHIT} filter={live ? "url(#jb-glow)" : undefined}>
          {live ? "😄" : "💤"}
        </text>
      </>
    );
  }

  if (k === "body") {
    return (
      <>
        <rect x={x - 46} y={y - 46} width="92" height="92" rx="20" fill={fill} stroke={stroke} strokeWidth="3" style={NOHIT} />
        <circle cx={x - 18} cy={y} r="7" fill={stroke} style={NOHIT}>
          {live && <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" />}
        </circle>
        <circle cx={x + 18} cy={y} r="7" fill={stroke} style={NOHIT}>
          {live && <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />}
        </circle>
        <text x={x} y={y + 30} textAnchor="middle" fontSize="18" style={NOHIT}>
          ⚙️
        </text>
      </>
    );
  }

  if (k === "arm") {
    const hand = slot.id === "armL" ? "✋" : "🤚";
    return (
      <>
        <rect x={x - 9} y={y - 22} width="18" height="54" rx="9" fill={fill} stroke={stroke} strokeWidth="3" style={NOHIT} />
        <text x={x} y={y - 26} textAnchor="middle" fontSize="22" style={NOHIT}>
          {hand}
        </text>
      </>
    );
  }

  // leg
  return (
    <>
      <rect x={x - 12} y={y - 14} width="24" height="56" rx="11" fill={fill} stroke={stroke} strokeWidth="3" style={NOHIT} />
      <rect x={x - 16} y={y + 40} width="32" height="14" rx="7" fill={stroke} style={NOHIT} />
    </>
  );
}

/* ── BLUEPRINT: a small read-only robot painted to the round's target ───────
 * In the mirror round it's drawn FLIPPED so the plan's left arm shows the
 * colour that belongs on the robot's right — the guess-defeating twist. */
function Blueprint({ round }: { round: Round }) {
  // Decide the colour shown at each blueprint position. Normally it's the
  // slot's own target; when mirrored, arms/legs read from the opposite side.
  const colourAt = (id: SlotId): string =>
    round.target[round.mirror ? mirrorSource(id) : id];

  return (
    <svg viewBox="0 0 300 350" className="block w-full select-none" role="img" aria-label="The plan robot to copy">
      <defs>
        <radialGradient id="jb-bp-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* a "this is just a drawing" wash so it reads as a plan, not the toy */}
      <rect x="6" y="6" width="288" height="338" rx="20" fill="url(#jb-bp-halo)" />

      <g opacity={0.96}>
        <line x1="150" y1="100" x2="150" y2="262" stroke="#3a4566" strokeWidth="6" strokeLinecap="round" />

        {/* legs, body, arms, head — each painted to the (possibly mirrored) plan */}
        <PartArt slot={slotGeo("legL")} paint={PAINTS[colourAt("legL")]} live={false} />
        <PartArt slot={slotGeo("legR")} paint={PAINTS[colourAt("legR")]} live={false} />
        <PartArt slot={slotGeo("body")} paint={PAINTS[colourAt("body")]} live={false} />
        <PartArt slot={slotGeo("armR")} paint={PAINTS[colourAt("armR")]} live={false} />
        <PartArt slot={slotGeo("armL")} paint={PAINTS[colourAt("armL")]} live={false} />
        <PartArt slot={slotGeo("head")} paint={PAINTS[colourAt("head")]} live={false} />

        {/* colour pips on the plan so a 6-year-old can match by colour at a glance */}
        {SLOTS.map((s) => {
          const p = PAINTS[colourAt(s.id)];
          return <circle key={s.id} cx={s.x + s.r - 6} cy={s.y - s.r + 8} r={7} fill={p.dot} stroke="#0b1020" strokeWidth="2" />;
        })}
      </g>

      {/* mirror hint: a soft flip arrow across the middle (emoji, no words) */}
      {round.mirror && (
        <text x="150" y="178" textAnchor="middle" dominantBaseline="central" fontSize="34" opacity={0.5}>
          🪞
        </text>
      )}
    </svg>
  );
}
