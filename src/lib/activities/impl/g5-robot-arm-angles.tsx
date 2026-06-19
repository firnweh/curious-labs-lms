"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Robot Arm Pick-and-Place — servo angles + forward kinematics      */
/*  LEARNING GOAL: a servo holds an EXACT angle, so you position a     */
/*  3-joint arm by choosing the right angle for each joint, then       */
/*  chain those positions into a sequence to pick a block and drop it  */
/*  in the tray.                                                       */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const VIEW_W = 320;
const VIEW_H = 240;

// Arm anchored at the base pivot near the bottom-centre.
const BASE_X = 160;
const BASE_Y = 196;
const L1 = 70; // shoulder segment length
const L2 = 58; // elbow segment length

// Targets in SVG space.
const BLOCK = { x: 250, y: 168 } as const; // block sits on the table (right)
const TRAY = { x: 70, y: 150 } as const; // tray sits to the left
const TOL = 22; // gripper latch / release tolerance (px)

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
  { key: "HOME", label: "Home", glyph: "🏠", hint: "tuck the arm up safely" },
  { key: "REACH", label: "Reach", glyph: "🎯", hint: "tip over the block" },
  { key: "GRAB", label: "Grab", glyph: "✊", hint: "close on the block" },
  { key: "LIFT", label: "Lift", glyph: "⬆️", hint: "raise the block up" },
  { key: "DROP", label: "Drop", glyph: "📦", hint: "open over the tray" },
] as const;

const START: Angles = { base: 90, shoulder: 90, elbow: 90 };

/** Forward kinematics: angles → shoulder joint, elbow joint, gripper tip. */
function solve(a: Angles): { j1: Pt; tip: Pt } {
  // base pans the working plane: 0°→points right, 180°→points left.
  // We fold the base into a left/right reach scale so the side view reads.
  const pan = ((a.base - 90) / 90) * 1; // -1 (right) .. +1 (left)
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

type Saved = Partial<Record<StepKey, Angles>>;
type Phase = "build" | "playing" | "won";

export default function RobotArmAngles({ onComplete }: ActivityProps) {
  const [angles, setAngles] = useState<Angles>({ ...START });
  const [active, setActive] = useState<StepKey>("REACH");
  const [saved, setSaved] = useState<Saved>({});
  const [phase, setPhase] = useState<Phase>("build");
  const [held, setHeld] = useState<boolean>(false); // block currently in gripper
  const [playStep, setPlayStep] = useState<number>(-1);
  const [tries, setTries] = useState<number>(0);

  const doneRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);

  const { j1, tip } = useMemo(() => solve(angles), [angles]);
  const overBlock = dist(tip, BLOCK) <= TOL;
  const overTray = dist(tip, TRAY) <= TOL;

  const stopAnim = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);
  useEffect(() => stopAnim, [stopAnim]);

  // Which target ring matters for the active step, so the learner can aim.
  const aimTarget: Pt | null = useMemo(() => {
    if (active === "REACH" || active === "GRAB") return { ...BLOCK };
    if (active === "DROP") return { ...TRAY };
    return null;
  }, [active]);

  const setAngle = useCallback(
    (key: JointKey, value: number) => {
      if (phase === "playing") return;
      setAngles((prev) => ({ ...prev, [key]: value }));
    },
    [phase],
  );

  const saveStep = useCallback(() => {
    if (phase === "playing") return;
    setSaved((prev) => ({ ...prev, [active]: { ...angles } }));
  }, [active, angles, phase]);

  const handleReset = useCallback(() => {
    stopAnim();
    doneRef.current = false;
    setAngles({ ...START });
    setActive("REACH");
    setSaved({});
    setPhase("build");
    setHeld(false);
    setPlayStep(-1);
  }, [stopAnim]);

  // ------- validation: a saved sequence that actually works -------
  // GRAB must be saved with the tip over the block; DROP over the tray.
  const checks = useMemo(() => {
    const grab = saved.GRAB;
    const drop = saved.DROP;
    const grabOk = grab ? dist(solve(grab).tip, BLOCK) <= TOL : false;
    const dropOk = drop ? dist(solve(drop).tip, TRAY) <= TOL : false;
    return {
      HOME: !!saved.HOME,
      REACH: !!saved.REACH,
      GRAB: grabOk,
      LIFT: !!saved.LIFT,
      DROP: dropOk,
    } satisfies Record<StepKey, boolean>;
  }, [saved]);

  const canPlay = STEPS.every((s) => checks[s.key]);

  const finishWin = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase("won");
    onComplete({
      passed: true,
      stars: 3,
      detail: "Block picked and placed — every servo held its angle!",
    });
  }, [onComplete]);

  // ------- Play: animate through the saved steps in order -------
  const play = useCallback(() => {
    if (!canPlay || phase === "playing") {
      if (!canPlay) {
        setTries((t) => t + 1);
        onComplete({
          passed: false,
          detail: "Save all five steps (with green ticks) before playing.",
        });
      }
      return;
    }
    stopAnim();
    setPhase("playing");
    setHeld(false);

    const order: StepKey[] = STEPS.map((s) => s.key);
    let i = 0;
    let from: Angles = { ...START };

    const runSegment = () => {
      const key = order[i];
      const target = saved[key] ?? from;
      const t0 = performance.now();
      const DUR = 520;
      const startA: Angles = { ...from };

      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / DUR);
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
        // segment finished — apply the step's effect.
        if (key === "GRAB") setHeld(true);
        if (key === "DROP") setHeld(false);
        from = { ...target };
        i += 1;
        if (i < order.length) {
          rafRef.current = requestAnimationFrame(runSegment);
        } else {
          setPlayStep(-1);
          finishWin();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(runSegment);
  }, [canPlay, phase, saved, stopAnim, finishWin, onComplete]);

  // ------- live status line -------
  const status = useMemo(() => {
    if (phase === "won") return "Pick-and-place complete! ✨";
    if (phase === "playing") {
      const k = playStep >= 0 ? STEPS[playStep].key : "";
      return `Running sequence… ${k}`;
    }
    if (aimTarget) {
      const word = active === "DROP" ? "tray" : "block";
      return `Aim the gripper at the ${word}: ${nudge(tip, aimTarget)}`;
    }
    return `Set angles for ${active}, then Save Step.`;
  }, [phase, playStep, aimTarget, active, tip]);

  // gripper visuals
  const gripperOpen = held ? 3 : 7;
  const armColor = phase === "won" ? ACCENT : "#67e8f9";
  const blockVisible = !(held && phase === "playing");
  const blockPos: Pt = held && phase === "playing" ? tip : { ...BLOCK };

  const jointDefs: { key: JointKey; label: string; tip: string }[] = [
    { key: "base", label: "Base", tip: "pans left ↔ right" },
    { key: "shoulder", label: "Shoulder", tip: "lifts the arm" },
    { key: "elbow", label: "Elbow", tip: "tilts the forearm" },
  ];

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
      `}</style>

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
          aria-label="Three-joint robot arm over a table with a block and a tray"
          style={{ touchAction: "none" }}
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
          <rect x={0} y={184} width={VIEW_W} height={56} fill="#0e1626" />
          <line x1={0} y1={184} x2={VIEW_W} y2={184} stroke="#243049" strokeWidth={1.5} />

          {/* tray (drop zone) */}
          <g>
            {(active === "DROP" || phase === "playing" || phase === "won") && (
              <circle cx={TRAY.x} cy={TRAY.y} r={TOL} fill="url(#g5raa-ring)" style={{ transformOrigin: `${TRAY.x}px ${TRAY.y}px`, animation: "g5robotarmangles-pulse 1.6s ease-in-out infinite" }} />
            )}
            <path d={`M ${TRAY.x - 20} ${TRAY.y + 4} L ${TRAY.x - 14} ${TRAY.y + 16} L ${TRAY.x + 14} ${TRAY.y + 16} L ${TRAY.x + 20} ${TRAY.y + 4} Z`} fill="#1b2c2a" stroke={ACCENT} strokeWidth={1.5} />
            <text x={TRAY.x} y={TRAY.y - 16} fill={ACCENT} fontSize={9} textAnchor="middle">TRAY</text>
          </g>

          {/* block target ring */}
          {(active === "REACH" || active === "GRAB") && phase === "build" && (
            <circle cx={BLOCK.x} cy={BLOCK.y} r={TOL} fill="url(#g5raa-ring)" style={{ transformOrigin: `${BLOCK.x}px ${BLOCK.y}px`, animation: "g5robotarmangles-pulse 1.6s ease-in-out infinite" }} />
          )}

          {/* block */}
          {blockVisible && (
            <g style={{ transformOrigin: `${blockPos.x}px ${blockPos.y}px` }}>
              <rect x={blockPos.x - 11} y={blockPos.y - 11} width={22} height={22} rx={3} fill={held ? ACCENT : "#fbbf24"} stroke="#05070d" strokeWidth={1.2} />
              <text x={blockPos.x} y={blockPos.y + 4} fontSize={11} textAnchor="middle">📦</text>
            </g>
          )}

          {/* ARM: base → shoulder joint → tip */}
          <g>
            {/* base post */}
            <rect x={BASE_X - 9} y={BASE_Y} width={18} height={20} rx={2} fill="#243049" />
            {/* segment 1 */}
            <line x1={BASE_X} y1={BASE_Y} x2={j1.x} y2={j1.y} stroke={armColor} strokeWidth={9} strokeLinecap="round" />
            {/* segment 2 */}
            <line x1={j1.x} y1={j1.y} x2={tip.x} y2={tip.y} stroke={armColor} strokeWidth={7} strokeLinecap="round" />
            {/* base pivot */}
            <circle cx={BASE_X} cy={BASE_Y} r={6} fill="#0b1220" stroke={ACCENT} strokeWidth={2} />
            {/* elbow joint */}
            <circle cx={j1.x} cy={j1.y} r={5} fill="#0b1220" stroke={armColor} strokeWidth={2} />
            {/* gripper */}
            <g>
              <line x1={tip.x} y1={tip.y} x2={tip.x - gripperOpen} y2={tip.y + 9} stroke={armColor} strokeWidth={2.5} strokeLinecap="round" />
              <line x1={tip.x} y1={tip.y} x2={tip.x + gripperOpen} y2={tip.y + 9} stroke={armColor} strokeWidth={2.5} strokeLinecap="round" />
            </g>
            {/* tip glow when over a live target */}
            {phase === "build" && ((active === "REACH" || active === "GRAB") && overBlock) && (
              <circle cx={tip.x} cy={tip.y} r={5} fill="none" stroke={ACCENT} strokeWidth={2} />
            )}
            {phase === "build" && active === "DROP" && overTray && (
              <circle cx={tip.x} cy={tip.y} r={5} fill="none" stroke={ACCENT} strokeWidth={2} />
            )}
          </g>

          {/* win burst */}
          {phase === "won" && (
            <text x={VIEW_W / 2} y={40} fontSize={26} textAnchor="middle" style={{ transformOrigin: `${VIEW_W / 2}px 40px`, animation: "g5robotarmangles-pop .5s ease-out" }}>
              ✨🎉✨
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
                  if (phase === "playing") return;
                  setActive(s.key);
                  const prev = saved[s.key];
                  if (prev) setAngles({ ...prev });
                }}
                disabled={phase === "playing"}
                aria-pressed={isActive}
                aria-label={`${s.label} step${ok ? ", saved" : ""}`}
                title={s.hint}
                className="flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px] transition disabled:opacity-60"
                style={{
                  borderColor: isActive ? ACCENT : "var(--color-line, #243049)",
                  background: isActive ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.02)",
                  color: isActive ? ACCENT : "var(--color-ink-dim, #9aa6b2)",
                }}
              >
                <span aria-hidden className="text-base leading-none">
                  {ok ? "✅" : s.glyph}
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
              disabled={phase === "playing"}
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
            disabled={phase === "playing"}
            className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label={`Save angles for the ${active} step`}
          >
            Save Step
          </button>
          <span className="text-[11px] text-ink-faint">
            {checks[active] ? "this step ✓" : "not saved yet"}
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
            aria-label="Reset the arm and clear all saved steps"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={play}
            disabled={phase === "playing"}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: canPlay ? ACCENT : "#243049", color: canPlay ? "#05070d" : "#9aa6b2" }}
            aria-label="Play the saved sequence"
          >
            {phase === "playing" ? "Playing…" : "Play ▶"}
          </button>
        </div>
      </div>

      {phase === "won" && (
        <p className="text-center font-display text-sm" style={{ color: ACCENT }}>
          ⭐⭐⭐ Pick-and-place solved!
        </p>
      )}
    </div>
  );
}
