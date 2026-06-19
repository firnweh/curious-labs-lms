"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Robotic Arm Pick & Place — forward kinematics + record / replay   */
/*  LEARNING GOAL: a 2-joint arm's gripper position is FIXED by its    */
/*  joint angles (x = L1·cosθ1 + L2·cos(θ1+θ2), y = L1·sinθ1 +         */
/*  L2·sin(θ1+θ2)). Save angle keyframes, then PLAY them to automate   */
/*  a whole pick-and-place task.                                       */
/* ------------------------------------------------------------------ */

const ACCENT = "#34d399";
const VIEW = 320; // square SVG viewBox

// Arm geometry in DATA units (the maths space the learner reasons about).
const L1 = 2.4; // shoulder segment length
const L2 = 1.8; // elbow segment length
const RANGE = 4.6; // data half-extent → x,y both live in [0 .. RANGE]

// Tolerance, in data units, for "the tip is on the target".
const TOL = 0.42;

interface Pt {
  x: number;
  y: number;
}
interface Angles {
  t1: number; // shoulder θ1, 0..180
  t2: number; // elbow    θ2, 0..180
}

/** Forward kinematics — the one formula this whole lab is about. */
function fk(a: Angles): { joint: Pt; tip: Pt } {
  const r1 = (a.t1 * Math.PI) / 180;
  const r2 = ((a.t1 + a.t2) * Math.PI) / 180;
  const joint: Pt = { x: L1 * Math.cos(r1), y: L1 * Math.sin(r1) };
  const tip: Pt = {
    x: joint.x + L2 * Math.cos(r2),
    y: joint.y + L2 * Math.sin(r2),
  };
  return { joint, tip };
}

// Both targets are DEFINED from valid angle pairs, so they are reachable
// by construction. These same pairs are revealed by "show solution angles".
const PICK_SOL: Angles = { t1: 24, t2: 36 };
const PLACE_SOL: Angles = { t1: 116, t2: 40 };
const PICK: Pt = fk(PICK_SOL).tip;
const PLACE: Pt = fk(PLACE_SOL).tip;

const START: Angles = { t1: 90, t2: 90 };

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Map a data point → SVG pixels. Base at bottom-centre, +y is up. */
function toPx(p: Pt): Pt {
  const cx = VIEW / 2;
  const baseY = VIEW - 34;
  const scale = (VIEW - 70) / (2 * RANGE);
  return { x: cx + p.x * scale, y: baseY - p.y * scale };
}

/** A recorded keyframe: the saved angles plus whether the jaw was closed. */
interface Frame {
  t1: number;
  t2: number;
  grabbed: boolean;
}

type Phase = "build" | "playing" | "won";

export default function RoboticArmPickPlace({ onComplete }: ActivityProps) {
  const [angles, setAngles] = useState<Angles>({ ...START });
  const [grabbed, setGrabbed] = useState<boolean>(false); // gripper state while building
  const [frames, setFrames] = useState<Frame[]>([]);
  const [phase, setPhase] = useState<Phase>("build");
  const [playIdx, setPlayIdx] = useState<number>(-1);
  const [showSol, setShowSol] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Dial θ1 & θ2 so the gripper reaches the eraser.",
  );

  const doneRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);

  const { joint, tip } = useMemo(() => fk(angles), [angles]);
  const overPick = dist(tip, PICK) <= TOL;
  const overPlace = dist(tip, PLACE) <= TOL;

  const stopAnim = useCallback((): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);
  useEffect(() => stopAnim, [stopAnim]);

  const setAngle = useCallback(
    (key: keyof Angles, value: number): void => {
      if (phase === "playing") return;
      setShowSol(false);
      setAngles((prev) => ({ ...prev, [key]: value }));
    },
    [phase],
  );

  // ---- RECORD a keyframe (max 4) ----
  const record = useCallback((): void => {
    if (phase === "playing") return;
    setFrames((prev) => {
      if (prev.length >= 4) return prev;
      return [...prev, { t1: angles.t1, t2: angles.t2, grabbed }];
    });
    setStatus("Frame recorded. Build the next pose.");
  }, [angles, grabbed, phase]);

  const grab = useCallback((): void => {
    if (phase === "playing") return;
    setGrabbed(true);
    setStatus("Jaw closed — now reach the bin and record a PLACE frame.");
  }, [phase]);

  const release = useCallback((): void => {
    if (phase === "playing") return;
    setGrabbed(false);
    setStatus("Jaw opened.");
  }, [phase]);

  const handleReset = useCallback((): void => {
    stopAnim();
    doneRef.current = false;
    setAngles({ ...START });
    setGrabbed(false);
    setFrames([]);
    setPhase("build");
    setPlayIdx(-1);
    setShowSol(false);
    setStatus("Dial θ1 & θ2 so the gripper reaches the eraser.");
  }, [stopAnim]);

  // ---- A sequence WINS when, played in order, it: grabs at PICK,
  //      then releases at PLACE. Deterministic & always achievable. ----
  const plan = useMemo(() => {
    let grabFrame = -1;
    let placeFrame = -1;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const ftip = fk(f).tip;
      if (grabFrame < 0 && f.grabbed && dist(ftip, PICK) <= TOL) {
        grabFrame = i;
      } else if (
        grabFrame >= 0 &&
        placeFrame < 0 &&
        !f.grabbed &&
        dist(ftip, PLACE) <= TOL
      ) {
        placeFrame = i;
      }
    }
    return { grabFrame, placeFrame, valid: grabFrame >= 0 && placeFrame >= 0 };
  }, [frames]);

  const finishWin = useCallback((): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase("won");
    setStatus("Eraser placed in the bin by your recorded program! ✨");
    onComplete({
      passed: true,
      stars: 3,
      detail: "Forward kinematics dialled in and the saved sequence ran clean.",
    });
  }, [onComplete]);

  // ---- PLAY: tween the arm through every recorded frame in order ----
  const play = useCallback((): void => {
    if (phase === "playing") return;
    if (frames.length < 2) {
      onComplete({
        passed: false,
        detail: "Record at least a PICK frame and a PLACE frame, then play.",
      });
      setStatus("Record a grab-at-eraser frame and a release-at-bin frame.");
      return;
    }
    if (!plan.valid) {
      onComplete({
        passed: false,
        detail:
          "The replay didn't grab at the eraser then release at the bin — adjust a frame.",
      });
      setStatus("Almost! One frame must GRAB on the eraser, a later one RELEASE on the bin.");
      return;
    }

    stopAnim();
    setPhase("playing");
    setGrabbed(false);

    let seg = 0;
    let from: Angles = { ...START };
    let carrying = false;

    const runSeg = (): void => {
      const f = frames[seg];
      const target: Angles = { t1: f.t1, t2: f.t2 };
      const startA: Angles = { ...from };
      const t0 = performance.now();
      const DUR = 560;

      const tick = (now: number): void => {
        const raw = Math.min(1, (now - t0) / DUR);
        const ease =
          raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
        setAngles({
          t1: startA.t1 + (target.t1 - startA.t1) * ease,
          t2: startA.t2 + (target.t2 - startA.t2) * ease,
        });
        setPlayIdx(seg);
        if (raw < 1) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        // segment landed — apply this frame's jaw state.
        carrying = f.grabbed;
        setGrabbed(carrying);
        from = { ...target };
        seg += 1;
        if (seg < frames.length) {
          rafRef.current = requestAnimationFrame(runSeg);
        } else {
          setPlayIdx(-1);
          finishWin();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(runSeg);
  }, [phase, frames, plan, stopAnim, finishWin, onComplete]);

  // ---- live nudge while building ----
  const nudge = useCallback((target: Pt): string => {
    const dx = target.x - tip.x;
    const dy = target.y - tip.y;
    if (Math.hypot(dx, dy) <= TOL) return "lined up ✓";
    const parts: string[] = [];
    if (dy > 0.12) parts.push("reach higher");
    else if (dy < -0.12) parts.push("reach lower");
    if (dx > 0.12) parts.push("more right");
    else if (dx < -0.12) parts.push("more left");
    return parts.length ? parts.join(", ") : "so close";
  }, [tip]);

  // pixel positions
  const basePx = toPx({ x: 0, y: 0 });
  const jointPx = toPx(joint);
  const tipPx = toPx(tip);
  const pickPx = toPx(PICK);
  const placePx = toPx(PLACE);

  // While building, the eraser sits at PICK until a grabbed frame is saved.
  // While playing, the eraser rides the tip whenever the jaw is closed.
  const eraserHeld = phase === "playing" ? grabbed : false;
  const eraserPos: Pt = eraserHeld ? tipPx : pickPx;
  const eraserPlaced = phase === "won";

  const jaw = grabbed ? 3 : 8; // gripper opening (px)
  const armColor = phase === "won" ? ACCENT : "#67e8f9";

  const solText = showSol
    ? `θ1≈${PICK_SOL.t1}°, θ2≈${PICK_SOL.t2}° → eraser · θ1≈${PLACE_SOL.t1}°, θ2≈${PLACE_SOL.t2}° → bin`
    : null;

  return (
    <div
      className="flex w-full flex-col gap-3 font-mono text-ink"
      style={{ maxWidth: 440 }}
    >
      <style>{`
        @keyframes g7roboticarm-pulse {
          0%,100% { opacity: .25; transform: scale(1); }
          50% { opacity: .7; transform: scale(1.14); }
        }
        @keyframes g7roboticarm-pop {
          0% { transform: scale(.4); opacity: 0; }
          60% { transform: scale(1.18); }
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
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Two-segment robotic arm on a coordinate grid with an eraser to pick and a bin to place it in"
          style={{ touchAction: "none" }}
        >
          <defs>
            <radialGradient id="g7ra-ring" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.85" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* coordinate grid (every 1 data unit) */}
          {Array.from({ length: Math.floor(RANGE) + 1 }, (_, i) => {
            const gx = toPx({ x: i, y: 0 }).x;
            const top = toPx({ x: i, y: RANGE }).y;
            const bot = toPx({ x: i, y: 0 }).y;
            const gxn = toPx({ x: -i, y: 0 }).x;
            return (
              <g key={`vx${i}`} stroke="#1b2433" strokeWidth={0.6}>
                <line x1={gx} y1={top} x2={gx} y2={bot} />
                {i > 0 && <line x1={gxn} y1={top} x2={gxn} y2={bot} />}
              </g>
            );
          })}
          {Array.from({ length: Math.floor(RANGE) + 1 }, (_, i) => {
            const gy = toPx({ x: 0, y: i }).y;
            return (
              <line
                key={`hy${i}`}
                x1={toPx({ x: -RANGE, y: i }).x}
                y1={gy}
                x2={toPx({ x: RANGE, y: i }).x}
                y2={gy}
                stroke="#1b2433"
                strokeWidth={0.6}
              />
            );
          })}
          {/* axes */}
          <line x1={toPx({ x: -RANGE, y: 0 }).x} y1={basePx.y} x2={toPx({ x: RANGE, y: 0 }).x} y2={basePx.y} stroke="#2a3650" strokeWidth={1.3} />
          <line x1={basePx.x} y1={toPx({ x: 0, y: RANGE }).y} x2={basePx.x} y2={basePx.y} stroke="#2a3650" strokeWidth={1.3} />

          {/* PICK target ring */}
          {!eraserPlaced && phase !== "playing" && !grabbed && (
            <circle
              cx={pickPx.x}
              cy={pickPx.y}
              r={TOL * ((VIEW - 70) / (2 * RANGE))}
              fill="url(#g7ra-ring)"
              style={{ transformOrigin: `${pickPx.x}px ${pickPx.y}px`, animation: "g7roboticarm-pulse 1.6s ease-in-out infinite" }}
            />
          )}
          {/* PLACE bin */}
          <g>
            {(grabbed || phase === "playing" || phase === "won") && (
              <circle
                cx={placePx.x}
                cy={placePx.y}
                r={TOL * ((VIEW - 70) / (2 * RANGE))}
                fill="url(#g7ra-ring)"
                style={{ transformOrigin: `${placePx.x}px ${placePx.y}px`, animation: "g7roboticarm-pulse 1.6s ease-in-out infinite" }}
              />
            )}
            <path
              d={`M ${placePx.x - 16} ${placePx.y - 6} L ${placePx.x - 12} ${placePx.y + 12} L ${placePx.x + 12} ${placePx.y + 12} L ${placePx.x + 16} ${placePx.y - 6} Z`}
              fill="#16261f"
              stroke={ACCENT}
              strokeWidth={1.4}
            />
            <text x={placePx.x} y={placePx.y - 12} fill={ACCENT} fontSize={9} textAnchor="middle">BIN</text>
          </g>

          {/* eraser (the object) */}
          {eraserPlaced ? (
            <g style={{ transformOrigin: `${placePx.x}px ${placePx.y}px`, animation: "g7roboticarm-pop .5s ease-out" }}>
              <text x={placePx.x} y={placePx.y + 8} fontSize={18} textAnchor="middle">🧽</text>
            </g>
          ) : (
            <g style={{ transformOrigin: `${eraserPos.x}px ${eraserPos.y}px` }}>
              <rect x={eraserPos.x - 11} y={eraserPos.y - 7} width={22} height={14} rx={2} fill={eraserHeld ? ACCENT : "#f472b6"} stroke="#05070d" strokeWidth={1.1} />
              <text x={eraserPos.x} y={eraserPos.y - 11} fill="#9aa6b2" fontSize={8} textAnchor="middle">eraser</text>
            </g>
          )}

          {/* ARM: base → joint → tip */}
          <line x1={basePx.x} y1={basePx.y} x2={jointPx.x} y2={jointPx.y} stroke={armColor} strokeWidth={9} strokeLinecap="round" />
          <line x1={jointPx.x} y1={jointPx.y} x2={tipPx.x} y2={tipPx.y} stroke={armColor} strokeWidth={7} strokeLinecap="round" />
          <rect x={basePx.x - 11} y={basePx.y} width={22} height={20} rx={3} fill="#243049" />
          <circle cx={basePx.x} cy={basePx.y} r={6} fill="#0b1220" stroke={ACCENT} strokeWidth={2} />
          <circle cx={jointPx.x} cy={jointPx.y} r={5} fill="#0b1220" stroke={armColor} strokeWidth={2} />
          {/* gripper jaws */}
          <g>
            <line x1={tipPx.x} y1={tipPx.y} x2={tipPx.x - jaw} y2={tipPx.y - 9} stroke={armColor} strokeWidth={2.4} strokeLinecap="round" />
            <line x1={tipPx.x} y1={tipPx.y} x2={tipPx.x + jaw} y2={tipPx.y - 9} stroke={armColor} strokeWidth={2.4} strokeLinecap="round" />
          </g>
          {/* tip glow when on the live target */}
          {phase === "build" && ((!grabbed && overPick) || (grabbed && overPlace)) && (
            <circle cx={tipPx.x} cy={tipPx.y} r={6} fill="none" stroke={ACCENT} strokeWidth={2} />
          )}

          {phase === "won" && (
            <text x={VIEW / 2} y={36} fontSize={26} textAnchor="middle" style={{ transformOrigin: `${VIEW / 2}px 36px`, animation: "g7roboticarm-pop .5s ease-out" }}>
              ✨🎉✨
            </text>
          )}
        </svg>

        {/* end-effector readout */}
        <div className="pointer-events-none absolute left-0 top-0 m-2 rounded-md bg-black/40 px-2 py-1">
          <span className="font-display text-[10px] tabular-nums" style={{ color: ACCENT }}>
            tip ({tip.x.toFixed(2)}, {tip.y.toFixed(2)})
          </span>
        </div>

        {/* in-canvas status */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-1.5">
          <span role="status" aria-live="polite" className="font-mono text-[11px] text-ink-dim">
            {phase === "playing"
              ? `Running frame ${playIdx + 1} / ${frames.length}…`
              : phase === "won"
                ? status
                : grabbed
                  ? `Carrying — aim at the bin: ${nudge(PLACE)}`
                  : `Aim at the eraser: ${nudge(PICK)}`}
          </span>
        </div>
      </div>

      {/* ---------------- ANGLE SLIDERS ---------------- */}
      <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
        <p className="font-mono text-[11px] text-ink-faint">
          Joint angles drive forward kinematics:{" "}
          <span style={{ color: ACCENT }}>x = L1·cosθ1 + L2·cos(θ1+θ2)</span>
        </p>
        {(
          [
            { key: "t1", label: "θ1 shoulder", tip: "swings the whole arm" },
            { key: "t2", label: "θ2 elbow", tip: "bends the forearm" },
          ] as const
        ).map(({ key, label, tip: t }) => (
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
              aria-label={`${label}, ${Math.round(angles[key])} degrees`}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
              style={{ accentColor: ACCENT, touchAction: "none" }}
            />
          </label>
        ))}

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={grab}
              disabled={phase === "playing" || grabbed}
              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{ background: grabbed ? "#243049" : ACCENT, color: grabbed ? "#9aa6b2" : "#05070d" }}
              aria-label="Close the gripper to grab the eraser"
            >
              Grab ✊
            </button>
            <button
              type="button"
              onPointerDown={release}
              disabled={phase === "playing" || !grabbed}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{ borderColor: "var(--color-line, #243049)", color: "#cbd3ef" }}
              aria-label="Open the gripper to release the eraser"
            >
              Release ✋
            </button>
          </div>
          <button
            type="button"
            onPointerDown={() => setShowSol((s) => !s)}
            disabled={phase === "playing"}
            className="rounded-lg border border-line px-3 py-1.5 text-[11px] text-ink-dim disabled:opacity-50"
            aria-label="Toggle the solution angles hint"
          >
            {showSol ? "hide angles" : "show angles"}
          </button>
        </div>
        {solText && (
          <p className="font-mono text-[11px]" style={{ color: ACCENT }}>
            {solText}
          </p>
        )}
      </div>

      {/* ---------------- RECORD / PLAY ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
            Keyframes ({frames.length} / 4)
          </p>
          <button
            type="button"
            onPointerDown={record}
            disabled={phase === "playing" || frames.length >= 4}
            className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Record the current angles as a keyframe"
          >
            ● Record frame
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1" role="list" aria-label="Recorded keyframes">
          {Array.from({ length: 4 }, (_, i) => {
            const f = frames[i];
            const isNow = phase === "playing" && playIdx === i;
            return (
              <div
                key={i}
                role="listitem"
                className="flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px]"
                style={{
                  borderColor: isNow ? ACCENT : "var(--color-line, #243049)",
                  background: f ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.02)",
                  color: f ? "#cbd3ef" : "#5b6478",
                }}
              >
                <span aria-hidden className="text-sm leading-none">
                  {f ? (f.grabbed ? "✊" : "✋") : "—"}
                </span>
                <span className="font-mono">
                  {f ? `${Math.round(f.t1)}·${Math.round(f.t2)}` : `f${i + 1}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- ACTIONS ---------------- */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onPointerDown={handleReset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset the arm and clear all keyframes"
        >
          Reset
        </button>
        <button
          type="button"
          onPointerDown={play}
          disabled={phase === "playing"}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{
            background: plan.valid ? ACCENT : "#243049",
            color: plan.valid ? "#05070d" : "#9aa6b2",
          }}
          aria-label="Play the recorded sequence"
        >
          {phase === "playing" ? "Playing…" : "Play ▶"}
        </button>
      </div>

      {phase === "won" && (
        <p className="text-center font-display text-sm" style={{ color: ACCENT }}>
          ⭐⭐⭐ Pick &amp; place automated!
        </p>
      )}
    </div>
  );
}
