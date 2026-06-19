"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Contactless Bin Lid 🗑️ ───────────────────────────────────────────────────
   GRADE 6 (explorer, age ~10–11). Subject: ROBOTICS.
   ONE learning goal: HYSTERESIS — using two different thresholds (open closer,
   close farther) leaves a gap that absorbs sensor noise so the lid behaves
   smoothly instead of flickering on a jittery distance reading.

   A distance sensor watches a hand. The learner sets two rules:
     • OPEN  when the hand is CLOSER than O cm
     • CLOSE when the hand is FARTHER than C cm
   Press TEST: the hand auto-plays in from 50cm, PAUSES at 22cm (where the raw
   reading jitters ±2cm), then retreats to 50cm. The lid servo follows the rules
   on every noisy sample. We count how many times the lid flips state.
   Win = lid opens exactly once on approach, does NOT flicker at the 22cm pause,
   and closes exactly once on retreat → flicker counter reads 0.
   Equal/too-close thresholds make the lid chatter; the gap (C − O) must be wide
   enough to swallow the ±2cm noise. Deterministic, always winnable, never scolds.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";
const DANGER = "#f87171";

// ── Virtual SVG world (CSS scales it responsively) ───────────────────────────
const VW = 360;
const VH = 200;

// Distance domain the hand can occupy, in centimetres.
const D_FAR = 50;
const D_NEAR = 5;

// The hand slides along this horizontal pixel track. Left = near, right = far.
const TRACK_LEFT = 150;
const TRACK_RIGHT = 330;

// Sensor noise: the raw reading jitters ±JITTER cm around the true distance.
const JITTER = 2;

// The scripted pause distance where the noise must be absorbed by the gap.
const PAUSE_D = 22;

// Threshold slider bounds + the target solution.
const T_MIN = 10;
const T_MAX = 40;
const TARGET_OPEN = 20; // OPEN when closer than 20cm
const TARGET_CLOSE = 30; // CLOSE when farther than 30cm

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

const dToX = (d: number): number =>
  TRACK_LEFT + ((d - D_NEAR) / (D_FAR - D_NEAR)) * (TRACK_RIGHT - TRACK_LEFT);

type Phase = "idle" | "testing" | "won" | "retry";
type Lid = "open" | "closed";
type Seg = "in" | "pause" | "out";

/** One scripted "true distance" frame of the test run. */
interface Frame {
  /** True hand distance in cm at this frame. */
  d: number;
  /** Deterministic noisy reading the sensor reports (true + jitter). */
  reading: number;
  /** Which leg of the run this frame belongs to. */
  seg: Seg;
}

/** True distance the hand reaches at its deepest point on the way in. */
const D_DEEP = 12;

/**
 * The fixed ±JITTER wobble pattern. At the 22cm pause it makes the raw reading
 * straddle the band [20, 24]: a too-tight gap will see it cross BOTH thresholds
 * and chatter, while the intended 20↔30 gap swallows the whole band → calm.
 */
const NOISE: readonly number[] = [-2, 2, -2, 2, -1, 1, -2, 2];

/**
 * Build the deterministic test script: glide IN to D_DEEP (well past the open
 * point, so the lid pops up), drift back out and HOLD jittery at 22cm (the noisy
 * zone the gap must absorb), then glide OUT to 50 (past the close point). The
 * jitter is a fixed repeating pattern so every run — and the grader — see the
 * exact same readings. No Math.random anywhere → deterministic, always winnable.
 */
function buildScript(): Frame[] {
  const frames: Frame[] = [];
  let k = 0;
  const push = (d: number, seg: Seg): void => {
    const j = NOISE[k % NOISE.length];
    k += 1;
    frames.push({ d, reading: Math.round((d + j) * 10) / 10, seg });
  };
  // approach: 50 → 12 (crosses the open threshold → lid opens once)
  for (let d = D_FAR; d >= D_DEEP; d -= 2) push(d, "in");
  // settle back toward the 22cm pause, then HOLD there in the noisy zone
  for (let d = D_DEEP + 2; d <= PAUSE_D; d += 2) push(d, "in");
  for (let i = 0; i < 8; i += 1) push(PAUSE_D, "pause");
  // retreat: 22 → 50 (crosses the close threshold → lid closes once)
  for (let d = PAUSE_D + 2; d <= D_FAR; d += 2) push(d, "out");
  return frames;
}

const SCRIPT: readonly Frame[] = buildScript();

interface SimResult {
  /** Flicker count = lid flips during the noisy pause + any extra flips. */
  flickers: number;
  /** A perfect run: opened on approach, calm through the pause, closed on exit. */
  cleanCycle: boolean;
  /** Lid did flip one or more times inside the noisy 22cm pause. */
  chatteredAtPause: boolean;
}

/**
 * Apply one threshold rule to a single reading given the current lid state.
 * Hysteresis: open when reading < openAt; close when reading > closeAt; else
 * HOLD. The two-sided dead-band between the thresholds is what absorbs noise.
 */
function nextLid(lid: Lid, reading: number, openAt: number, closeAt: number): Lid {
  if (reading < openAt) return "open";
  if (reading > closeAt) return "closed";
  return lid;
}

/**
 * Run the rule over the fixed script with the chosen thresholds and report how
 * jittery the lid was. Pure + deterministic — the SINGLE source of truth shared
 * by both the live animation and the pass/fail decision.
 *
 * A clean run flips exactly twice: open once during APPROACH, close once during
 * RETREAT, and never flips during the PAUSE. Extra flips are flicker.
 */
function simulate(openAt: number, closeAt: number): SimResult {
  let lid: Lid = "closed";
  let transitions = 0;
  let openedOnApproach = false;
  let closedOnRetreat = false;
  let pauseFlips = 0;
  for (const f of SCRIPT) {
    const next = nextLid(lid, f.reading, openAt, closeAt);
    if (next !== lid) {
      transitions += 1;
      if (f.seg === "in" && next === "open") openedOnApproach = true;
      if (f.seg === "out" && next === "closed") closedOnRetreat = true;
      if (f.seg === "pause") pauseFlips += 1;
      lid = next;
    }
  }
  // The ideal run flips exactly twice (open on approach, close on retreat).
  // Flicker = pause chatter plus any flips beyond that ideal pair.
  const flickers = pauseFlips + Math.max(0, transitions - pauseFlips - 2);
  const cleanCycle =
    openedOnApproach && closedOnRetreat && pauseFlips === 0 && transitions === 2;
  return { flickers, cleanCycle, chatteredAtPause: pauseFlips > 0 };
}

export default function ContactlessBinLid({ onComplete }: ActivityProps) {
  // Thresholds start unsolved (OPEN unset-ish low, CLOSE too close → it chatters).
  const [openAt, setOpenAt] = useState<number>(15);
  const [closeAt, setCloseAt] = useState<number>(18);
  const [phase, setPhase] = useState<Phase>("idle");

  // Live test state.
  const [frameIdx, setFrameIdx] = useState<number>(0);
  const [lid, setLid] = useState<Lid>("closed");
  const [flickers, setFlickers] = useState<number>(0);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reportedRef = useRef<boolean>(false);
  const draggingRef = useRef<boolean>(false);

  // When idle, the learner can drag the hand to preview the live reading.
  const [previewD, setPreviewD] = useState<number>(D_FAR);

  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const testing = phase === "testing";
  const won = phase === "won";
  const retry = phase === "retry";

  const gap = closeAt - openAt;

  // ── Drag the hand along the track to preview the sensor reading (idle only) ──
  const pointerToD = useCallback((clientX: number): number => {
    const svg = svgRef.current;
    if (!svg) return previewD;
    const rect = svg.getBoundingClientRect();
    const px = TRACK_LEFT + ((clientX - rect.left) / rect.width) * VW - TRACK_LEFT;
    const ratio = clamp(px / (TRACK_RIGHT - TRACK_LEFT), 0, 1);
    return Math.round(D_NEAR + ratio * (D_FAR - D_NEAR));
  }, [previewD]);

  const onHandDown = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (testing) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      draggingRef.current = true;
      setPreviewD(pointerToD(e.clientX));
    },
    [testing, pointerToD],
  );

  const onHandMove = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!draggingRef.current || testing) return;
      e.preventDefault();
      setPreviewD(pointerToD(e.clientX));
    },
    [testing, pointerToD],
  );

  const onHandUp = useCallback(
    (e: React.PointerEvent<SVGGElement>): void => {
      if (!draggingRef.current) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      draggingRef.current = false;
    },
    [],
  );

  // ── TEST: auto-play the script, applying the live thresholds frame by frame ──
  const runTest = useCallback((): void => {
    if (testing) return;
    clearTimers();
    setPhase("testing");
    setFrameIdx(0);
    setFlickers(0);
    setLid("closed");

    // Replay the EXACT same rule the grader uses, but visibly, frame by frame.
    let liveLid: Lid = "closed";
    let liveTrans = 0;
    const STEP_MS = 110;

    SCRIPT.forEach((f, i) => {
      const t = setTimeout(() => {
        setFrameIdx(i);
        const next = nextLid(liveLid, f.reading, openAt, closeAt);
        if (next !== liveLid) {
          liveTrans += 1;
          liveLid = next;
          setLid(next);
          // Flicker = any flip beyond the ideal open-once / close-once pair.
          setFlickers(Math.max(0, liveTrans - 2));
        }
      }, i * STEP_MS);
      timersRef.current.push(t);
    });

    // After the script finishes, grade with the pure simulator (same answer).
    const endT = setTimeout(
      () => {
        const res = simulate(openAt, closeAt);
        if (res.cleanCycle) {
          setPhase("won");
          if (!reportedRef.current) {
            reportedRef.current = true;
            onComplete({
              passed: true,
              stars: 3,
              detail: "Smooth lid! The gap between thresholds is hysteresis. ✨",
            });
          }
        } else {
          setPhase("retry");
          onComplete({
            passed: false,
            detail: res.chatteredAtPause
              ? "The lid chattered at 22cm. Make the close distance bigger than the open distance — leave a gap."
              : "Almost — let the lid open as the hand nears AND close as it leaves.",
          });
        }
      },
      SCRIPT.length * STEP_MS + 240,
    );
    timersRef.current.push(endT);
  }, [testing, clearTimers, openAt, closeAt, onComplete]);

  const reset = useCallback((): void => {
    clearTimers();
    setPhase("idle");
    setFrameIdx(0);
    setLid("closed");
    setFlickers(0);
    setPreviewD(D_FAR);
  }, [clearTimers]);

  // Changing a threshold while showing a result returns to idle for a re-test.
  const editThreshold = useCallback(
    (which: "open" | "close", v: number): void => {
      if (testing) return;
      if (which === "open") setOpenAt(v);
      else setCloseAt(v);
      if (phase !== "idle") {
        clearTimers();
        setPhase("idle");
        setFrameIdx(0);
        setLid("closed");
        setFlickers(0);
      }
    },
    [testing, phase, clearTimers],
  );

  // The true distance + sensor reading currently on screen.
  const trueD = testing ? SCRIPT[frameIdx].d : previewD;
  const reading = testing
    ? SCRIPT[frameIdx].reading
    : Math.round(previewD * 10) / 10;
  const handX = dToX(trueD);

  // Lid angle: 90° open, 0° closed.
  const lidAngle = (testing || won || retry ? lid : "closed") === "open" ? -88 : 0;

  // Status text for the live region.
  const statusLabel = useMemo<string>(() => {
    if (won) return "Smooth! The lid opened once and closed once — zero flicker.";
    if (testing)
      return `Testing… reading ${reading.toFixed(1)} centimetres, lid ${lid}, flickers ${flickers}.`;
    if (retry)
      return flickers > 0
        ? `The lid flickered ${flickers} times. Widen the gap between the thresholds.`
        : "The lid did not complete a clean open-then-close cycle. Adjust the rules.";
    return `Set the rules, then press Test. Hand at ${reading.toFixed(0)} centimetres.`;
  }, [won, testing, retry, reading, lid, flickers]);

  const flickerBad = flickers > 0;
  const goodGap = gap >= 8; // a coaching hint threshold, NOT the win check

  return (
    <div className="flex w-full flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status pill ── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-xl"
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
        style={{
          background: won ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">🗑️</span>
        {won ? (
          <span aria-hidden="true" className="text-xl">
            ⭐⭐⭐
          </span>
        ) : (
          <span aria-hidden="true" className="text-base">
            {`${reading.toFixed(0)}cm`}
          </span>
        )}
        {won && (
          <span aria-hidden="true" className="text-xl">
            ✨
          </span>
        )}
      </div>

      {/* ── The scene: bin, hinged lid, sensor cone, sliding hand, ruler ── */}
      <div
        className="panel relative w-full max-w-[440px] overflow-hidden rounded-2xl border p-2"
        style={{
          borderColor: won ? ACCENT : "var(--color-line, #33405c)",
          boxShadow: won
            ? `0 0 0 1px ${ACCENT}, 0 0 22px -4px ${ACCENT}`
            : undefined,
          transition: "box-shadow .3s ease, border-color .3s ease",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="block w-full select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="A side view of a bin with a hinged lid, an ultrasonic sensor, and a hand on a distance track"
        >
          <defs>
            <linearGradient id="g6contactlessbinlid-bin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2b3550" />
              <stop offset="100%" stopColor="#1a2236" />
            </linearGradient>
            <radialGradient id="g6contactlessbinlid-cone" cx="0%" cy="50%" r="100%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.5" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* floor */}
          <line
            x1={0}
            y1={172}
            x2={VW}
            y2={172}
            stroke="rgba(120,140,170,0.30)"
            strokeWidth={2}
          />

          {/* ── distance ruler / track the hand slides on ── */}
          <line
            x1={TRACK_LEFT}
            y1={70}
            x2={TRACK_RIGHT}
            y2={70}
            stroke="rgba(120,140,170,0.45)"
            strokeWidth={1.5}
          />
          {[D_NEAR, 20, 30, 40, D_FAR].map((d) => (
            <g key={d}>
              <line
                x1={dToX(d)}
                y1={66}
                x2={dToX(d)}
                y2={74}
                stroke="rgba(120,140,170,0.55)"
                strokeWidth={1.2}
              />
              <text
                x={dToX(d)}
                y={62}
                fontSize={8}
                textAnchor="middle"
                fill="rgba(160,180,205,0.85)"
              >
                {d}
              </text>
            </g>
          ))}

          {/* threshold markers on the ruler (OPEN green-solid, CLOSE dashed) */}
          <line
            x1={dToX(openAt)}
            y1={64}
            x2={dToX(openAt)}
            y2={120}
            stroke={ACCENT}
            strokeWidth={1.6}
            strokeDasharray="2 2"
            opacity={0.8}
          />
          <line
            x1={dToX(closeAt)}
            y1={64}
            x2={dToX(closeAt)}
            y2={120}
            stroke="#67e8f9"
            strokeWidth={1.6}
            strokeDasharray="2 2"
            opacity={0.8}
          />
          {/* the hysteresis GAP band between the two thresholds */}
          {closeAt > openAt && (
            <rect
              x={dToX(openAt)}
              y={64}
              width={Math.max(0, dToX(closeAt) - dToX(openAt))}
              height={12}
              fill={ACCENT}
              opacity={0.18}
            />
          )}

          {/* ── the bin body ── */}
          <path
            d="M 70 96 L 132 96 L 126 172 L 76 172 Z"
            fill="url(#g6contactlessbinlid-bin)"
            stroke="#3a4866"
            strokeWidth={2}
          />
          {/* bin ridges */}
          <line x1={84} y1={112} x2={120} y2={112} stroke="#3a4866" strokeWidth={1} />
          <line x1={83} y1={134} x2={120} y2={134} stroke="#3a4866" strokeWidth={1} />

          {/* ── ultrasonic sensor at the rim + its cone toward the hand ── */}
          <polygon
            points={`133,92 ${TRACK_RIGHT},58 ${TRACK_RIGHT},82`}
            fill="url(#g6contactlessbinlid-cone)"
            opacity={testing ? 0.9 : 0.55}
          />
          <rect x={120} y={84} width={16} height={12} rx={2} fill="#0d1422" stroke={ACCENT} strokeWidth={1.4} />
          <circle cx={125} cy={90} r={2.4} fill={ACCENT} />
          <circle cx={131} cy={90} r={2.4} fill={ACCENT} />

          {/* ── the hinged lid (servo) — pivots at the back-top corner ── */}
          <g
            transform={`rotate(${lidAngle} 70 96)`}
            style={{ transition: "transform 260ms cubic-bezier(.2,.7,.3,1)" }}
          >
            <rect
              x={66}
              y={84}
              width={70}
              height={12}
              rx={3}
              fill={lidAngle !== 0 ? ACCENT : "#46577a"}
              stroke="#0d1422"
              strokeWidth={1.5}
              style={{
                filter: lidAngle !== 0 ? `drop-shadow(0 0 6px ${ACCENT}99)` : undefined,
              }}
            />
            {/* hinge knob */}
            <circle cx={70} cy={96} r={3} fill="#0d1422" stroke="#67e8f9" strokeWidth={1} />
          </g>

          {/* ── the draggable hand on the track ── */}
          <g
            onPointerDown={onHandDown}
            onPointerMove={onHandMove}
            onPointerUp={onHandUp}
            onPointerCancel={onHandUp}
            style={{
              cursor: testing ? "default" : "grab",
              transform: `translate(${handX}px, 96px)`,
              transition: testing ? "transform 100ms linear" : "none",
              touchAction: "none",
            }}
            role="slider"
            tabIndex={0}
            aria-label={`Hand distance: ${reading.toFixed(0)} centimetres`}
            aria-valuemin={D_NEAR}
            aria-valuemax={D_FAR}
            aria-valuenow={Math.round(trueD)}
          >
            {/* generous invisible hit pad */}
            <rect x={-22} y={-30} width={44} height={60} fill="transparent" />
            {/* drop line from ruler */}
            <line x1={0} y1={-26} x2={0} y2={-8} stroke="rgba(160,180,205,0.5)" strokeWidth={1} />
            <text
              x={0}
              y={0}
              fontSize={26}
              textAnchor="middle"
              dominantBaseline="central"
              aria-hidden="true"
            >
              🤚
            </text>
            {!testing && phase === "idle" && (
              <text
                x={0}
                y={22}
                fontSize={11}
                textAnchor="middle"
                dominantBaseline="central"
                aria-hidden="true"
                fill="rgba(160,180,205,0.8)"
                style={{ animation: "g6contactlessbinlid-nudge 1.4s ease-in-out infinite" }}
              >
                ↔ drag
              </text>
            )}
          </g>

          {/* live reading badge near the sensor */}
          <text
            x={TRACK_RIGHT}
            y={96}
            fontSize={11}
            textAnchor="end"
            fill={ACCENT}
            className="tabular-nums"
            aria-hidden="true"
          >
            {`${reading.toFixed(1)} cm`}
          </text>
        </svg>

        {/* ── live readouts under the scene ── */}
        <div className="mt-1 flex items-center justify-between px-1 text-[11px]">
          <span className="text-ink-dim">
            lid:{" "}
            <span style={{ color: lidAngle !== 0 ? ACCENT : "#9aa6b2" }}>
              {lidAngle !== 0 ? "OPEN" : "CLOSED"}
            </span>
          </span>
          <span
            className="flex items-center gap-1 rounded-full px-2 py-0.5"
            role="status"
            aria-label={`Flicker counter: ${flickers}`}
            style={{
              background: flickerBad ? "rgba(248,113,113,0.16)" : "rgba(52,211,153,0.12)",
              color: flickerBad ? DANGER : ACCENT,
              fontWeight: 600,
            }}
          >
            flicker: {flickers}
          </span>
          <span className="text-ink-faint">
            gap: <span style={{ color: goodGap ? ACCENT : "#9aa6b2" }}>{gap}cm</span>
          </span>
        </div>
      </div>

      {/* ── Threshold rule sliders ── */}
      <div className="panel flex w-full max-w-[440px] flex-col gap-2.5 rounded-xl p-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">
              OPEN when closer than{" "}
              <span className="text-ink-faint">· lid pops up</span>
            </span>
            <span className="font-display tabular-nums" style={{ color: ACCENT }}>
              {openAt} cm
            </span>
          </span>
          <input
            type="range"
            min={T_MIN}
            max={T_MAX}
            step={1}
            value={openAt}
            disabled={testing}
            onChange={(e) => editThreshold("open", Number(e.target.value))}
            aria-label={`Open threshold, currently ${openAt} centimetres`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
            style={{ accentColor: ACCENT }}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">
              CLOSE when farther than{" "}
              <span className="text-ink-faint">· lid drops</span>
            </span>
            <span className="font-display tabular-nums" style={{ color: "#67e8f9" }}>
              {closeAt} cm
            </span>
          </span>
          <input
            type="range"
            min={T_MIN}
            max={T_MAX}
            step={1}
            value={closeAt}
            disabled={testing}
            onChange={(e) => editThreshold("close", Number(e.target.value))}
            aria-label={`Close threshold, currently ${closeAt} centimetres`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2 disabled:opacity-50"
            style={{ accentColor: "#67e8f9" }}
          />
        </label>

        {/* coaching line — never the exact answer */}
        <p
          className="text-[11px] leading-tight"
          aria-hidden="true"
          style={{ color: retry && flickerBad ? DANGER : "var(--color-ink-faint, #7c8aa0)" }}
        >
          {retry && flickerBad
            ? "Make the CLOSE distance bigger than the OPEN distance — leave a gap."
            : won
              ? "Smooth! That gap is called hysteresis."
              : closeAt <= openAt
                ? "Tip: CLOSE should be FARTHER than OPEN, or the lid can chatter."
                : "Press Test: the hand glides in, wobbles at 22cm, then leaves."}
        </p>

        {/* ── Controls: TEST · Reset ── */}
        <div className="mt-1 flex items-stretch gap-2">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              runTest();
            }}
            disabled={testing}
            aria-label="Test — auto-play the hand and check the lid for flicker"
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition active:scale-95 disabled:opacity-50"
            style={{
              touchAction: "none",
              background: ACCENT,
              color: "#04130d",
              boxShadow: "0 5px 0 0 #15916a",
            }}
          >
            <span aria-hidden="true">{testing ? "🤚" : "▶"}</span>
            <span aria-hidden="true" className="font-extrabold tracking-wide">
              {testing ? "TESTING…" : "TEST"}
            </span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              reset();
            }}
            disabled={testing}
            aria-label="Reset the test"
            className="grid h-[52px] w-[52px] place-items-center rounded-2xl text-xl transition active:scale-90 disabled:opacity-40"
            style={{
              touchAction: "none",
              background: "rgba(255,255,255,0.05)",
              border: "2px solid var(--color-line, #33405c)",
            }}
          >
            <span aria-hidden="true">🔄</span>
          </button>
        </div>
      </div>

      {/* celebratory floaters when solved */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-2 text-2xl">
          <span className="animate-float" aria-hidden="true">
            ✨
          </span>
          <span
            className="animate-float"
            style={{ animationDelay: "0.2s" }}
            aria-hidden="true"
          >
            🎉
          </span>
          <span
            className="animate-float"
            style={{ animationDelay: "0.4s" }}
            aria-hidden="true"
          >
            ✨
          </span>
        </div>
      )}

      <style>{`
        @keyframes g6contactlessbinlid-nudge {
          0%, 100% { opacity: 0.5; transform: translateX(-2px); }
          50% { opacity: 1; transform: translateX(2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
