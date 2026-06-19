"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Robot Arm Reach — forward kinematics + pick-and-place sequencing   */
/*  LEARNING GOAL: a 2-joint arm's gripper position is fully decided   */
/*  by its two joint angles through the forward-kinematics equations,  */
/*  and a pick-and-place task only works when its poses run IN ORDER.  */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const VIEW_W = 320;
const VIEW_H = 240;

// Arm anchored at a base pivot near the bottom-centre.
const BASE_X = 160;
const BASE_Y = 188;
const L1 = 72; // shoulder link length (px in math space)
const L2 = 56; // elbow link length
const REACH_MAX = L1 + L2; // outer reachable radius
const REACH_MIN = Math.abs(L1 - L2); // inner reachable radius (annulus hole)

// Phase-1 target — chosen INSIDE the reachable annulus, so a valid (θ1,θ2)
// pair always exists. Stored in math space (x right, y UP from the base).
const TARGET = { x: 86, y: 70 } as const;
const TOL = 12; // gripper-to-target tolerance (px)

// Phase-2 world anchors, in math space relative to the base.
const PICK = { x: 96, y: -10 } as const; // foam cube on the right
const PLACE = { x: -104, y: -10 } as const; // tray on the left
const PLACE_TOL = 20;

interface Pt {
  x: number;
  y: number;
}

interface Angles {
  /** shoulder angle θ1 in degrees, measured from +x (right), CCW positive. */
  t1: number;
  /** elbow angle θ2 in degrees, relative to link 1. */
  t2: number;
}

const START: Angles = { t1: 40, t2: 40 };

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Forward kinematics: angles → elbow joint + gripper tip, in math space. */
function fk(a: Angles): { joint: Pt; tip: Pt } {
  const j: Pt = { x: L1 * Math.cos(rad(a.t1)), y: L1 * Math.sin(rad(a.t1)) };
  const tip: Pt = {
    x: L1 * Math.cos(rad(a.t1)) + L2 * Math.cos(rad(a.t1 + a.t2)),
    y: L1 * Math.sin(rad(a.t1)) + L2 * Math.sin(rad(a.t1 + a.t2)),
  };
  return { joint: j, tip };
}

/** Math space (y up, origin = base) → SVG pixels (y down). */
function toSvg(p: Pt): Pt {
  return { x: BASE_X + p.x, y: BASE_Y - p.y };
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/* ---- Phase-2 step sequencing ---- */
type StepKey = "MOVE_PICK" | "CLOSE" | "MOVE_PLACE" | "OPEN";

interface StepDef {
  key: StepKey;
  label: string;
  glyph: string;
}

const STEP_DEFS: readonly StepDef[] = [
  { key: "MOVE_PICK", label: "Move to pick", glyph: "🎯" },
  { key: "CLOSE", label: "Close gripper", glyph: "✊" },
  { key: "MOVE_PLACE", label: "Move to place", glyph: "➡️" },
  { key: "OPEN", label: "Open gripper", glyph: "🖐️" },
] as const;

const CORRECT_ORDER: readonly StepKey[] = [
  "MOVE_PICK",
  "CLOSE",
  "MOVE_PLACE",
  "OPEN",
];

/** A shuffled-but-deterministic starting tray for the step cards. */
const SHUFFLED: readonly StepKey[] = ["CLOSE", "MOVE_PLACE", "OPEN", "MOVE_PICK"];

type Phase = "reach" | "sequence" | "won";
const LABEL: Record<StepKey, string> = {
  MOVE_PICK: "Move to pick",
  CLOSE: "Close gripper",
  MOVE_PLACE: "Move to place",
  OPEN: "Open gripper",
};

export default function RobotArmReach({ onComplete }: ActivityProps) {
  const [angles, setAngles] = useState<Angles>({ ...START });
  const [phase, setPhase] = useState<Phase>("reach");
  const [reached, setReached] = useState<boolean>(false);

  // recorded poses for phase 2
  const [pickPose, setPickPose] = useState<Angles | null>(null);
  const [placePose, setPlacePose] = useState<Angles | null>(null);

  // step ordering: sequence strip (ordered) + tray (unplaced)
  const [seq, setSeq] = useState<StepKey[]>([]);
  const [tray, setTray] = useState<StepKey[]>([...SHUFFLED]);

  // run-time animation state
  const [running, setRunning] = useState<boolean>(false);
  const [gripClosed, setGripClosed] = useState<boolean>(false);
  const [cubeAt, setCubeAt] = useState<Pt>({ ...PICK });
  const [cubeHeld, setCubeHeld] = useState<boolean>(false);
  const [cubePlaced, setCubePlaced] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Phase 1 — turn the two joints until the gripper reaches the glowing target.",
  );

  const doneRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);

  const { joint, tip } = useMemo(() => fk(angles), [angles]);
  const tipMath = tip;
  const targetDist = useMemo(
    () => dist(tipMath, TARGET),
    [tipMath],
  );
  const onTarget = targetDist <= TOL;

  const stopAnim = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);
  useEffect(() => stopAnim, [stopAnim]);

  /* -------- Phase 1: detect target reach -------- */
  useEffect(() => {
    if (phase !== "reach") return;
    if (onTarget && !reached) {
      setReached(true);
      setPhase("sequence");
      setStatus(
        "Reached! Now record the pick & place poses, then order the 4 steps.",
      );
    }
  }, [onTarget, phase, reached]);

  const setAngle = useCallback(
    (key: keyof Angles, value: number) => {
      if (running) return;
      setAngles((prev) => ({ ...prev, [key]: value }));
    },
    [running],
  );

  /* -------- record poses (phase 2) -------- */
  const recordPick = useCallback(() => {
    if (running) return;
    if (dist(tipMath, PICK) <= PLACE_TOL) {
      setPickPose({ ...angles });
      setStatus("Pick pose saved ✓ — now hover the tray and save the place pose.");
    } else {
      setStatus("Move the gripper over the foam cube first, then save the pick pose.");
      onComplete({
        passed: false,
        detail: "Line the gripper up over the cube before saving the pick pose.",
      });
    }
  }, [angles, running, tipMath, onComplete]);

  const recordPlace = useCallback(() => {
    if (running) return;
    if (dist(tipMath, PLACE) <= PLACE_TOL) {
      setPlacePose({ ...angles });
      setStatus("Place pose saved ✓ — drag the 4 step cards into the right order.");
    } else {
      setStatus("Move the gripper over the tray first, then save the place pose.");
      onComplete({
        passed: false,
        detail: "Line the gripper up over the tray before saving the place pose.",
      });
    }
  }, [angles, running, tipMath, onComplete]);

  /* -------- step card ordering (tap to add / remove) -------- */
  const addToSeq = useCallback(
    (key: StepKey) => {
      if (running) return;
      setTray((t) => t.filter((k) => k !== key));
      setSeq((s) => (s.includes(key) ? s : [...s, key]));
    },
    [running],
  );
  const removeFromSeq = useCallback(
    (key: StepKey) => {
      if (running) return;
      setSeq((s) => s.filter((k) => k !== key));
      setTray((t) => (t.includes(key) ? t : [...t, key]));
    },
    [running],
  );

  const posesReady = pickPose !== null && placePose !== null;
  const seqFull = seq.length === CORRECT_ORDER.length;
  const orderCorrect = useMemo(
    () => seqFull && seq.every((k, i) => k === CORRECT_ORDER[i]),
    [seq, seqFull],
  );

  const finishWin = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase("won");
    setStatus("Cube delivered to the tray — forward kinematics + ordering solved!");
    onComplete({
      passed: true,
      stars: 3,
      detail: "Target reached and the 4-step pick-and-place ran in the right order.",
    });
  }, [onComplete]);

  const handleReset = useCallback(() => {
    stopAnim();
    doneRef.current = false;
    setAngles({ ...START });
    setPhase("reach");
    setReached(false);
    setPickPose(null);
    setPlacePose(null);
    setSeq([]);
    setTray([...SHUFFLED]);
    setRunning(false);
    setGripClosed(false);
    setCubeAt({ ...PICK });
    setCubeHeld(false);
    setCubePlaced(false);
    setStatus(
      "Phase 1 — turn the two joints until the gripper reaches the glowing target.",
    );
  }, [stopAnim]);

  /* -------- RUN: execute the ordered steps -------- */
  const run = useCallback(() => {
    if (running || phase === "won") return;
    if (!posesReady) {
      setStatus("Record both the pick and place poses before running.");
      onComplete({ passed: false, detail: "Save the pick and place poses first." });
      return;
    }
    if (!seqFull) {
      setStatus("Drop all four step cards into the sequence strip first.");
      onComplete({ passed: false, detail: "Order all four steps before running." });
      return;
    }

    stopAnim();
    setRunning(true);
    setCubePlaced(false);
    setCubeHeld(false);
    setGripClosed(false);
    setCubeAt({ ...PICK });

    const order: StepKey[] = [...seq];
    const pick: Angles = pickPose ?? START;
    const place: Angles = placePose ?? START;

    // simulate, holding the cube only when the gripper closed while over it
    let holding = false;
    let dropped = false;
    let armAt: Angles = { ...angles };

    let i = 0;
    const tween = (from: Angles, to: Angles, after: () => void) => {
      const t0 = performance.now();
      const DUR = 460;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / DUR);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const cur: Angles = {
          t1: from.t1 + (to.t1 - from.t1) * e,
          t2: from.t2 + (to.t2 - from.t2) * e,
        };
        setAngles(cur);
        if (holding) setCubeAt(fk(cur).tip);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          after();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    };

    const next = () => {
      if (i >= order.length) {
        // sequence finished — judge the outcome
        setRunning(false);
        if (!dropped) {
          setStatus("The arm never opened over the tray — check your step order.");
          onComplete({ passed: false, detail: "The cube never reached the tray." });
          return;
        }
        // dropped: was it dropped over the tray with the cube actually held?
        const overTray = dist(fk(place).tip, PLACE) <= PLACE_TOL;
        if (dropped && overTray && cubeLandedRef.current) {
          setCubePlaced(true);
          finishWin();
        } else {
          setStatus("You closed the gripper over empty table — fix the order.");
          onComplete({
            passed: false,
            detail: "Close the gripper only AFTER moving to the cube.",
          });
        }
        return;
      }
      const key = order[i];
      i += 1;
      if (key === "MOVE_PICK") {
        tween(armAt, pick, () => {
          armAt = { ...pick };
          next();
        });
      } else if (key === "MOVE_PLACE") {
        tween(armAt, place, () => {
          armAt = { ...place };
          if (holding) setCubeAt(fk(place).tip);
          next();
        });
      } else if (key === "CLOSE") {
        setGripClosed(true);
        // grab succeeds only if the gripper is currently over the cube
        const overCube = dist(fk(armAt).tip, PICK) <= PLACE_TOL;
        if (overCube) {
          holding = true;
          cubeLandedRef.current = true;
          setCubeHeld(true);
        }
        next();
      } else {
        // OPEN
        setGripClosed(false);
        if (holding) {
          dropped = true;
          holding = false;
          setCubeHeld(false);
          // cube falls to wherever the gripper currently is
          setCubeAt(fk(armAt).tip);
        } else {
          dropped = true; // gripper opened but nothing to drop
        }
        next();
      }
    };

    next();
  }, [
    running,
    phase,
    posesReady,
    seqFull,
    seq,
    pickPose,
    placePose,
    angles,
    stopAnim,
    finishWin,
    onComplete,
  ]);

  // tracks (across the rAF closure) whether the cube was genuinely grabbed
  const cubeLandedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!running) cubeLandedRef.current = false;
  }, [running]);

  /* -------- derived visuals -------- */
  const jointSvg = toSvg(joint);
  const tipSvg = toSvg(tip);
  const baseSvg: Pt = { x: BASE_X, y: BASE_Y };
  const targetSvg = toSvg(TARGET);
  const pickSvg = toSvg(PICK);
  const placeSvg = toSvg(PLACE);
  const cubeSvg = toSvg(cubeAt);
  const grip = gripClosed ? 3 : 7;
  const armColor = phase === "won" ? ACCENT : "#67e8f9";
  const meterPct = Math.max(0, Math.min(1, 1 - targetDist / REACH_MAX));

  return (
    <div
      className="flex w-full flex-col gap-3 font-mono text-ink"
      style={{ maxWidth: 440, margin: "0 auto" }}
    >
      <style>{`
        @keyframes g10robotarmik-pulse {
          0%,100% { opacity: .28; transform: scale(1); }
          50% { opacity: .72; transform: scale(1.14); }
        }
        @keyframes g10robotarmik-pop {
          0% { transform: scale(.4); opacity: 0; }
          60% { transform: scale(1.18); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ---------------- CANVAS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl"
        style={{
          transition: "box-shadow .3s ease",
          boxShadow:
            phase === "won"
              ? `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}`
              : undefined,
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Side view of a two-joint robot arm with a target dot, a foam cube and a tray"
          style={{ touchAction: "none" }}
        >
          <defs>
            <radialGradient id="g10rai-ring" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.85" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* faint grid */}
          {Array.from({ length: 9 }, (_, i) => (
            <line
              key={`gv${i}`}
              x1={(i * VIEW_W) / 8}
              y1={0}
              x2={(i * VIEW_W) / 8}
              y2={VIEW_H}
              stroke="#1b2433"
              strokeWidth={0.5}
            />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <line
              key={`gh${i}`}
              x1={0}
              y1={(i * VIEW_H) / 6}
              x2={VIEW_W}
              y2={(i * VIEW_H) / 6}
              stroke="#1b2433"
              strokeWidth={0.5}
            />
          ))}

          {/* reach annulus — what the arm can actually touch */}
          <circle
            cx={baseSvg.x}
            cy={baseSvg.y}
            r={REACH_MAX}
            fill="none"
            stroke="#243049"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          {REACH_MIN > 1 && (
            <circle
              cx={baseSvg.x}
              cy={baseSvg.y}
              r={REACH_MIN}
              fill="none"
              stroke="#243049"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          )}

          {/* table */}
          <rect x={0} y={BASE_Y} width={VIEW_W} height={VIEW_H - BASE_Y} fill="#0e1626" />
          <line x1={0} y1={BASE_Y} x2={VIEW_W} y2={BASE_Y} stroke="#243049" strokeWidth={1.5} />

          {/* tray (place zone, left) */}
          <g>
            {(phase === "sequence" || phase === "won") && (
              <circle
                cx={placeSvg.x}
                cy={placeSvg.y}
                r={PLACE_TOL}
                fill="url(#g10rai-ring)"
                style={{
                  transformOrigin: `${placeSvg.x}px ${placeSvg.y}px`,
                  animation: "g10robotarmik-pulse 1.6s ease-in-out infinite",
                }}
              />
            )}
            <path
              d={`M ${placeSvg.x - 20} ${placeSvg.y + 6} L ${placeSvg.x - 13} ${placeSvg.y + 18} L ${placeSvg.x + 13} ${placeSvg.y + 18} L ${placeSvg.x + 20} ${placeSvg.y + 6} Z`}
              fill="#1b2c2a"
              stroke={ACCENT}
              strokeWidth={1.5}
            />
            <text x={placeSvg.x} y={placeSvg.y - 14} fill={ACCENT} fontSize={9} textAnchor="middle">
              TRAY
            </text>
          </g>

          {/* foam cube (only when not yet held/placed) */}
          {!cubeHeld && (
            <g style={{ transformOrigin: `${cubeSvg.x}px ${cubeSvg.y}px` }}>
              <rect
                x={cubeSvg.x - 10}
                y={cubeSvg.y - 10}
                width={20}
                height={20}
                rx={3}
                fill={cubePlaced ? ACCENT : "#fbbf24"}
                stroke="#05070d"
                strokeWidth={1.2}
              />
              <text x={cubeSvg.x} y={cubeSvg.y + 4} fontSize={10} textAnchor="middle">
                🧊
              </text>
            </g>
          )}
          {cubeHeld && (
            <rect
              x={cubeSvg.x - 10}
              y={cubeSvg.y - 10}
              width={20}
              height={20}
              rx={3}
              fill={ACCENT}
              stroke="#05070d"
              strokeWidth={1.2}
            />
          )}

          {/* glowing target dot (phase 1) */}
          {phase === "reach" && (
            <g>
              <circle
                cx={targetSvg.x}
                cy={targetSvg.y}
                r={TOL + 3}
                fill="url(#g10rai-ring)"
                style={{
                  transformOrigin: `${targetSvg.x}px ${targetSvg.y}px`,
                  animation: "g10robotarmik-pulse 1.5s ease-in-out infinite",
                }}
              />
              <circle
                cx={targetSvg.x}
                cy={targetSvg.y}
                r={4}
                fill={onTarget ? ACCENT : "#fca5a5"}
              />
            </g>
          )}

          {/* ARM: base → elbow joint → gripper tip */}
          <g>
            <rect x={BASE_X - 9} y={BASE_Y} width={18} height={VIEW_H - BASE_Y} rx={2} fill="#243049" />
            <line x1={baseSvg.x} y1={baseSvg.y} x2={jointSvg.x} y2={jointSvg.y} stroke={armColor} strokeWidth={9} strokeLinecap="round" />
            <line x1={jointSvg.x} y1={jointSvg.y} x2={tipSvg.x} y2={tipSvg.y} stroke={armColor} strokeWidth={7} strokeLinecap="round" />
            <circle cx={baseSvg.x} cy={baseSvg.y} r={6} fill="#0b1220" stroke={ACCENT} strokeWidth={2} />
            <circle cx={jointSvg.x} cy={jointSvg.y} r={5} fill="#0b1220" stroke={armColor} strokeWidth={2} />
            {/* gripper fingers */}
            <g>
              <line x1={tipSvg.x} y1={tipSvg.y} x2={tipSvg.x - grip} y2={tipSvg.y + 9} stroke={armColor} strokeWidth={2.5} strokeLinecap="round" />
              <line x1={tipSvg.x} y1={tipSvg.y} x2={tipSvg.x + grip} y2={tipSvg.y + 9} stroke={armColor} strokeWidth={2.5} strokeLinecap="round" />
            </g>
            {phase === "reach" && onTarget && (
              <circle cx={tipSvg.x} cy={tipSvg.y} r={6} fill="none" stroke={ACCENT} strokeWidth={2} />
            )}
          </g>

          {phase === "won" && (
            <text
              x={VIEW_W / 2}
              y={36}
              fontSize={26}
              textAnchor="middle"
              style={{ transformOrigin: `${VIEW_W / 2}px 36px`, animation: "g10robotarmik-pop .5s ease-out" }}
            >
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

      {/* ---------------- FK READOUT (the math drives the picture) ---------------- */}
      <div className="panel flex flex-col gap-1 rounded-xl p-3 text-[11px]">
        <p className="text-ink-faint">
          Forward kinematics — the tip (X,Y) is computed from the two angles:
        </p>
        <p className="leading-tight text-ink-dim">
          X = L₁·cos θ₁ + L₂·cos(θ₁+θ₂) ={" "}
          <span className="tabular-nums" style={{ color: ACCENT }}>
            {tip.x.toFixed(0)}
          </span>
        </p>
        <p className="leading-tight text-ink-dim">
          Y = L₁·sin θ₁ + L₂·sin(θ₁+θ₂) ={" "}
          <span className="tabular-nums" style={{ color: ACCENT }}>
            {tip.y.toFixed(0)}
          </span>
        </p>
        {phase === "reach" && (
          <div className="mt-1 flex items-center gap-2" aria-label={`Distance to target ${targetDist.toFixed(0)} pixels`}>
            <span className="text-ink-faint">to target</span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
              <span
                className="absolute left-0 top-0 h-full rounded-full"
                style={{
                  width: `${(meterPct * 100).toFixed(0)}%`,
                  background: onTarget ? ACCENT : "#fca5a5",
                  transition: "width .15s ease, background .2s ease",
                }}
              />
            </span>
            <span className="tabular-nums" style={{ color: onTarget ? ACCENT : "#fca5a5" }}>
              {targetDist.toFixed(0)}px
            </span>
          </div>
        )}
      </div>

      {/* ---------------- ANGLE DIALS ---------------- */}
      <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
        {([
          { key: "t1" as const, label: "θ₁ shoulder", tip: "swings the whole arm" },
          { key: "t2" as const, label: "θ₂ elbow", tip: "bends the forearm" },
        ]).map(({ key, label, tip: t }) => (
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
              disabled={running}
              onChange={(e) => setAngle(key, Number(e.target.value))}
              aria-label={`${label} angle, ${Math.round(angles[key])} degrees`}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
              style={{ accentColor: ACCENT, touchAction: "none" }}
            />
          </label>
        ))}
      </div>

      {/* ---------------- PHASE 2: record poses + order steps ---------------- */}
      {(phase === "sequence" || phase === "won") && (
        <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
          <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
            Phase 2 — pick &amp; place
          </p>

          {/* record poses */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={recordPick}
              disabled={running || phase === "won"}
              aria-label="Save the current arm pose as the pick pose"
              className="flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium disabled:opacity-60"
              style={{
                borderColor: pickPose ? ACCENT : "var(--color-line, #243049)",
                background: pickPose ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.02)",
                color: pickPose ? ACCENT : "var(--color-ink-dim, #9aa6b2)",
              }}
            >
              {pickPose ? "Pick pose ✓" : "Save pick pose"}
            </button>
            <button
              type="button"
              onClick={recordPlace}
              disabled={running || phase === "won"}
              aria-label="Save the current arm pose as the place pose"
              className="flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium disabled:opacity-60"
              style={{
                borderColor: placePose ? ACCENT : "var(--color-line, #243049)",
                background: placePose ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.02)",
                color: placePose ? ACCENT : "var(--color-ink-dim, #9aa6b2)",
              }}
            >
              {placePose ? "Place pose ✓" : "Save place pose"}
            </button>
          </div>

          {/* sequence strip */}
          <p className="text-[11px] text-ink-faint">
            Tap cards to drop them into the sequence in order:
          </p>
          <div
            className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-lg border border-dashed p-1.5"
            style={{ borderColor: "var(--color-line, #243049)" }}
            role="list"
            aria-label="Sequence strip"
          >
            {seq.length === 0 && (
              <span className="px-1 text-[11px] text-ink-faint">empty — tap a step below</span>
            )}
            {seq.map((k, i) => {
              const def = STEP_DEFS.find((d) => d.key === k);
              const ok = k === CORRECT_ORDER[i];
              return (
                <button
                  key={k}
                  type="button"
                  role="listitem"
                  onPointerDown={() => removeFromSeq(k)}
                  disabled={running || phase === "won"}
                  aria-label={`Step ${i + 1}: ${LABEL[k]}. Tap to remove.`}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] disabled:opacity-70"
                  style={{
                    borderColor: seqFull ? (ok ? ACCENT : "#fca5a5") : ACCENT,
                    background: "rgba(52,211,153,0.10)",
                    color: "var(--color-ink, #e5e7eb)",
                  }}
                >
                  <span className="tabular-nums text-ink-faint">{i + 1}.</span>
                  <span aria-hidden>{def?.glyph}</span>
                  <span>{def?.label}</span>
                </button>
              );
            })}
          </div>

          {/* tray of unplaced cards */}
          <div className="flex flex-wrap gap-1.5" role="list" aria-label="Available step cards">
            {tray.map((k) => {
              const def = STEP_DEFS.find((d) => d.key === k);
              return (
                <button
                  key={k}
                  type="button"
                  role="listitem"
                  onPointerDown={() => addToSeq(k)}
                  disabled={running || phase === "won"}
                  aria-label={`Add step: ${LABEL[k]}`}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] disabled:opacity-60"
                  style={{
                    borderColor: "var(--color-line, #243049)",
                    background: "rgba(255,255,255,0.02)",
                    color: "var(--color-ink-dim, #9aa6b2)",
                  }}
                >
                  <span aria-hidden>{def?.glyph}</span>
                  <span>{def?.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-ink-faint">
          {phase === "reach" ? "Phase 1 / 2" : phase === "won" ? "Complete" : "Phase 2 / 2"}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the arm, poses and sequence"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={run}
            disabled={phase !== "sequence" || running}
            aria-label="Run the pick and place sequence"
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{
              background: posesReady && seqFull && !running ? ACCENT : "#243049",
              color: posesReady && seqFull && !running ? "#05070d" : "#9aa6b2",
            }}
          >
            {running ? "Running…" : "Run ▶"}
          </button>
        </div>
      </div>

      {phase === "won" && (
        <p className="text-center font-display text-sm" style={{ color: ACCENT }}>
          ⭐⭐⭐ Reach &amp; pick-and-place solved!
        </p>
      )}
    </div>
  );
}
