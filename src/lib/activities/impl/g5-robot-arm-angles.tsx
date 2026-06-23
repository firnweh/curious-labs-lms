"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Robot Arm Pick-and-Place — servo angles + forward kinematics      */
/*  CLASS 4-6 (explorer). LEARNING GOAL: a servo holds an EXACT angle, */
/*  so you position a 3-joint arm by choosing the right angle for each  */
/*  joint, then CHAIN those poses into a sequence that picks a block    */
/*  and drops it in the tray.                                          */
/*                                                                     */
/*  Why it's a real problem (not slider-twiddle by luck):              */
/*   • THREE escalating rounds, each with a different block + tray      */
/*     position, so a solved pose can't be reused.                     */
/*   • ALL FIVE poses are graded, not just 2:                          */
/*       HOME  → arm tucked high & clear of both targets (safe park)    */
/*       REACH → tip STAGED ABOVE the block (approach, don't grab yet)  */
/*       GRAB  → tip exactly on the block                              */
/*       LIFT  → block actually RAISED clear of the table              │ */
/*       DROP  → tip over the tray                                     */
/*   • Round 3 is the TWIST: block sits far LEFT, tray far RIGHT — the  */
/*     opposite of the home pose, so you must pan the base across and   */
/*     think, not nudge the default pose.                              */
/*   • PREDICT → RUN: you commit the whole plan, THEN press Play and    */
/*     watch it run. No live "you're grabbing now" cheat during build.  */
/*   • OPTIMISE for stars: a tight sequence (small total servo travel)  */
/*     earns ⭐⭐⭐; a working-but-wasteful one earns ⭐⭐.               */
/*                                                                     */
/*  Wrong plan → gentle bonk + keep the plan to fix (NO passed:false    */
/*  spam). onComplete fires once on the final win, guarded by a ref.    */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const VIEW_W = 320;
const VIEW_H = 240;

// Arm anchored at the base pivot near the bottom-centre.
const BASE_X = 160;
const BASE_Y = 196;
const L1 = 70; // shoulder segment length
const L2 = 58; // elbow segment length

const TABLE_Y = 184; // table surface line
const TOL = 22; // gripper latch / release tolerance (px)
const STAGE_ABOVE = 30; // how far ABOVE the block the REACH pose should hover
const LIFT_CLEAR = 34; // min height the block must rise above the table on LIFT
const HOME_HIGH = 92; // HOME tip must be at/above this y (smaller y = higher)

type JointKey = "base" | "shoulder" | "elbow";
type StepKey = "HOME" | "REACH" | "GRAB" | "LIFT" | "DROP";

interface Angles {
  base: number; // 0..180  pans the whole arm (0 = right, 180 = left)
  shoulder: number; // 0..180 lifts segment 1
  elbow: number; // 0..180 tilts segment 2 relative to segment 1
}

interface Pt {
  x: number;
  y: number;
}

interface StepDef {
  key: StepKey;
  label: string;
  glyph: string;
  hint: string;
}

const STEPS: readonly StepDef[] = [
  { key: "HOME", label: "Home", glyph: "🏠", hint: "tuck the arm up high & clear" },
  { key: "REACH", label: "Reach", glyph: "🎯", hint: "hover JUST ABOVE the block" },
  { key: "GRAB", label: "Grab", glyph: "✊", hint: "lower onto the block" },
  { key: "LIFT", label: "Lift", glyph: "⬆️", hint: "raise the block off the table" },
  { key: "DROP", label: "Drop", glyph: "📦", hint: "carry it over the tray" },
] as const;

const STEP_KEYS: readonly StepKey[] = STEPS.map((s) => s.key);

const START: Angles = { base: 90, shoulder: 90, elbow: 90 };

interface Round {
  block: Pt;
  tray: Pt;
  label: string;
}

// Three fixed, hand-authored, escalating rounds. Block & tray move each time
// so a saved pose can't be reused. All verified reachable by the FK below.
const ROUNDS: readonly Round[] = [
  // R1 — gentle: block to the right, tray to the left (matches home-ish).
  { block: { x: 248, y: 168 }, tray: { x: 72, y: 150 }, label: "Warm-up" },
  // R2 — block nearer & higher on the right; tray tucked low-left.
  { block: { x: 226, y: 150 }, tray: { x: 60, y: 168 }, label: "Trickier reach" },
  // R3 — THE TWIST: block far LEFT, tray far RIGHT (mirror of home). You must
  // pan the base all the way across, not nudge the default pose.
  { block: { x: 70, y: 162 }, tray: { x: 252, y: 150 }, label: "The mirror" },
];

/** Forward kinematics: angles → elbow joint, gripper tip. */
function solve(a: Angles): { j1: Pt; tip: Pt } {
  // base pans the working plane: 0°→points right, 180°→points left.
  const pan = (a.base - 90) / 90; // -1 (right) .. +1 (left)
  const reach = 1 - Math.abs(pan) * 0.18; // slight foreshorten when panned

  // shoulder: 0°→arm down, 90°→horizontal, 180°→straight up.
  const s = ((a.shoulder - 90) * Math.PI) / 180; // -pi/2..+pi/2
  const dir = pan <= 0 ? 1 : -1; // right (+x) vs left (-x)
  const j1x = BASE_X + dir * Math.cos(s) * L1 * reach;
  const j1y = BASE_Y - Math.sin(s) * L1;

  // elbow tilts segment 2 relative to segment 1.
  const e = ((a.elbow - 90) * Math.PI) / 180;
  const tipx = j1x + dir * Math.cos(s + e) * L2 * reach;
  const tipy = j1y - Math.sin(s + e) * L2;

  return { j1: { x: j1x, y: j1y }, tip: { x: tipx, y: tipy } };
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Plain-language nudge from the tip toward a target. */
function nudge(tip: Pt, target: Pt): string {
  const dx = target.x - tip.x;
  const dy = target.y - tip.y;
  if (Math.hypot(dx, dy) <= TOL) return "lined up ✓";
  const parts: string[] = [];
  if (dy < -6) parts.push("a little higher");
  else if (dy > 6) parts.push("a little lower");
  if (dx < -6) parts.push("more to the left");
  else if (dx > 6) parts.push("more to the right");
  return parts.length ? parts.join(", ") : "almost there";
}

/** Where the active step wants the gripper tip to be, for THIS round. */
function aimPoint(step: StepKey, round: Round): Pt | null {
  switch (step) {
    case "HOME":
      return { x: BASE_X, y: HOME_HIGH - 8 };
    case "REACH":
      return { x: round.block.x, y: round.block.y - STAGE_ABOVE };
    case "GRAB":
      return { ...round.block };
    case "LIFT":
      return { x: round.block.x, y: round.block.y - LIFT_CLEAR - 6 };
    case "DROP":
      return { ...round.tray };
  }
}

/** Deterministic per-step grade for a saved pose in a given round. */
function gradeStep(step: StepKey, a: Angles | undefined, round: Round): boolean {
  if (!a) return false;
  const { tip } = solve(a);
  switch (step) {
    case "HOME":
      // Tucked HIGH and clear of both block & tray (a real safe-park pose).
      return (
        tip.y <= HOME_HIGH &&
        dist(tip, round.block) > TOL + 14 &&
        dist(tip, round.tray) > TOL + 14
      );
    case "REACH":
      // Hover ABOVE the block: lined up in x, clearly above it (not grabbing).
      return (
        Math.abs(tip.x - round.block.x) <= TOL &&
        tip.y <= round.block.y - 14 &&
        tip.y >= round.block.y - STAGE_ABOVE - TOL
      );
    case "GRAB":
      return dist(tip, round.block) <= TOL;
    case "LIFT":
      // Block actually raised clear of the table, still roughly over the block x.
      return (
        tip.y <= round.block.y - LIFT_CLEAR &&
        Math.abs(tip.x - round.block.x) <= TOL + 6
      );
    case "DROP":
      return dist(tip, round.tray) <= TOL;
  }
}

type Saved = Partial<Record<StepKey, Angles>>;
type Phase = "build" | "playing" | "roundwon" | "won" | "bonk";

const EASE_DUR = 520;

/** Total servo travel of a committed plan (sum of |Δangle| across the chain). */
function planTravel(saved: Saved): number {
  let total = 0;
  let from: Angles = { ...START };
  for (const key of STEP_KEYS) {
    const to = saved[key];
    if (!to) continue;
    total +=
      Math.abs(to.base - from.base) +
      Math.abs(to.shoulder - from.shoulder) +
      Math.abs(to.elbow - from.elbow);
    from = to;
  }
  return total;
}

// Travel under this (degrees, summed over the whole sequence) = a tidy plan = 3⭐.
// A working-but-wasteful plan still wins, at 2⭐.
const TIDY_TRAVEL = 700;

export default function RobotArmAngles({ onComplete }: ActivityProps) {
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [angles, setAngles] = useState<Angles>({ ...START });
  const [active, setActive] = useState<StepKey>("HOME");
  const [saved, setSaved] = useState<Saved>({});
  const [phase, setPhase] = useState<Phase>("build");
  const [held, setHeld] = useState<boolean>(false); // block currently in gripper
  const [playStep, setPlayStep] = useState<number>(-1);
  const [tries, setTries] = useState<number>(0);
  const [bestStars, setBestStars] = useState<3 | 2>(3); // worst over all rounds

  const reportedRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);

  const round = ROUNDS[roundIdx];
  const isLastRound = roundIdx >= ROUNDS.length - 1;

  const { j1, tip } = useMemo(() => solve(angles), [angles]);

  const stopAnim = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);
  useEffect(() => stopAnim, [stopAnim]);

  // The point the active step is trying to hit (used only as a build-time AIM
  // hint; grading happens on the saved pose, not live).
  const aimTarget: Pt | null = useMemo(
    () => (phase === "build" ? aimPoint(active, round) : null),
    [phase, active, round],
  );

  const setAngle = useCallback(
    (key: JointKey, value: number) => {
      if (phase !== "build") return;
      setAngles((prev) => ({ ...prev, [key]: value }));
    },
    [phase],
  );

  const saveStep = useCallback(() => {
    if (phase !== "build") return;
    setSaved((prev) => ({ ...prev, [active]: { ...angles } }));
  }, [active, angles, phase]);

  // Per-step grade for the CURRENT round, recomputed from saved poses.
  const checks = useMemo(() => {
    const out = {} as Record<StepKey, boolean>;
    for (const k of STEP_KEYS) out[k] = gradeStep(k, saved[k], round);
    return out;
  }, [saved, round]);

  const canPlay = STEP_KEYS.every((k) => checks[k]);

  // Begin a fresh round: clear the plan, park the arm at home.
  const startRound = useCallback(
    (idx: number) => {
      stopAnim();
      setRoundIdx(idx);
      setAngles({ ...START });
      setActive("HOME");
      setSaved({});
      setHeld(false);
      setPlayStep(-1);
      setPhase("build");
    },
    [stopAnim],
  );

  const handleReset = useCallback(() => {
    reportedRef.current = false;
    setBestStars(3);
    startRound(0);
  }, [startRound]);

  // ------- Play: commit, then animate through the saved poses in order -------
  const play = useCallback(() => {
    if (phase === "playing") return;
    if (!canPlay) {
      // Gentle nudge — NOT a graded failure. Keep the plan so they can fix it.
      setTries((t) => t + 1);
      setPhase("bonk");
      stopAnim();
      rafRef.current = requestAnimationFrame(() => {
        setTimeout(() => setPhase((p) => (p === "bonk" ? "build" : p)), 700);
      });
      return;
    }

    // Score THIS round on commit: tidy plan = 3⭐, wasteful-but-works = 2⭐.
    const travel = planTravel(saved);
    const roundStars: 3 | 2 = travel <= TIDY_TRAVEL ? 3 : 2;

    stopAnim();
    setPhase("playing");
    setHeld(false);

    let i = 0;
    let from: Angles = { ...START };

    const runSegment = () => {
      const key = STEP_KEYS[i];
      const target = saved[key] ?? from;
      const t0 = performance.now();
      const startA: Angles = { ...from };

      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / EASE_DUR);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        setAngles({
          base: startA.base + (target.base - startA.base) * ease,
          shoulder: startA.shoulder + (target.shoulder - startA.shoulder) * ease,
          elbow: startA.elbow + (target.elbow - startA.elbow) * ease,
        });
        setPlayStep(i);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        if (key === "GRAB") setHeld(true);
        if (key === "DROP") setHeld(false);
        from = { ...target };
        i += 1;
        if (i < STEP_KEYS.length) {
          rafRef.current = requestAnimationFrame(runSegment);
          return;
        }
        // Sequence finished for this round.
        setPlayStep(-1);
        const worst: 3 | 2 = roundStars < bestStars ? roundStars : bestStars;
        setBestStars(worst);
        if (isLastRound) {
          setPhase("won");
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({
              passed: true,
              stars: worst,
              detail:
                worst === 3
                  ? "All three pick-and-places solved with tidy, efficient sequences! 🤖"
                  : "All three pick-and-places solved! Tighten your moves for 3 stars. 🤖",
            });
          }
        } else {
          setPhase("roundwon");
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(runSegment);
  }, [phase, canPlay, saved, stopAnim, isLastRound, bestStars, onComplete]);

  // ------- live status line -------
  const status = useMemo(() => {
    if (phase === "won") return "Pick-and-place complete! ✨";
    if (phase === "roundwon") return "Round solved! Next round loading…";
    if (phase === "bonk") return "Not every pose is ready — fix the ✗ steps, then Play.";
    if (phase === "playing") {
      const k = playStep >= 0 ? STEP_KEYS[playStep] : "";
      return `Running sequence… ${k}`;
    }
    if (aimTarget) {
      const where =
        active === "HOME"
          ? "Tuck the gripper up high & away"
          : active === "REACH"
            ? "Hover the gripper just ABOVE the block"
            : active === "GRAB"
              ? "Lower onto the block"
              : active === "LIFT"
                ? "Raise the block off the table"
                : "Carry over the tray";
      return `${where}: ${nudge(tip, aimTarget)}`;
    }
    return `Set angles for ${active}, then Save Step.`;
  }, [phase, playStep, aimTarget, active, tip]);

  // ------- visuals -------
  const gripperOpen = held ? 3 : 7;
  const armColor = phase === "won" || phase === "roundwon" ? ACCENT : "#67e8f9";
  const blockVisible = !(held && phase === "playing");
  const blockPos: Pt = held && phase === "playing" ? tip : { ...round.block };
  const bonking = phase === "bonk";

  const jointDefs: { key: JointKey; label: string; tip: string }[] = [
    { key: "base", label: "Base", tip: "pans left ↔ right" },
    { key: "shoulder", label: "Shoulder", tip: "lifts the arm" },
    { key: "elbow", label: "Elbow", tip: "tilts the forearm" },
  ];

  const showBlockRing =
    phase === "build" && (active === "REACH" || active === "GRAB" || active === "LIFT");
  const showTrayRing =
    active === "DROP" || phase === "playing" || phase === "roundwon" || phase === "won";

  // Tip glow when the active build pose is on-target (read off grading).
  const tipOnTarget = phase === "build" && checks[active] === true;

  return (
    <div className="flex w-full flex-col gap-3 font-mono text-ink" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g5robotarmangles-pulse {
          0%,100% { opacity: .25; transform: scale(1); }
          50% { opacity: .7; transform: scale(1.12); }
        }
        @keyframes g5robotarmangles-pop {
          0% { transform: scale(.5); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g5robotarmangles-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-g5raa-anim] { animation: none !important; }
        }
      `}</style>

      {/* ---------------- ROUND PROGRESS ---------------- */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          Round {roundIdx + 1} of {ROUNDS.length} · {round.label}
        </span>
        <span aria-hidden className="inline-flex items-center gap-1.5">
          {ROUNDS.map((_, i) => {
            const solved = i < roundIdx || phase === "won";
            const current = i === roundIdx && phase !== "won";
            return (
              <span
                key={`rd-${i}`}
                className="grid place-items-center rounded-full"
                style={{
                  height: 12,
                  width: 12,
                  background: solved
                    ? ACCENT
                    : current
                      ? "rgba(52,211,153,0.25)"
                      : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "rgba(120,140,170,0.35)"}`,
                }}
              />
            );
          })}
        </span>
      </div>

      {/* ---------------- CANVAS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl"
        style={
          phase === "won"
            ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}`, transition: "box-shadow .3s ease" }
            : { transition: "box-shadow .3s ease" }
        }
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Three-joint robot arm over a table. Block and tray positions change each round. Round ${roundIdx + 1}.`}
          style={{
            touchAction: "none",
            animation: bonking ? "g5robotarmangles-shake .35s ease" : undefined,
          }}
          data-g5raa-anim={bonking ? "" : undefined}
        >
          <defs>
            <radialGradient id="g5raa-ring" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.85" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* faint grid */}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`gv${i}`} x1={(i * VIEW_W) / 8} y1={0} x2={(i * VIEW_W) / 8} y2={VIEW_H} stroke="#1b2433" strokeWidth={0.5} />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <line key={`gh${i}`} x1={0} y1={(i * VIEW_H) / 6} x2={VIEW_W} y2={(i * VIEW_H) / 6} stroke="#1b2433" strokeWidth={0.5} />
          ))}

          {/* table */}
          <rect x={0} y={TABLE_Y} width={VIEW_W} height={VIEW_H - TABLE_Y} fill="#0e1626" />
          <line x1={0} y1={TABLE_Y} x2={VIEW_W} y2={TABLE_Y} stroke="#243049" strokeWidth={1.5} />

          {/* tray (drop zone) */}
          <g>
            {showTrayRing && (
              <circle
                cx={round.tray.x}
                cy={round.tray.y}
                r={TOL}
                fill="url(#g5raa-ring)"
                style={{ transformOrigin: `${round.tray.x}px ${round.tray.y}px`, animation: "g5robotarmangles-pulse 1.6s ease-in-out infinite" }}
                data-g5raa-anim=""
              />
            )}
            <path d={`M ${round.tray.x - 20} ${round.tray.y + 4} L ${round.tray.x - 14} ${round.tray.y + 16} L ${round.tray.x + 14} ${round.tray.y + 16} L ${round.tray.x + 20} ${round.tray.y + 4} Z`} fill="#1b2c2a" stroke={ACCENT} strokeWidth={1.5} />
            <text x={round.tray.x} y={round.tray.y - 16} fill={ACCENT} fontSize={9} textAnchor="middle">TRAY</text>
          </g>

          {/* block target ring during aiming */}
          {showBlockRing && (
            <circle
              cx={round.block.x}
              cy={round.block.y}
              r={TOL}
              fill="url(#g5raa-ring)"
              style={{ transformOrigin: `${round.block.x}px ${round.block.y}px`, animation: "g5robotarmangles-pulse 1.6s ease-in-out infinite" }}
              data-g5raa-anim=""
            />
          )}

          {/* block */}
          {blockVisible && (
            <g style={{ transformOrigin: `${blockPos.x}px ${blockPos.y}px` }}>
              <rect x={blockPos.x - 11} y={blockPos.y - 11} width={22} height={22} rx={3} fill={held ? ACCENT : "#fbbf24"} stroke="#05070d" strokeWidth={1.2} />
              <text x={blockPos.x} y={blockPos.y + 4} fontSize={11} textAnchor="middle">📦</text>
            </g>
          )}

          {/* ARM: base → elbow joint → tip */}
          <g>
            <rect x={BASE_X - 9} y={BASE_Y} width={18} height={20} rx={2} fill="#243049" />
            <line x1={BASE_X} y1={BASE_Y} x2={j1.x} y2={j1.y} stroke={armColor} strokeWidth={9} strokeLinecap="round" />
            <line x1={j1.x} y1={j1.y} x2={tip.x} y2={tip.y} stroke={armColor} strokeWidth={7} strokeLinecap="round" />
            <circle cx={BASE_X} cy={BASE_Y} r={6} fill="#0b1220" stroke={ACCENT} strokeWidth={2} />
            <circle cx={j1.x} cy={j1.y} r={5} fill="#0b1220" stroke={armColor} strokeWidth={2} />
            {/* gripper */}
            <g>
              <line x1={tip.x} y1={tip.y} x2={tip.x - gripperOpen} y2={tip.y + 9} stroke={armColor} strokeWidth={2.5} strokeLinecap="round" />
              <line x1={tip.x} y1={tip.y} x2={tip.x + gripperOpen} y2={tip.y + 9} stroke={armColor} strokeWidth={2.5} strokeLinecap="round" />
            </g>
            {/* tip glow when the active pose grades as correct */}
            {tipOnTarget && (
              <circle cx={tip.x} cy={tip.y} r={6} fill="none" stroke={ACCENT} strokeWidth={2} />
            )}
          </g>

          {/* win burst */}
          {phase === "won" && (
            <text x={VIEW_W / 2} y={40} fontSize={26} textAnchor="middle" style={{ transformOrigin: `${VIEW_W / 2}px 40px`, animation: "g5robotarmangles-pop .5s ease-out" }}>
              ✨🎉✨
            </text>
          )}
          {phase === "roundwon" && (
            <text x={VIEW_W / 2} y={40} fontSize={22} textAnchor="middle" style={{ transformOrigin: `${VIEW_W / 2}px 40px`, animation: "g5robotarmangles-pop .5s ease-out" }}>
              ✅
            </text>
          )}
        </svg>

        {/* in-canvas status */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-1.5">
          <span role="status" aria-live="polite" className="font-mono text-[11px] text-ink-dim">
            {status}
          </span>
        </div>
      </div>

      {/* ---------------- STEP PICKER + CHECKLIST ---------------- */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          Build the sequence — pick a step, set angles, Save
        </p>
        <div className="grid grid-cols-5 gap-1" role="group" aria-label="Sequence steps">
          {STEPS.map((s) => {
            const isActive = active === s.key;
            const ok = checks[s.key];
            return (
              <button
                key={s.key}
                type="button"
                onPointerDown={() => {
                  if (phase !== "build" && phase !== "bonk") return;
                  setActive(s.key);
                  const prev = saved[s.key];
                  if (prev) setAngles({ ...prev });
                }}
                disabled={phase === "playing" || phase === "roundwon" || phase === "won"}
                aria-pressed={isActive}
                aria-label={`${s.label} step${ok ? ", ready" : ", not ready"}`}
                title={s.hint}
                className="flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px] transition disabled:opacity-60"
                style={{
                  borderColor: isActive ? ACCENT : "var(--color-line, #243049)",
                  background: isActive ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.02)",
                  color: isActive ? ACCENT : "var(--color-ink-dim, #9aa6b2)",
                }}
              >
                <span aria-hidden className="text-base leading-none">
                  {saved[s.key] ? (ok ? "✅" : "✗") : s.glyph}
                </span>
                <span className="font-mono">{s.key}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- ANGLE DIALS ---------------- */}
      <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
        <p className="font-mono text-[11px] text-ink-faint">
          Servo angles for <span style={{ color: ACCENT }}>{active}</span> — each holds an exact degree.
        </p>
        {jointDefs.map(({ key, label, tip: t }) => (
          <label key={key} className="flex flex-col gap-1 text-xs">
            <span className="flex items-center justify-between">
              <span className="text-ink-dim">
                {label} <span className="text-ink-faint">· {t}</span>
              </span>
              <span className="font-display tabular-nums" style={{ color: ACCENT }}>
                {Math.round(angles[key])}°
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={180}
              step={1}
              value={angles[key]}
              disabled={phase !== "build" && phase !== "bonk"}
              onChange={(e) => setAngle(key, Number(e.target.value))}
              aria-label={`${label} angle for ${active}, ${Math.round(angles[key])} degrees`}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
              style={{ accentColor: ACCENT, touchAction: "none" }}
            />
          </label>
        ))}

        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={saveStep}
            disabled={phase !== "build" && phase !== "bonk"}
            className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label={`Save angles for the ${active} step`}
          >
            Save Step
          </button>
          <span className="text-[11px] text-ink-faint">
            {saved[active]
              ? checks[active]
                ? "this pose works ✓"
                : "saved, but not in place ✗"
              : "not saved yet"}
          </span>
        </div>
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-ink-faint">Tries: {tries}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset to round one and clear all saved steps"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={play}
            disabled={phase === "playing" || phase === "roundwon" || phase === "won"}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: canPlay ? ACCENT : "#243049", color: canPlay ? "#05070d" : "#9aa6b2" }}
            aria-label="Play the saved sequence"
          >
            {phase === "playing" ? "Playing…" : "Play ▶"}
          </button>
        </div>
      </div>

      {phase === "roundwon" && (
        <p className="text-center font-display text-sm" style={{ color: ACCENT }}>
          ✅ Round {roundIdx + 1} solved — here comes round {roundIdx + 2}!
        </p>
      )}
      {phase === "won" && (
        <p className="text-center font-display text-sm" style={{ color: ACCENT }}>
          {bestStars === 3 ? "⭐⭐⭐" : "⭐⭐"} All rounds solved!
          {bestStars === 2 ? " (Reset & make tighter moves for ⭐⭐⭐)" : ""}
        </p>
      )}

      {/* Advance to the next round once the "round solved" beat has shown. */}
      <RoundAdvancer phase={phase} roundIdx={roundIdx} onAdvance={startRound} />
    </div>
  );
}

/** Tiny helper: after a round-win beat, slide in the next round.
 *  Kept as a child so the timer is self-contained and cleans up. */
function RoundAdvancer({
  phase,
  roundIdx,
  onAdvance,
}: {
  phase: Phase;
  roundIdx: number;
  onAdvance: (idx: number) => void;
}) {
  useEffect(() => {
    if (phase !== "roundwon") return;
    const t = setTimeout(() => onAdvance(roundIdx + 1), 1200);
    return () => clearTimeout(t);
  }, [phase, roundIdx, onAdvance]);
  return null;
}
