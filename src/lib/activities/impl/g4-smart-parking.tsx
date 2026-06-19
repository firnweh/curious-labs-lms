"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Smart Parking System 🅿️ ────────────────────────────────────────────────
   GRADE 4 (explorer, age ~10). Subject: AI.
   ONE learning goal: an ultrasonic sensor turns echo TIME into a DISTANCE
   number, and a single rule (IF distance < threshold → FULL, ELSE empty)
   classifies each parking bay so the system can count free spaces.

   Three guided steps:
     1) BUILD THE SENSOR — drag a car nearer/farther in a demo bay; a pulse
        bounces and the readout shows time × speed of sound ÷ 2 = distance.
     2) SET THE RULE — drag a threshold marker; 20 cm sits in a valid band.
     3) RUN THE LOT — SCAN sweeps 3 bays (12 cm, 55 cm, 8 cm), applies the
        learner's rule, lights each red/green and prints "Spaces free: X".

   WIN: lights match true occupancy (FULL, empty, FULL) AND free count = 1.
   Deterministic & always winnable: the fixed car layout + the valid 14–28 cm
   band guarantee a solution; a hint flashes bay 2's true distance (55 cm).
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#a855f7";
const FULL_RED = "#f87171";
const EMPTY_GREEN = "#34d399";

/** Speed of sound used for the readout, in cm per microsecond (~343 m/s). */
const SPEED_CM_PER_US = 0.0343;

/* ── Step 1: the demo bay where the learner drags a car ─────────────────────── */
const DEMO_MIN_CM = 8; // car pushed right up to the sensor
const DEMO_MAX_CM = 60; // car at the far end of the bay
const DEMO_START_CM = 40;

/* ── Step 2: the threshold the learner chooses, in cm ───────────────────────── */
const THRESH_MIN = 5;
const THRESH_MAX = 60;
const THRESH_START = 58; // a wrong start: 55 cm < 58 marks the EMPTY bay FULL
const BAND_LO = 14; // valid band: a car (≤12) is FULL, empty (55) stays empty
const BAND_HI = 28;
const isThresholdValid = (t: number): boolean => t >= BAND_LO && t <= BAND_HI;

/* ── Step 3: the fixed lot. Bay 2 is empty; bays 1 & 3 hold cars. ───────────── */
interface Bay {
  id: number;
  /** True distance the sensor reads, in cm (deterministic). */
  distanceCm: number;
  /** Ground truth: is a car actually parked here? */
  occupied: boolean;
}
const LOT: readonly Bay[] = [
  { id: 1, distanceCm: 12, occupied: true },
  { id: 2, distanceCm: 55, occupied: false },
  { id: 3, distanceCm: 8, occupied: true },
] as const;
const TRUE_FREE = LOT.filter((b) => !b.occupied).length; // = 1

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Round-trip echo time in microseconds for a one-way distance. */
const echoTimeUs = (distanceCm: number): number =>
  (2 * distanceCm) / SPEED_CM_PER_US;

type Step = 1 | 2 | 3;
type Phase = "idle" | "scanning" | "won";

interface BayResult {
  id: number;
  distanceCm: number;
  /** What the learner's rule decided. */
  predFull: boolean;
  /** Whether that matches the truth. */
  correct: boolean;
}

export default function SmartParking({ onComplete }: ActivityProps) {
  const [step, setStep] = useState<Step>(1);

  // Step 1 — demo car distance (drag).
  const [demoCm, setDemoCm] = useState<number>(DEMO_START_CM);
  const [demoDragging, setDemoDragging] = useState<boolean>(false);

  // Step 2 — chosen threshold (drag).
  const [threshold, setThreshold] = useState<number>(THRESH_START);
  const [threshDragging, setThreshDragging] = useState<boolean>(false);

  // Step 3 — scan run.
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<BayResult[] | null>(null);
  const [revealed, setRevealed] = useState<number>(0); // bays printed so far
  const [showTruth, setShowTruth] = useState<boolean>(false); // hint flash

  const demoTrackRef = useRef<HTMLDivElement | null>(null);
  const threshTrackRef = useRef<HTMLDivElement | null>(null);
  const reportedRef = useRef<boolean>(false);
  const sweepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const won = phase === "won";

  // ── derived readouts ──────────────────────────────────────────────────────
  const demoTimeUs = useMemo<number>(() => echoTimeUs(demoCm), [demoCm]);
  const threshValid = isThresholdValid(threshold);

  const clearSweep = useCallback((): void => {
    if (sweepTimer.current !== null) {
      clearTimeout(sweepTimer.current);
      sweepTimer.current = null;
    }
  }, []);
  useEffect(() => () => clearSweep(), [clearSweep]);

  /** Apply the learner's rule to one distance: FULL when distance < threshold. */
  const classify = useCallback(
    (distanceCm: number): boolean => distanceCm < threshold,
    [threshold],
  );

  // ── pointer → value helpers (touch-first dragging on a horizontal rail) ─────
  const pointerToCm = useCallback((clientX: number): number => {
    const el = demoTrackRef.current;
    if (!el) return DEMO_START_CM;
    const rect = el.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    // Left of the rail = near the sensor (small cm); right = far (large cm).
    const cm = DEMO_MIN_CM + ratio * (DEMO_MAX_CM - DEMO_MIN_CM);
    return Math.round(cm);
  }, []);

  const pointerToThreshold = useCallback((clientX: number): number => {
    const el = threshTrackRef.current;
    if (!el) return THRESH_START;
    const rect = el.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return Math.round(THRESH_MIN + ratio * (THRESH_MAX - THRESH_MIN));
  }, []);

  // ── Step 1 drag handlers ────────────────────────────────────────────────────
  const onDemoDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDemoDragging(true);
      setDemoCm(pointerToCm(e.clientX));
    },
    [pointerToCm],
  );
  const onDemoMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      if (!demoDragging) return;
      e.preventDefault();
      setDemoCm(pointerToCm(e.clientX));
    },
    [demoDragging, pointerToCm],
  );
  const onDemoUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      if (!demoDragging) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      setDemoDragging(false);
    },
    [demoDragging],
  );

  // ── Step 2 drag handlers ────────────────────────────────────────────────────
  const onThreshDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      if (won) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setThreshDragging(true);
      setThreshold(pointerToThreshold(e.clientX));
      setResults(null);
      setPhase("idle");
    },
    [won, pointerToThreshold],
  );
  const onThreshMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      if (!threshDragging || won) return;
      e.preventDefault();
      setThreshold(pointerToThreshold(e.clientX));
    },
    [threshDragging, won, pointerToThreshold],
  );
  const onThreshUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      if (!threshDragging) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      setThreshDragging(false);
    },
    [threshDragging],
  );

  // ── Step 3: SCAN — sweep each bay, classify, print one line at a time ───────
  const runScan = useCallback((): void => {
    if (won) return;
    clearSweep();
    setShowTruth(false);
    setPhase("scanning");
    setRevealed(0);

    const computed: BayResult[] = LOT.map((b) => {
      const predFull = b.distanceCm < threshold;
      return {
        id: b.id,
        distanceCm: b.distanceCm,
        predFull,
        correct: predFull === b.occupied,
      };
    });
    setResults(computed);

    const allCorrect = computed.every((r) => r.correct);
    const freeCount = computed.filter((r) => !r.predFull).length;
    const success = allCorrect && freeCount === TRUE_FREE;

    // Reveal bays one at a time, serial-monitor style.
    const tick = (i: number): void => {
      setRevealed(i + 1);
      if (i + 1 < computed.length) {
        sweepTimer.current = setTimeout(() => tick(i + 1), 520);
        return;
      }
      // Last bay printed — settle the outcome.
      sweepTimer.current = setTimeout(() => {
        if (success) {
          setPhase("won");
        } else {
          setPhase("idle");
          // Flash the empty bay's true distance as a gentle hint.
          setShowTruth(true);
          if (!reportedRef.current) {
            const wrongBay = computed.find((r) => !r.correct);
            const why = wrongBay
              ? `Bay ${wrongBay.id} at ${wrongBay.distanceCm} cm got it wrong — nudge the threshold.`
              : "Spaces-free count is off — re-check the threshold.";
            onComplete({ passed: false, detail: why });
          }
        }
      }, 420);
    };
    sweepTimer.current = setTimeout(() => tick(0), 240);
  }, [won, threshold, clearSweep, onComplete]);

  // ── Win celebration fires exactly once ──────────────────────────────────────
  useEffect(() => {
    if (won && !reportedRef.current) {
      reportedRef.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail:
          "Sensors → distances → rule → lights! Spaces free reads 1. 🅿️✨",
      });
    }
  }, [won, onComplete]);

  const reset = useCallback((): void => {
    clearSweep();
    reportedRef.current = false;
    setStep(1);
    setDemoCm(DEMO_START_CM);
    setDemoDragging(false);
    setThreshold(THRESH_START);
    setThreshDragging(false);
    setPhase("idle");
    setResults(null);
    setRevealed(0);
    setShowTruth(false);
  }, [clearSweep]);

  // ── Live free-space count from the (possibly partial) printed bays ──────────
  const printedFree = useMemo<number>(() => {
    if (!results) return 0;
    return results
      .slice(0, revealed)
      .filter((r) => !r.predFull).length;
  }, [results, revealed]);

  const scanDone = results !== null && revealed >= LOT.length;

  // ── small geometry for SVG visuals ──────────────────────────────────────────
  // Demo bay: maps cm → x so the car slides along the bay toward the sensor.
  const demoRatio = (demoCm - DEMO_MIN_CM) / (DEMO_MAX_CM - DEMO_MIN_CM);
  const threshRatio = (threshold - THRESH_MIN) / (THRESH_MAX - THRESH_MIN);
  const bandLoPct = ((BAND_LO - THRESH_MIN) / (THRESH_MAX - THRESH_MIN)) * 100;
  const bandHiPct = ((BAND_HI - THRESH_MIN) / (THRESH_MAX - THRESH_MIN)) * 100;

  const stepTitle: Record<Step, string> = {
    1: "Step 1 · Build the sensor",
    2: "Step 2 · Set the rule",
    3: "Step 3 · Run the lot",
  };

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      {/* ── header / status pill ── */}
      <div
        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "Solved. All bay lights match and spaces free reads 1."
            : stepTitle[step]
        }
        style={{
          background: won ? "rgba(168,85,247,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <span aria-hidden="true" className="text-lg">
            🅿️
          </span>
          {won ? "Smart Parking online!" : stepTitle[step]}
        </span>
        {won && (
          <span aria-hidden="true" className="text-lg">
            ⭐⭐⭐
          </span>
        )}
      </div>

      {/* ── step tabs ── */}
      <div className="flex gap-1" role="tablist" aria-label="Lab steps">
        {([1, 2, 3] as Step[]).map((s) => {
          const active = step === s;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={stepTitle[s]}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!won) setStep(s);
              }}
              disabled={won}
              className="flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition disabled:opacity-60"
              style={{
                background: active ? ACCENT : "rgba(255,255,255,0.05)",
                color: active ? "#0b0410" : "var(--color-ink-dim, #9aa6b2)",
                border: `2px solid ${active ? ACCENT : "var(--color-line, #33405c)"}`,
              }}
            >
              {s === 1 ? "1 · Sense" : s === 2 ? "2 · Rule" : "3 · Scan"}
            </button>
          );
        })}
      </div>

      {/* ════════ STEP 1 — BUILD THE SENSOR ════════ */}
      {step === 1 && (
        <div className="panel flex flex-col gap-2 rounded-xl border border-line p-3">
          <p className="text-[11px] leading-snug text-ink-dim">
            Drag the car along the bay. The sensor fires a pulse that bounces
            back — its <b style={{ color: ACCENT }}>echo time</b> becomes a{" "}
            <b style={{ color: ACCENT }}>distance</b>.
          </p>

          <svg
            viewBox="0 0 300 120"
            className="block w-full select-none"
            role="img"
            aria-label={`Demo bay: car at ${demoCm} centimetres from the sensor`}
          >
            <defs>
              <radialGradient id="g4smartparking-cone" cx="0%" cy="50%" r="100%">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.5" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* bay floor + back wall (sensor lives on the wall, left side) */}
            <rect x={8} y={20} width={284} height={80} rx={8} fill="#141b2c" stroke="#2b3650" strokeWidth={2} />
            <rect x={8} y={20} width={14} height={80} rx={6} fill="#202b44" />

            {/* sensor on the wall */}
            <circle cx={20} cy={60} r={8} fill={ACCENT} stroke="#0b0410" strokeWidth={1.5} />
            <text x={20} y={61} fontSize={9} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
              📡
            </text>

            {/* echo cone, brighter the closer the car */}
            <path
              d="M 22 60 L 150 30 L 150 90 Z"
              fill="url(#g4smartparking-cone)"
              opacity={0.4 + (1 - demoRatio) * 0.5}
            />

            {/* travelling pulse (loops outward + back) */}
            <circle
              cx={24}
              cy={60}
              r={4}
              fill={ACCENT}
              style={{
                animation: "g4smartparking-pulse 1.6s linear infinite",
              }}
            >
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="1.6s"
                repeatCount="indefinite"
              />
            </circle>

            {/* draggable car */}
            <g
              style={{
                transform: `translateX(${22 + demoRatio * 230}px)`,
                transition: demoDragging ? "none" : "transform 120ms ease-out",
              }}
            >
              <rect x={-22} y={44} width={44} height={28} rx={6} fill="#3a2750" stroke={ACCENT} strokeWidth={2} />
              <text x={0} y={59} fontSize={20} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                🚗
              </text>
            </g>
          </svg>

          {/* drag rail */}
          <div
            ref={demoTrackRef}
            onPointerDown={onDemoDown}
            onPointerMove={onDemoMove}
            onPointerUp={onDemoUp}
            onPointerCancel={onDemoUp}
            className="relative h-9 w-full cursor-grab rounded-full"
            style={{ touchAction: "none", background: "rgba(255,255,255,0.06)" }}
            role="slider"
            aria-label="Car distance from sensor"
            aria-valuemin={DEMO_MIN_CM}
            aria-valuemax={DEMO_MAX_CM}
            aria-valuenow={demoCm}
            tabIndex={0}
          >
            <div
              className="absolute top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-base"
              style={{
                left: `calc(${demoRatio * 100}% - 16px)`,
                background: ACCENT,
                color: "#0b0410",
                transition: demoDragging ? "none" : "left 120ms ease-out",
              }}
              aria-hidden="true"
            >
              🚗
            </div>
          </div>

          {/* the echo-timing readout */}
          <div className="rounded-lg bg-black/30 p-2 text-[11px] leading-relaxed">
            <div className="text-ink-dim">
              echo time = <span style={{ color: ACCENT }}>{demoTimeUs.toFixed(0)} µs</span>
            </div>
            <div className="text-ink-dim">
              distance = time × speed ÷ 2
            </div>
            <div className="text-ink-dim">
              = {demoTimeUs.toFixed(0)} × {SPEED_CM_PER_US} ÷ 2 ={" "}
              <span className="font-bold" style={{ color: ACCENT }}>
                {demoCm} cm
              </span>
            </div>
          </div>
          <p className="text-[11px] text-ink-faint">
            Closer car → shorter time → smaller distance. Now set the rule →
          </p>
        </div>
      )}

      {/* ════════ STEP 2 — SET THE RULE ════════ */}
      {step === 2 && (
        <div className="panel flex flex-col gap-3 rounded-xl border border-line p-3">
          <p className="text-[11px] leading-snug text-ink-dim">
            Drag the marker to finish the rule. A bay is{" "}
            <b style={{ color: FULL_RED }}>FULL</b> when something is closer than
            your number; otherwise it&apos;s{" "}
            <b style={{ color: EMPTY_GREEN }}>empty</b>.
          </p>

          <div className="rounded-lg bg-black/30 p-2 text-center text-[13px] font-bold">
            <span className="text-ink-dim">IF distance &lt; </span>
            <span
              className="mx-1 inline-block min-w-[42px] rounded px-1"
              style={{
                color: threshValid ? EMPTY_GREEN : ACCENT,
                background: "rgba(168,85,247,0.14)",
              }}
            >
              {threshold} cm
            </span>
            <span style={{ color: FULL_RED }}>→ FULL</span>
            <span className="text-ink-faint"> · ELSE </span>
            <span style={{ color: EMPTY_GREEN }}>empty</span>
          </div>

          {/* threshold rail with a highlighted valid band */}
          <div
            ref={threshTrackRef}
            onPointerDown={onThreshDown}
            onPointerMove={onThreshMove}
            onPointerUp={onThreshUp}
            onPointerCancel={onThreshUp}
            className="relative h-10 w-full cursor-grab rounded-full"
            style={{ touchAction: "none", background: "rgba(255,255,255,0.06)" }}
            role="slider"
            aria-label="Distance threshold for the FULL rule, in centimetres"
            aria-valuemin={THRESH_MIN}
            aria-valuemax={THRESH_MAX}
            aria-valuenow={threshold}
            tabIndex={0}
          >
            {/* valid band */}
            <div
              className="absolute top-0 h-full rounded"
              style={{
                left: `${bandLoPct}%`,
                width: `${bandHiPct - bandLoPct}%`,
                background: "rgba(52,211,153,0.20)",
                border: "1px dashed rgba(52,211,153,0.7)",
              }}
              aria-hidden="true"
            />
            {/* marker */}
            <div
              className="absolute top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-xs font-bold"
              style={{
                left: `calc(${threshRatio * 100}% - 18px)`,
                background: threshValid ? EMPTY_GREEN : ACCENT,
                color: "#0b0410",
                transition: threshDragging ? "none" : "left 120ms ease-out",
                boxShadow: threshValid ? `0 0 12px ${EMPTY_GREEN}88` : undefined,
              }}
              aria-hidden="true"
            >
              {threshold}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-ink-faint">
            <span>{THRESH_MIN} cm</span>
            <span style={{ color: EMPTY_GREEN }}>good band</span>
            <span>{THRESH_MAX} cm</span>
          </div>

          <p className="text-[11px]" style={{ color: threshValid ? EMPTY_GREEN : ACCENT }}>
            {threshValid
              ? "Nice — that lands in the good band. Go run the lot → "
              : "Land the marker inside the green band, then run the lot."}
          </p>
        </div>
      )}

      {/* ════════ STEP 3 — RUN THE LOT ════════ */}
      {step === 3 && (
        <div className="panel flex flex-col gap-3 rounded-xl border border-line p-3">
          <p className="text-[11px] leading-snug text-ink-dim">
            Three real bays. Press <b style={{ color: ACCENT }}>SCAN</b> — each
            sensor reads a distance, your rule sets the light, and the display
            counts free spaces.
          </p>

          {/* top-down car park */}
          <svg
            viewBox="0 0 300 130"
            className="block w-full"
            role="img"
            aria-label="Car park with three bays, each with a sensor and a status light"
          >
            {LOT.map((bay, i) => {
              const r = results && revealed > i ? results[i] : null;
              const lit = r !== null;
              const full = r?.predFull ?? false;
              const lightColor = !lit ? "#33415c" : full ? FULL_RED : EMPTY_GREEN;
              const x = 12 + i * 96;
              return (
                <g key={bay.id}>
                  {/* bay slot */}
                  <rect
                    x={x}
                    y={18}
                    width={84}
                    height={94}
                    rx={8}
                    fill="#141b2c"
                    stroke={lit ? lightColor : "#2b3650"}
                    strokeWidth={lit ? 2.5 : 2}
                    style={{
                      filter: lit ? `drop-shadow(0 0 6px ${lightColor})` : undefined,
                      transition: "stroke .25s ease",
                    }}
                  />
                  {/* sensor at the back wall */}
                  <circle cx={x + 42} cy={26} r={5} fill={ACCENT} />
                  {/* status light */}
                  <circle
                    cx={x + 42}
                    cy={100}
                    r={7}
                    fill={lightColor}
                    style={{ transition: "fill .25s ease" }}
                  />
                  {/* the actual car (truth) */}
                  {bay.occupied && (
                    <text x={x + 42} y={62} fontSize={26} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                      🚙
                    </text>
                  )}
                  {/* bay number */}
                  <text x={x + 42} y={14} fontSize={9} textAnchor="middle" fill="#9aa6b2">
                    Bay {bay.id}
                  </text>
                  {/* tick / cross once read */}
                  {lit && (
                    <text x={x + 70} y={30} fontSize={13} textAnchor="middle" aria-hidden="true">
                      {r?.correct ? "✓" : "✗"}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* serial-style display */}
          <div
            className="rounded-lg bg-black/40 p-2 text-[11px] leading-relaxed"
            role="log"
            aria-label="Serial monitor output"
          >
            <div className="text-ink-faint">— serial monitor —</div>
            {results && revealed > 0 ? (
              results.slice(0, revealed).map((r) => (
                <div key={r.id} style={{ color: r.predFull ? FULL_RED : EMPTY_GREEN }}>
                  Bay {r.id}: car at {r.distanceCm} cm →{" "}
                  {r.predFull ? "FULL" : "empty"} {r.correct ? "✓" : "✗"}
                </div>
              ))
            ) : (
              <div className="text-ink-faint">press SCAN to begin…</div>
            )}
            {scanDone && (
              <div className="mt-1 font-bold" style={{ color: won ? EMPTY_GREEN : ACCENT }}>
                Spaces free: {printedFree}
                {won ? " 🎉" : ` (need ${TRUE_FREE})`}
              </div>
            )}
            {showTruth && !won && (
              <div className="mt-1" style={{ color: ACCENT }}>
                hint → Bay 2 truly reads {LOT[1].distanceCm} cm (it&apos;s empty).
              </div>
            )}
          </div>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              runScan();
            }}
            disabled={won || phase === "scanning"}
            aria-label="Scan all three parking bays"
            className="flex h-[52px] items-center justify-center gap-2 rounded-xl text-base font-extrabold transition active:scale-95 disabled:opacity-50"
            style={{ touchAction: "none", background: ACCENT, color: "#0b0410", boxShadow: "0 5px 0 0 #7c3aed" }}
          >
            <span aria-hidden="true">{phase === "scanning" ? "📡" : "▶"}</span>
            {phase === "scanning" ? "SCANNING…" : "SCAN"}
          </button>
        </div>
      )}

      {/* ── footer: nav + reset ── */}
      <div className="flex items-center gap-2">
        {step > 1 && !won && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
            }}
            aria-label="Go to previous step"
            className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs font-medium text-ink-dim"
          >
            ← Back
          </button>
        )}
        {step < 3 && !won && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
            }}
            aria-label="Go to next step"
            className="rounded-lg px-3 py-2 text-xs font-bold"
            style={{ background: ACCENT, color: "#0b0410" }}
          >
            Next →
          </button>
        )}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            reset();
          }}
          aria-label="Reset the whole lab"
          className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-base transition active:scale-90"
          style={{ background: "rgba(255,255,255,0.05)", border: "2px solid var(--color-line, #33405c)" }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {/* ── win celebration ── */}
      {won && (
        <div className="pointer-events-none flex justify-center gap-3 text-2xl">
          <span className="animate-float" aria-hidden="true">✨</span>
          <span className="animate-float" style={{ animationDelay: "0.15s" }} aria-hidden="true">🎉</span>
          <span className="animate-float" style={{ animationDelay: "0.3s" }} aria-hidden="true">✨</span>
        </div>
      )}

      <style>{`
        @keyframes g4smartparking-pulse {
          0% { transform: translateX(0); }
          50% { transform: translateX(116px); }
          100% { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
