"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Smart Parking System 🅿️ ────────────────────────────────────────────────
   GRADE 4 (explorer, age ~9-11). Subject: AI.
   LEARNING GOAL: an ultrasonic sensor turns echo TIME into a DISTANCE number,
   and ONE threshold rule (IF distance < T → FULL, ELSE empty) classifies every
   bay. The real problem: choose T yourself so the rule separates the bays with
   cars from the empty ones — across THREE escalating lots.

   Step 1 — BUILD THE SENSOR (teaching): drag a car in a demo bay; the readout
     shows echo time × speed ÷ 2 = distance, so kids learn "closer = smaller cm".

   Step 2 — CALIBRATE (the real problem, 3 rounds): each round is a fresh lot.
     Press READ to fire every sensor and reveal the distances (predict→run→
     reveal). Then DRAG the threshold T and press SET RULE. The rule passes only
     when every car-bay reads FULL and every empty bay reads empty — i.e. T must
     sit in the GAP: above the FARTHEST car but at/below the NEAREST empty bay.
     The valid band is NOT drawn — the learner must read the numbers and reason.

   WHY IT'S A PROBLEM, NOT A TOY (guess-defeating):
     • Round 1 — a comfortable gap (cars ≤ 22, empties ≥ 40): learn the idea.
     • Round 2 — a DECOY far car at 38 cm that is still occupied, so "small T"
       fails; the gap shrinks to 38–48. You must look at every bay.
     • Round 3 — a TIGHT gap (cars up to 30, nearest empty 34): only T in 31–34
       works. Sloppy guesses miss; you must compute the gap.

   STARS (optimization): solve all three rounds with no failed SET RULE attempt
     for ⭐⭐⭐. A few stumbles still wins, at ⭐⭐ or ⭐. Deterministic, always
     winnable: every round has a non-empty valid band of integer thresholds.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#a855f7";
const FULL_RED = "#f87171";
const EMPTY_GREEN = "#34d399";

/** Speed of sound used for the readout, in cm per microsecond (~343 m/s). */
const SPEED_CM_PER_US = 0.0343;

/* ── Step 1: the demo bay where the learner drags a car ─────────────────────── */
const DEMO_MIN_CM = 8;
const DEMO_MAX_CM = 60;
const DEMO_START_CM = 40;

/* ── Step 2: the threshold the learner chooses, in cm ───────────────────────── */
const THRESH_MIN = 5;
const THRESH_MAX = 60;

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Round-trip echo time in microseconds for a one-way distance. */
const echoTimeUs = (distanceCm: number): number =>
  (2 * distanceCm) / SPEED_CM_PER_US;

/* ── The three escalating lots ──────────────────────────────────────────────── */
interface Bay {
  id: number;
  /** True distance the sensor reads, in cm (deterministic). */
  distanceCm: number;
  /** Ground truth: is a car actually parked here? */
  occupied: boolean;
}
interface Round {
  bays: readonly Bay[];
  /** Sensible starting position for the threshold marker. */
  startT: number;
  /** Plain-language nudge about what makes this round tricky. */
  note: string;
}

/* For a valid threshold T (FULL when distance < T): every occupied bay needs
   distance < T  → T > max(occupied distances); every empty bay needs
   distance ≥ T  → T ≤ min(empty distances). So the valid band is
   ( maxCar , minEmpty ].  Each round below has integers in that band. */
const ROUNDS: readonly Round[] = [
  {
    // Cars at 10 & 22, empties at 40 & 52  → valid T in 23..40. Comfortable gap.
    bays: [
      { id: 1, distanceCm: 10, occupied: true },
      { id: 2, distanceCm: 40, occupied: false },
      { id: 3, distanceCm: 22, occupied: true },
      { id: 4, distanceCm: 52, occupied: false },
    ],
    startT: 55,
    note: "Pick a number ABOVE every car, but not above the empty bays.",
  },
  {
    // DECOY: bay 4 holds a car parked FAR back at 38 cm. Empties at 48 & 55.
    // Cars 14, 30, 38 → valid T in 39..48. A small T would call bay 4 empty.
    bays: [
      { id: 1, distanceCm: 14, occupied: true },
      { id: 2, distanceCm: 48, occupied: false },
      { id: 3, distanceCm: 30, occupied: true },
      { id: 4, distanceCm: 38, occupied: true },
      { id: 5, distanceCm: 55, occupied: false },
    ],
    startT: 25,
    note: "Watch out — one car is parked far back. Your T must catch it too.",
  },
  {
    // TIGHT gap: cars up to 30, nearest empty 34 → valid T in 31..34 only.
    bays: [
      { id: 1, distanceCm: 9, occupied: true },
      { id: 2, distanceCm: 34, occupied: false },
      { id: 3, distanceCm: 30, occupied: true },
      { id: 4, distanceCm: 50, occupied: false },
      { id: 5, distanceCm: 18, occupied: true },
    ],
    startT: 20,
    note: "Tight squeeze: the gap between the last car and the empty bay is small.",
  },
] as const;

/** Inclusive-exclusive valid band: T in (maxCar, minEmpty]. */
const validBand = (bays: readonly Bay[]): { lo: number; hi: number } => {
  const maxCar = Math.max(...bays.filter((b) => b.occupied).map((b) => b.distanceCm));
  const minEmpty = Math.min(...bays.filter((b) => !b.occupied).map((b) => b.distanceCm));
  // valid integers are maxCar+1 .. minEmpty
  return { lo: maxCar + 1, hi: minEmpty };
};

const isRuleValid = (bays: readonly Bay[], t: number): boolean =>
  bays.every((b) => (b.distanceCm < t) === b.occupied);

type Phase = "idle" | "reading" | "ruling" | "won";

interface BayResult {
  id: number;
  distanceCm: number;
  occupied: boolean;
  /** What the learner's rule decided. */
  predFull: boolean;
  /** Whether that matches the truth. */
  correct: boolean;
}

export default function SmartParking({ onComplete }: ActivityProps) {
  const [tab, setTab] = useState<1 | 2>(1);

  // ── Step 1 — demo car distance (drag) ──────────────────────────────────────
  const [demoCm, setDemoCm] = useState<number>(DEMO_START_CM);
  const [demoDragging, setDemoDragging] = useState<boolean>(false);

  // ── Step 2 — the round-based calibration problem ───────────────────────────
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(ROUNDS[0].startT);
  const [threshDragging, setThreshDragging] = useState<boolean>(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [distancesShown, setDistancesShown] = useState<boolean>(false); // READ done?
  const [readRevealed, setReadRevealed] = useState<number>(0); // bays read so far
  const [results, setResults] = useState<BayResult[] | null>(null);
  const [ruleRevealed, setRuleRevealed] = useState<number>(0); // bays graded so far
  const [stumbles, setStumbles] = useState<number>(0); // failed SET RULE attempts
  const [feedback, setFeedback] = useState<string>("");

  const demoTrackRef = useRef<HTMLDivElement | null>(null);
  const threshTrackRef = useRef<HTMLDivElement | null>(null);
  const reportedRef = useRef<boolean>(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const round = ROUNDS[roundIdx];
  const bays = round.bays;
  const won = phase === "won";

  const clearTimer = useCallback((): void => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  // ── derived readouts ────────────────────────────────────────────────────────
  const demoTimeUs = useMemo<number>(() => echoTimeUs(demoCm), [demoCm]);

  // ── pointer → value helpers (touch-first dragging) ──────────────────────────
  const pointerToCm = useCallback((clientX: number): number => {
    const el = demoTrackRef.current;
    if (!el) return DEMO_START_CM;
    const rect = el.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return Math.round(DEMO_MIN_CM + ratio * (DEMO_MAX_CM - DEMO_MIN_CM));
  }, []);

  const pointerToThreshold = useCallback((clientX: number): number => {
    const el = threshTrackRef.current;
    if (!el) return ROUNDS[0].startT;
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

  // ── Step 2 threshold drag ───────────────────────────────────────────────────
  const onThreshDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      if (won || phase === "reading" || phase === "ruling") return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setThreshDragging(true);
      setThreshold(pointerToThreshold(e.clientX));
    },
    [won, phase, pointerToThreshold],
  );
  const onThreshMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      if (!threshDragging) return;
      e.preventDefault();
      setThreshold(pointerToThreshold(e.clientX));
    },
    [threshDragging, pointerToThreshold],
  );
  const onThreshUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      if (!threshDragging) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      setThreshDragging(false);
    },
    [threshDragging],
  );

  // ── READ: fire every sensor, reveal the distances one at a time ─────────────
  const runRead = useCallback((): void => {
    if (won || phase === "reading" || phase === "ruling") return;
    clearTimer();
    setPhase("reading");
    setResults(null);
    setRuleRevealed(0);
    setReadRevealed(0);
    setFeedback("");

    const tick = (i: number): void => {
      setReadRevealed(i + 1);
      if (i + 1 < bays.length) {
        timer.current = setTimeout(() => tick(i + 1), 360);
        return;
      }
      timer.current = setTimeout(() => {
        setDistancesShown(true);
        setPhase("idle");
      }, 320);
    };
    timer.current = setTimeout(() => tick(0), 220);
  }, [won, phase, bays, clearTimer]);

  // ── SET RULE: grade the chosen threshold, reveal lights bay by bay ──────────
  const runRule = useCallback((): void => {
    if (won || phase === "reading" || phase === "ruling" || !distancesShown) return;
    clearTimer();
    setPhase("ruling");
    setRuleRevealed(0);
    setFeedback("");

    const computed: BayResult[] = bays.map((b) => {
      const predFull = b.distanceCm < threshold;
      return {
        id: b.id,
        distanceCm: b.distanceCm,
        occupied: b.occupied,
        predFull,
        correct: predFull === b.occupied,
      };
    });
    setResults(computed);
    const success = computed.every((r) => r.correct);

    const tick = (i: number): void => {
      setRuleRevealed(i + 1);
      if (i + 1 < computed.length) {
        timer.current = setTimeout(() => tick(i + 1), 300);
        return;
      }
      timer.current = setTimeout(() => {
        if (success) {
          if (roundIdx + 1 < ROUNDS.length) {
            // Advance to the next, harder lot.
            setFeedback("Rule works! Next lot loading…");
            timer.current = setTimeout(() => {
              const next = roundIdx + 1;
              setRoundIdx(next);
              setThreshold(ROUNDS[next].startT);
              setResults(null);
              setRuleRevealed(0);
              setReadRevealed(0);
              setDistancesShown(false);
              setFeedback("");
              setPhase("idle");
            }, 900);
          } else {
            setPhase("won");
          }
        } else {
          // Gentle retry — keep the distances, raise the stumble count.
          setStumbles((s) => s + 1);
          const wrong = computed.find((r) => !r.correct);
          if (wrong) {
            const shouldBe = wrong.occupied ? "FULL" : "empty";
            setFeedback(
              `Bay ${wrong.id} (${wrong.distanceCm} cm) should read ${shouldBe}. ` +
                "Slide T so every car is below it and every empty bay is at or above it.",
            );
          } else {
            setFeedback("Not quite — adjust T and try again.");
          }
          setPhase("idle");
        }
      }, 360);
    };
    timer.current = setTimeout(() => tick(0), 200);
  }, [won, phase, distancesShown, bays, threshold, roundIdx, clearTimer]);

  // ── Win celebration fires exactly once, stars from stumble count ────────────
  useEffect(() => {
    if (won && !reportedRef.current) {
      reportedRef.current = true;
      const stars: 1 | 2 | 3 = stumbles === 0 ? 3 : stumbles <= 2 ? 2 : 1;
      const detail =
        stumbles === 0
          ? "Perfect! You calibrated all three lots first try. 🅿️✨"
          : `All three lots calibrated with ${stumbles} retr${stumbles === 1 ? "y" : "ies"}.`;
      onComplete({ passed: true, stars, detail });
    }
  }, [won, stumbles, onComplete]);

  const reset = useCallback((): void => {
    clearTimer();
    reportedRef.current = false;
    setTab(1);
    setDemoCm(DEMO_START_CM);
    setDemoDragging(false);
    setRoundIdx(0);
    setThreshold(ROUNDS[0].startT);
    setThreshDragging(false);
    setPhase("idle");
    setDistancesShown(false);
    setReadRevealed(0);
    setResults(null);
    setRuleRevealed(0);
    setStumbles(0);
    setFeedback("");
  }, [clearTimer]);

  // ── small geometry for SVG visuals ──────────────────────────────────────────
  const demoRatio = (demoCm - DEMO_MIN_CM) / (DEMO_MAX_CM - DEMO_MIN_CM);
  const threshRatio = (threshold - THRESH_MIN) / (THRESH_MAX - THRESH_MIN);

  const busy = phase === "reading" || phase === "ruling";
  const band = useMemo(() => validBand(bays), [bays]);
  const freeCount = useMemo(
    () => bays.filter((b) => !b.occupied).length,
    [bays],
  );
  // Live free-space count from graded bays.
  const printedFree = useMemo<number>(() => {
    if (!results) return 0;
    return results.slice(0, ruleRevealed).filter((r) => !r.predFull).length;
  }, [results, ruleRevealed]);
  const ruleDone = results !== null && ruleRevealed >= bays.length;

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3 font-mono text-ink">
      {/* ── header / status pill ── */}
      <div
        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
        role="status"
        aria-live="polite"
        aria-label={
          won
            ? "Solved. All three lots calibrated."
            : tab === 1
              ? "Step 1: build the sensor"
              : `Step 2: calibrate lot ${roundIdx + 1} of ${ROUNDS.length}`
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
          {won
            ? "Smart Parking online!"
            : tab === 1
              ? "Build the sensor"
              : `Calibrate · Lot ${roundIdx + 1}/${ROUNDS.length}`}
        </span>
        {won ? (
          <span aria-hidden="true" className="text-lg">
            {stumbles === 0 ? "⭐⭐⭐" : stumbles <= 2 ? "⭐⭐" : "⭐"}
          </span>
        ) : (
          tab === 2 && (
            <span className="flex gap-1" aria-hidden="true">
              {ROUNDS.map((_, i) => (
                <span
                  key={i}
                  className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold"
                  style={{
                    background:
                      i < roundIdx
                        ? EMPTY_GREEN
                        : i === roundIdx
                          ? ACCENT
                          : "rgba(255,255,255,0.08)",
                    color: i <= roundIdx ? "#0b0410" : "#9aa6b2",
                  }}
                >
                  {i < roundIdx ? "✓" : i + 1}
                </span>
              ))}
            </span>
          )
        )}
      </div>

      {/* ── step tabs ── */}
      <div className="flex gap-1" role="tablist" aria-label="Lab steps">
        {([1, 2] as const).map((s) => {
          const active = tab === s;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={s === 1 ? "Step 1: build the sensor" : "Step 2: calibrate the lots"}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!won && !busy) setTab(s);
              }}
              disabled={won || busy}
              className="flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition disabled:opacity-60"
              style={{
                background: active ? ACCENT : "rgba(255,255,255,0.05)",
                color: active ? "#0b0410" : "var(--color-ink-dim, #9aa6b2)",
                border: `2px solid ${active ? ACCENT : "var(--color-line, #33405c)"}`,
              }}
            >
              {s === 1 ? "1 · Sense" : "2 · Calibrate"}
            </button>
          );
        })}
      </div>

      {/* ════════ STEP 1 — BUILD THE SENSOR ════════ */}
      {tab === 1 && (
        <div className="panel flex flex-col gap-2 rounded-xl border border-line p-3">
          <p className="text-[11px] leading-snug text-ink-dim">
            Drag the car along the bay. The sensor fires a pulse that bounces
            back — its <b style={{ color: ACCENT }}>echo time</b> becomes a{" "}
            <b style={{ color: ACCENT }}>distance</b>. Learn this, then go
            calibrate the real lots →
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

            <rect x={8} y={20} width={284} height={80} rx={8} fill="#141b2c" stroke="#2b3650" strokeWidth={2} />
            <rect x={8} y={20} width={14} height={80} rx={6} fill="#202b44" />

            <circle cx={20} cy={60} r={8} fill={ACCENT} stroke="#0b0410" strokeWidth={1.5} />
            <text x={20} y={61} fontSize={9} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
              📡
            </text>

            <path
              d="M 22 60 L 150 30 L 150 90 Z"
              fill="url(#g4smartparking-cone)"
              opacity={0.4 + (1 - demoRatio) * 0.5}
            />

            <circle
              cx={24}
              cy={60}
              r={4}
              fill={ACCENT}
              style={{ animation: "g4smartparking-pulse 1.6s linear infinite" }}
            >
              <animate attributeName="opacity" values="0;1;1;0" dur="1.6s" repeatCount="indefinite" />
            </circle>

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

          <div className="rounded-lg bg-black/30 p-2 text-[11px] leading-relaxed">
            <div className="text-ink-dim">
              echo time = <span style={{ color: ACCENT }}>{demoTimeUs.toFixed(0)} µs</span>
            </div>
            <div className="text-ink-dim">distance = time × speed ÷ 2</div>
            <div className="text-ink-dim">
              = {demoTimeUs.toFixed(0)} × {SPEED_CM_PER_US} ÷ 2 ={" "}
              <span className="font-bold" style={{ color: ACCENT }}>
                {demoCm} cm
              </span>
            </div>
          </div>
          <p className="text-[11px] text-ink-faint">
            Closer car → shorter time → smaller cm. A bay with a car reads a SMALL
            number; an empty bay reads a BIG one.
          </p>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setTab(2);
            }}
            aria-label="Go to step 2, calibrate the lots"
            className="mt-1 flex h-11 items-center justify-center rounded-xl text-sm font-extrabold transition active:scale-95"
            style={{ background: ACCENT, color: "#0b0410", boxShadow: "0 5px 0 0 #7c3aed" }}
          >
            Calibrate the lots →
          </button>
        </div>
      )}

      {/* ════════ STEP 2 — CALIBRATE (3 rounds) ════════ */}
      {tab === 2 && (
        <div className="panel flex flex-col gap-3 rounded-xl border border-line p-3">
          <p className="text-[11px] leading-snug text-ink-dim">
            <b style={{ color: ACCENT }}>1.</b> Press READ to fire every sensor.{" "}
            <b style={{ color: ACCENT }}>2.</b> Slide <b>T</b> so the rule marks
            every car-bay <b style={{ color: FULL_RED }}>FULL</b> and every empty
            bay <b style={{ color: EMPTY_GREEN }}>empty</b>.{" "}
            <b style={{ color: ACCENT }}>3.</b> Press SET RULE.
          </p>

          {!won && (
            <p className="rounded bg-black/20 px-2 py-1 text-[11px]" style={{ color: ACCENT }}>
              Lot {roundIdx + 1}: {round.note}
            </p>
          )}

          {/* top-down car park */}
          <svg
            viewBox={`0 0 300 130`}
            className="block w-full"
            role="img"
            aria-label={`Car park lot ${roundIdx + 1} with ${bays.length} bays`}
          >
            {bays.map((bay, i) => {
              const readShown = readRevealed > i;
              const r = results && ruleRevealed > i ? results[i] : null;
              const lit = r !== null;
              const full = r?.predFull ?? false;
              const lightColor = !lit ? "#33415c" : full ? FULL_RED : EMPTY_GREEN;
              const slotW = 300 / bays.length;
              const pad = 6;
              const x = i * slotW + pad;
              const w = slotW - pad * 2;
              const cx = x + w / 2;
              return (
                <g key={bay.id}>
                  <rect
                    x={x}
                    y={18}
                    width={w}
                    height={94}
                    rx={7}
                    fill="#141b2c"
                    stroke={lit ? lightColor : "#2b3650"}
                    strokeWidth={lit ? 2.5 : 2}
                    style={{
                      filter: lit ? `drop-shadow(0 0 6px ${lightColor})` : undefined,
                      transition: "stroke .25s ease",
                    }}
                  />
                  {/* sensor at the back wall */}
                  <circle cx={cx} cy={26} r={5} fill={ACCENT} />
                  {/* status light */}
                  <circle
                    cx={cx}
                    cy={100}
                    r={6}
                    fill={lightColor}
                    style={{ transition: "fill .25s ease" }}
                  />
                  {/* the actual car (truth) */}
                  {bay.occupied && (
                    <text x={cx} y={60} fontSize={22} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                      🚙
                    </text>
                  )}
                  {/* bay number */}
                  <text x={cx} y={14} fontSize={8} textAnchor="middle" fill="#9aa6b2">
                    Bay {bay.id}
                  </text>
                  {/* the READ distance number */}
                  {readShown && (
                    <text
                      x={cx}
                      y={84}
                      fontSize={11}
                      fontWeight={700}
                      textAnchor="middle"
                      fill={ACCENT}
                    >
                      {bay.distanceCm}cm
                    </text>
                  )}
                  {/* tick / cross once graded */}
                  {lit && (
                    <text x={x + w - 8} y={30} fontSize={12} textAnchor="middle" aria-hidden="true">
                      {r?.correct ? "✓" : "✗"}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* THE RULE line + threshold rail (no give-away band) */}
          <div className="rounded-lg bg-black/30 p-2 text-center text-[13px] font-bold">
            <span className="text-ink-dim">IF distance &lt; </span>
            <span
              className="mx-1 inline-block min-w-[42px] rounded px-1"
              style={{ color: ACCENT, background: "rgba(168,85,247,0.14)" }}
            >
              {threshold} cm
            </span>
            <span style={{ color: FULL_RED }}>→ FULL</span>
            <span className="text-ink-faint"> · ELSE </span>
            <span style={{ color: EMPTY_GREEN }}>empty</span>
          </div>

          <div
            ref={threshTrackRef}
            onPointerDown={onThreshDown}
            onPointerMove={onThreshMove}
            onPointerUp={onThreshUp}
            onPointerCancel={onThreshUp}
            className="relative h-10 w-full cursor-grab rounded-full"
            style={{
              touchAction: "none",
              background: "rgba(255,255,255,0.06)",
              opacity: distancesShown && !won ? 1 : 0.5,
            }}
            role="slider"
            aria-label="Distance threshold T for the FULL rule, in centimetres"
            aria-valuemin={THRESH_MIN}
            aria-valuemax={THRESH_MAX}
            aria-valuenow={threshold}
            tabIndex={0}
          >
            {/* faint distance ticks once READ, so the kid can reason about the gap */}
            {distancesShown &&
              bays.map((b) => {
                const pct =
                  ((b.distanceCm - THRESH_MIN) / (THRESH_MAX - THRESH_MIN)) * 100;
                return (
                  <div
                    key={b.id}
                    className="absolute top-0 h-full w-[2px]"
                    style={{
                      left: `${pct}%`,
                      background: b.occupied
                        ? "rgba(248,113,113,0.55)"
                        : "rgba(52,211,153,0.55)",
                    }}
                    aria-hidden="true"
                  />
                );
              })}
            {/* marker */}
            <div
              className="absolute top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-xs font-bold"
              style={{
                left: `calc(${threshRatio * 100}% - 18px)`,
                background: ACCENT,
                color: "#0b0410",
                transition: threshDragging ? "none" : "left 120ms ease-out",
                boxShadow: `0 0 10px ${ACCENT}88`,
              }}
              aria-hidden="true"
            >
              {threshold}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-ink-faint">
            <span>{THRESH_MIN} cm</span>
            {distancesShown && (
              <span aria-hidden="true">
                <span style={{ color: FULL_RED }}>▏car</span>{" "}
                <span style={{ color: EMPTY_GREEN }}>▏empty</span>
              </span>
            )}
            <span>{THRESH_MAX} cm</span>
          </div>

          {/* serial-style display */}
          <div
            className="rounded-lg bg-black/40 p-2 text-[11px] leading-relaxed"
            role="log"
            aria-label="Serial monitor output"
          >
            <div className="text-ink-faint">— serial monitor —</div>
            {!distancesShown && phase !== "reading" && (
              <div className="text-ink-faint">press READ to fire the sensors…</div>
            )}
            {phase === "reading" &&
              bays.slice(0, readRevealed).map((b) => (
                <div key={b.id} className="text-ink-dim">
                  Bay {b.id}: reading… {b.distanceCm} cm
                </div>
              ))}
            {distancesShown && phase !== "reading" && !results && (
              <div className="text-ink-dim">
                distances locked in. Set T, then press SET RULE.
              </div>
            )}
            {results &&
              ruleRevealed > 0 &&
              results.slice(0, ruleRevealed).map((r) => (
                <div key={r.id} style={{ color: r.predFull ? FULL_RED : EMPTY_GREEN }}>
                  Bay {r.id}: {r.distanceCm} cm → {r.predFull ? "FULL" : "empty"}{" "}
                  {r.correct ? "✓" : "✗"}
                </div>
              ))}
            {ruleDone && (
              <div
                className="mt-1 font-bold"
                style={{
                  color: results!.every((r) => r.correct) ? EMPTY_GREEN : ACCENT,
                }}
              >
                Spaces free: {printedFree}
                {results!.every((r) => r.correct) ? " ✓" : ` (truth: ${freeCount})`}
              </div>
            )}
            {feedback && (
              <div className="mt-1" style={{ color: ACCENT }}>
                {feedback}
              </div>
            )}
          </div>

          {/* READ + SET RULE buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                runRead();
              }}
              disabled={won || busy}
              aria-label="Read all sensors in this lot"
              className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition active:scale-95 disabled:opacity-50"
              style={{
                touchAction: "none",
                background: "rgba(255,255,255,0.06)",
                color: ACCENT,
                border: `2px solid ${ACCENT}`,
              }}
            >
              <span aria-hidden="true">{phase === "reading" ? "📡" : "📏"}</span>
              {phase === "reading" ? "READING…" : "READ"}
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                runRule();
              }}
              disabled={won || busy || !distancesShown}
              aria-label="Apply your threshold rule to every bay"
              className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition active:scale-95 disabled:opacity-50"
              style={{ touchAction: "none", background: ACCENT, color: "#0b0410", boxShadow: "0 5px 0 0 #7c3aed" }}
            >
              <span aria-hidden="true">{phase === "ruling" ? "⚙️" : "▶"}</span>
              {phase === "ruling" ? "CHECKING…" : "SET RULE"}
            </button>
          </div>
          {/* Tiny reasoning aid (does NOT reveal the answer band directly):
              reminds the learner of the rule of thumb. */}
          {distancesShown && !won && (
            <p className="text-[10px] text-ink-faint">
              Tip: T must be just above the FARTHEST red car line, but not past
              the NEAREST green empty line.
            </p>
          )}
        </div>
      )}

      {/* ── footer: reset (band-style nav lives inside step 1 button) ── */}
      <div className="flex items-center gap-2">
        {tab === 2 && !won && !busy && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setTab(1);
            }}
            aria-label="Back to step 1"
            className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs font-medium text-ink-dim"
          >
            ← Sensor
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
