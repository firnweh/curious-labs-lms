"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ── Plant Watering Reminder 🪴 ───────────────────────────────────────────────
   GRADE 4 (explorer, age ~10–11). Subject: ROBOTICS.
   ONE learning goal: a soil-moisture sensor returns a NUMBER (0–1023), and TWO
   thresholds split that range into three zones — each zone triggers a different
   coloured alert (and a buzzer only for the urgent DRY zone). The learner builds
   the rule:  IF reading < L → RED + BUZZER, ELSE IF reading < H → YELLOW, ELSE GREEN.

   They drag a watering can (moisture rises) and a sun (moisture dries out) to feel
   the live reading move, then set the LOW and HIGH threshold sliders. Highlighted
   valid bands around 300 and 600 make it always solvable. Pressing TEST steps a
   fixed 3-state check — DRY (180), OK (450), WET (720) — lighting the LED the rule
   selects and sounding the buzzer only when DRY. A checklist verifies each state lit
   the right colour and the buzzer fired only when dry. WIN → onComplete once.
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399";
const SENSOR_MAX = 1023;

type Zone = "dry" | "ok" | "wet";

const ZONE_COLOR: Record<Zone, string> = {
  dry: "#f87171", // RED
  ok: "#fbbf24", // YELLOW
  wet: "#34d399", // GREEN
};
const ZONE_NAME: Record<Zone, string> = { dry: "RED", ok: "YELLOW", wet: "GREEN" };

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** The core rule: split a reading into a zone using LOW + HIGH thresholds. */
function zoneFor(reading: number, low: number, high: number): Zone {
  if (reading < low) return "dry";
  if (reading < high) return "ok";
  return "wet";
}

// ── The fixed 3-state test. Each reading is deterministic. ───────────────────
interface TestState {
  id: Zone;
  label: string;
  emoji: string;
  reading: number;
  /** The zone the soil REALLY is, so the buzzer should fire only on "dry". */
  want: Zone;
}

const STATES: readonly TestState[] = [
  { id: "dry", label: "Bone dry", emoji: "🏜️", reading: 180, want: "dry" },
  { id: "ok", label: "Just right", emoji: "🌱", reading: 450, want: "ok" },
  { id: "wet", label: "Nicely wet", emoji: "💧", reading: 720, want: "wet" },
];

// Valid threshold bands that make every test map correctly:
//   LOW must split 180 (dry) from 450 (ok)  → 181 ≤ LOW ≤ 450
//   HIGH must split 450 (ok) from 720 (wet) → 451 ≤ HIGH ≤ 720
// We highlight a comfortably-inside band around 300 and 600 so it's easy to hit.
const LOW_BAND_LO = 250;
const LOW_BAND_HI = 350;
const HIGH_BAND_LO = 550;
const HIGH_BAND_HI = 650;

const START_LOW = 120; // a wrong-ish start: would mislabel the dry soil
const START_HIGH = 880;

const MOISTURE_START = 500;
const POUR_STEP = 120;
const DRY_STEP = 110;

type Mark = "pass" | "fail" | "pending";

export default function PlantWateringReminder({ onComplete }: ActivityProps) {
  const [low, setLow] = useState<number>(START_LOW);
  const [high, setHigh] = useState<number>(START_HIGH);
  const [moisture, setMoisture] = useState<number>(MOISTURE_START);
  const [marks, setMarks] = useState<Record<Zone, Mark>>({
    dry: "pending",
    ok: "pending",
    wet: "pending",
  });
  const [buzzerMark, setBuzzerMark] = useState<Mark>("pending");
  const [checked, setChecked] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);
  const [hintShown, setHintShown] = useState<boolean>(false);

  const reportedRef = useRef<boolean>(false);

  // Keep LOW strictly below HIGH so the three zones never collapse.
  const setLowSafe = useCallback(
    (v: number): void => {
      if (won) return;
      setLow(() => clamp(v, 0, SENSOR_MAX));
      setHigh((h) => Math.max(h, clamp(v, 0, SENSOR_MAX) + 1));
      setChecked(false);
    },
    [won],
  );
  const setHighSafe = useCallback(
    (v: number): void => {
      if (won) return;
      setHigh(() => clamp(v, 0, SENSOR_MAX));
      setLow((l) => Math.min(l, clamp(v, 0, SENSOR_MAX) - 1));
      setChecked(false);
    },
    [won],
  );

  // Live zone the plant is in RIGHT NOW under the learner's thresholds.
  const liveZone = useMemo<Zone>(
    () => zoneFor(moisture, low, high),
    [moisture, low, high],
  );
  const liveBuzzing = liveZone === "dry";

  const pour = useCallback((): void => {
    if (won) return;
    setMoisture((m) => clamp(m + POUR_STEP, 0, SENSOR_MAX));
  }, [won]);
  const dry = useCallback((): void => {
    if (won) return;
    setMoisture((m) => clamp(m - DRY_STEP, 0, SENSOR_MAX));
  }, [won]);

  // ── TEST: run the fixed 3-state check deterministically. ───────────────────
  const runTest = useCallback((): void => {
    if (won) return;
    const nextMarks: Record<Zone, Mark> = { dry: "pending", ok: "pending", wet: "pending" };
    let allZonesOk = true;
    let buzzerOk = true;
    for (const s of STATES) {
      const got = zoneFor(s.reading, low, high);
      const colourOk = got === s.want;
      nextMarks[s.id] = colourOk ? "pass" : "fail";
      if (!colourOk) allZonesOk = false;
      // Buzzer must fire ONLY when the soil is truly dry.
      const buzzed = got === "dry";
      const shouldBuzz = s.want === "dry";
      if (buzzed !== shouldBuzz) buzzerOk = false;
    }
    setMarks(nextMarks);
    setBuzzerMark(buzzerOk ? "pass" : "fail");
    setChecked(true);

    if (allZonesOk && buzzerOk && !reportedRef.current) {
      reportedRef.current = true;
      setWon(true);
      onComplete({
        passed: true,
        stars: 3,
        detail: `Thresholds L=${low}, H=${high} sort every reading: RED+buzzer when dry, YELLOW when ok, GREEN when wet. 🪴✨`,
      });
    } else if (!allZonesOk || !buzzerOk) {
      onComplete({
        passed: false,
        detail: "Almost! Slide each threshold into its green band so all three readings light the right LED.",
      });
    }
  }, [won, low, high, onComplete]);

  const reset = useCallback((): void => {
    reportedRef.current = false;
    setLow(START_LOW);
    setHigh(START_HIGH);
    setMoisture(MOISTURE_START);
    setMarks({ dry: "pending", ok: "pending", wet: "pending" });
    setBuzzerMark("pending");
    setChecked(false);
    setWon(false);
    setHintShown(false);
  }, []);

  // Kind, specific reason for a failing test row (never scolds).
  const reasonFor = useCallback(
    (s: TestState, got: Zone): string => {
      return `${ZONE_NAME[got]} lit at reading ${s.reading}, but the soil was ${s.label.toLowerCase()} — that wants ${ZONE_NAME[s.want]}. ${
        s.want === "dry"
          ? "Raise your DRY line above this reading."
          : s.want === "wet"
            ? "Lower your WET line below this reading."
            : "Tuck this reading between your two lines."
      }`;
    },
    [],
  );

  const passCount = useMemo<number>(
    () => STATES.reduce((n, s) => (marks[s.id] === "pass" ? n + 1 : n), 0),
    [marks],
  );

  const status = won
    ? "Solved! Your plant gets the right alert at every moisture level. ⭐⭐⭐"
    : checked
      ? `${passCount} of 3 readings lit the right LED${buzzerMark === "fail" ? " — and check the buzzer" : ""} — adjust and test again.`
      : "Set the two threshold sliders, then press TEST to run all three readings.";

  // ── Gauge geometry (horizontal bar 0..1023). ───────────────────────────────
  const BAR_X = 16;
  const BAR_W = 308;
  const valToX = (v: number): number => BAR_X + (v / SENSOR_MAX) * BAR_W;

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-3 font-mono text-ink">
      {/* ── Status pill ── */}
      <div
        className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-1.5 text-center text-sm"
        role="status"
        aria-live="polite"
        aria-label={status}
        style={{
          background: won ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${won ? ACCENT : "var(--color-line, #33405c)"}`,
          boxShadow: won ? `0 0 18px ${ACCENT}66` : undefined,
        }}
      >
        <span aria-hidden="true">{won ? "🎉" : "🪴"}</span>
        <span aria-hidden="true">{won ? "⭐⭐⭐ Your plant is happy" : "DRY → RED+buzz · OK → YELLOW · WET → GREEN"}</span>
        {won && <span aria-hidden="true">✨</span>}
      </div>

      {/* ── Plant scene + signboard LEDs + buzzer ── */}
      <div className="panel relative w-full overflow-hidden rounded-2xl border border-line p-2">
        <svg
          viewBox="0 0 340 210"
          className="block w-full select-none"
          role="img"
          aria-label={`A plant pot with a soil probe. Live moisture reads ${moisture} of ${SENSOR_MAX}. The ${ZONE_NAME[liveZone]} LED is lit and the buzzer is ${liveBuzzing ? "sounding" : "quiet"}.`}
        >
          <defs>
            <radialGradient id="g4plantmonitor-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ZONE_COLOR[liveZone]} stopOpacity="0.9" />
              <stop offset="100%" stopColor={ZONE_COLOR[liveZone]} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* ── Pot + soil (soil fill rises with moisture) ── */}
          <g aria-hidden="true">
            {/* plant leaves — droopier when dry, perky when wet */}
            <text
              x={70}
              y={liveZone === "dry" ? 54 : 44}
              fontSize={34}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ transition: "all .25s ease" }}
            >
              {liveZone === "dry" ? "🥀" : "🪴"}
            </text>

            {/* pot body */}
            <path d="M 38 96 L 102 96 L 94 156 L 46 156 Z" fill="#7c4a2d" stroke="#9a5a36" strokeWidth={2} />
            <rect x={34} y={88} width={72} height={12} rx={3} fill="#8a5436" />
            {/* soil level rises with the live reading */}
            <clipPath id="g4plantmonitor-potclip">
              <path d="M 38 96 L 102 96 L 94 156 L 46 156 Z" />
            </clipPath>
            <g clipPath="url(#g4plantmonitor-potclip)">
              <rect
                x={36}
                y={156 - (moisture / SENSOR_MAX) * 56}
                width={70}
                height={60}
                fill={liveZone === "wet" ? "#3b2a1a" : liveZone === "ok" ? "#4a3320" : "#5c4026"}
                style={{ transition: "y .2s ease, fill .2s ease" }}
              />
            </g>
            {/* soil probe stuck in the pot */}
            <rect x={66} y={92} width={8} height={56} rx={2} fill="#9aa6b2" />
            <line x1={70} y1={148} x2={70} y2={156} stroke="#cbd5e1" strokeWidth={2} />
          </g>

          {/* ── Live moisture readout ── */}
          <g aria-label={`Soil moisture reads ${moisture}`}>
            <rect x={120} y={28} width={120} height={40} rx={6} fill="#0b1220" stroke={ACCENT} strokeWidth={1.5} />
            <text x={130} y={48} fontSize={13} aria-hidden="true">💧</text>
            <text x={232} y={49} fontSize={20} textAnchor="end" dominantBaseline="central" fill={ACCENT} className="font-display" aria-hidden="true">
              {moisture}
            </text>
            <text x={180} y={62} fontSize={8} textAnchor="middle" fill="#6b7a90" aria-hidden="true">moisture / 1023</text>
          </g>

          {/* ── Signboard: three LEDs + buzzer ── */}
          <g aria-hidden="true">
            {(["dry", "ok", "wet"] as Zone[]).map((z, i) => {
              const cx = 268;
              const cy = 36 + i * 34;
              const lit = liveZone === z;
              return (
                <g key={z}>
                  {lit && <circle cx={cx} cy={cy} r={16} fill="url(#g4plantmonitor-glow)" />}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={9}
                    fill={lit ? ZONE_COLOR[z] : "#1b2436"}
                    stroke={ZONE_COLOR[z]}
                    strokeWidth={2}
                    style={{ filter: lit ? `drop-shadow(0 0 6px ${ZONE_COLOR[z]})` : undefined }}
                  />
                  <text x={284} y={cy} fontSize={9} dominantBaseline="central" fill={lit ? ZONE_COLOR[z] : "#6b7a90"}>
                    {ZONE_NAME[z]}
                  </text>
                </g>
              );
            })}
            {/* buzzer */}
            <g>
              <circle cx={268} cy={140} r={9} fill={liveBuzzing ? "#f87171" : "#1b2436"} stroke="#f87171" strokeWidth={2} style={{ filter: liveBuzzing ? "drop-shadow(0 0 6px #f87171)" : undefined }} />
              <text x={268} y={141} fontSize={11} textAnchor="middle" dominantBaseline="central">{liveBuzzing ? "🔔" : "🔕"}</text>
              {liveBuzzing && (
                <g stroke="#f87171" strokeWidth={1.5} fill="none" opacity={0.8} style={{ animation: "g4plantmonitor-ring 0.9s ease-in-out infinite" }}>
                  <path d="M 281 134 Q 287 140 281 146" />
                  <path d="M 285 130 Q 294 140 285 150" />
                </g>
              )}
              <text x={284} y={140} fontSize={9} dominantBaseline="central" fill={liveBuzzing ? "#f87171" : "#6b7a90"}>BUZZER</text>
            </g>
          </g>

          {/* ── Threshold map bar (0..1023) with both valid bands ── */}
          <g aria-hidden="true">
            <rect x={BAR_X} y={178} width={BAR_W} height={16} rx={4} fill="rgba(255,255,255,0.04)" stroke="rgba(120,140,170,0.4)" strokeWidth={1.5} />
            {/* zone fills under the current thresholds */}
            <rect x={valToX(0)} y={179} width={valToX(low) - valToX(0)} height={14} fill={ZONE_COLOR.dry} opacity={0.18} />
            <rect x={valToX(low)} y={179} width={valToX(high) - valToX(low)} height={14} fill={ZONE_COLOR.ok} opacity={0.18} />
            <rect x={valToX(high)} y={179} width={valToX(SENSOR_MAX) - valToX(high)} height={14} fill={ZONE_COLOR.wet} opacity={0.18} />
            {/* highlighted valid bands */}
            <rect x={valToX(LOW_BAND_LO)} y={196} width={valToX(LOW_BAND_HI) - valToX(LOW_BAND_LO)} height={5} rx={2} fill={ACCENT} opacity={0.5} />
            <rect x={valToX(HIGH_BAND_LO)} y={196} width={valToX(HIGH_BAND_HI) - valToX(HIGH_BAND_LO)} height={5} rx={2} fill={ACCENT} opacity={0.5} />
            {/* test-state ticks */}
            {STATES.map((s) => (
              <g key={s.id}>
                <line x1={valToX(s.reading)} y1={176} x2={valToX(s.reading)} y2={196} stroke="#cbd5e1" strokeWidth={1} opacity={0.5} />
                <text x={valToX(s.reading)} y={208} fontSize={7} textAnchor="middle" fill="#6b7a90">{s.reading}</text>
              </g>
            ))}
            {/* the live reading marker */}
            <polygon
              points={`${valToX(moisture)},176 ${valToX(moisture) - 5},170 ${valToX(moisture) + 5},170`}
              fill={ACCENT}
            />
          </g>
        </svg>
      </div>

      {/* ── Watering can + sun controls ── */}
      <div className="flex w-full gap-2">
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); pour(); }}
          disabled={won}
          aria-label="Pour water — soil moisture goes up"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition active:scale-95 disabled:opacity-50"
          style={{ touchAction: "none", background: "rgba(52,211,153,0.12)", border: `2px solid ${ACCENT}`, color: ACCENT }}
        >
          <span aria-hidden="true" className="text-lg">🪣</span> Water +
        </button>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); dry(); }}
          disabled={won}
          aria-label="Let the sun dry the soil — moisture goes down"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition active:scale-95 disabled:opacity-50"
          style={{ touchAction: "none", background: "rgba(251,191,36,0.12)", border: "2px solid #fbbf24", color: "#fbbf24" }}
        >
          <span aria-hidden="true" className="text-lg">☀️</span> Dry −
        </button>
      </div>

      {/* ── The two threshold sliders ── */}
      <div className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-panel/60 p-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between text-ink-dim">
            <span aria-hidden="true">🔴 DRY line — below this = RED + buzzer</span>
            <span className="font-display tabular-nums" style={{ color: ZONE_COLOR.dry }}>L = {low}</span>
          </span>
          <input
            type="range"
            min={0}
            max={SENSOR_MAX}
            step={1}
            value={low}
            onChange={(e) => setLowSafe(Number(e.target.value))}
            aria-label={`Low threshold L, ${low}. Readings below it light the red LED and the buzzer.`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
            style={{ accentColor: ZONE_COLOR.dry }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between text-ink-dim">
            <span aria-hidden="true">🟢 WET line — above this = GREEN</span>
            <span className="font-display tabular-nums" style={{ color: ZONE_COLOR.wet }}>H = {high}</span>
          </span>
          <input
            type="range"
            min={0}
            max={SENSOR_MAX}
            step={1}
            value={high}
            onChange={(e) => setHighSafe(Number(e.target.value))}
            aria-label={`High threshold H, ${high}. Readings above it light the green LED.`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
            style={{ accentColor: ZONE_COLOR.wet }}
          />
        </label>
      </div>

      {/* ── The rule, in plain code-style text ── */}
      <div className="w-full rounded-xl border border-line bg-[#0b1220] px-3 py-2 text-[11px] leading-relaxed" aria-label={`Rule: if reading less than ${low}, red and buzzer; else if reading less than ${high}, yellow; else green.`}>
        <span className="text-ink-dim">IF</span> reading &lt; <span style={{ color: ZONE_COLOR.dry }}>{low}</span> <span className="text-ink-dim">→</span> <span style={{ color: ZONE_COLOR.dry }}>RED + BUZZER</span>
        <br />
        <span className="text-ink-dim">ELSE IF</span> reading &lt; <span style={{ color: ZONE_COLOR.wet }}>{high}</span> <span className="text-ink-dim">→</span> <span style={{ color: ZONE_COLOR.ok }}>YELLOW</span>
        <br />
        <span className="text-ink-dim">ELSE →</span> <span style={{ color: ZONE_COLOR.wet }}>GREEN</span>
      </div>

      {/* ── Test checklist (3 soil states) ── */}
      <div className="grid w-full grid-cols-3 gap-2">
        {STATES.map((s) => {
          const mk: Mark = marks[s.id];
          const litZone = checked ? zoneFor(s.reading, low, high) : null;
          const border = mk === "pass" ? ACCENT : mk === "fail" ? "#f87171" : "var(--color-line, #33405c)";
          return (
            <div
              key={s.id}
              className="flex flex-col items-center gap-0.5 rounded-xl border-2 px-1 py-2 text-center"
              style={{
                borderColor: border,
                background: mk === "pass" ? "rgba(52,211,153,0.1)" : mk === "fail" ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.02)",
              }}
              aria-label={`${s.label}: reading ${s.reading}, wants ${ZONE_NAME[s.want]}. ${mk === "pass" ? "Correct." : mk === "fail" ? `Lit ${litZone ? ZONE_NAME[litZone] : ""}, not yet.` : "Not tested."}`}
            >
              <span className="text-lg" aria-hidden="true">{s.emoji}</span>
              <span className="text-[10px] text-ink-dim">{s.label}</span>
              <span className="text-[10px] text-ink-faint" aria-hidden="true">{s.reading}</span>
              {/* the LED that this row lit (after testing) */}
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-full"
                style={{
                  background: litZone ? ZONE_COLOR[litZone] : "#39465e",
                  boxShadow: litZone ? `0 0 5px ${ZONE_COLOR[litZone]}` : undefined,
                }}
              />
              <span aria-hidden="true" className="text-sm" style={{ color: mk === "pass" ? ACCENT : mk === "fail" ? "#f87171" : "#39465e" }}>
                {mk === "pass" ? "✓" : mk === "fail" ? "✕" : "•"}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Buzzer verdict row ── */}
      <div
        className="flex w-full items-center justify-between rounded-xl border-2 px-3 py-2 text-xs"
        style={{
          borderColor: buzzerMark === "pass" ? ACCENT : buzzerMark === "fail" ? "#f87171" : "var(--color-line, #33405c)",
          background: buzzerMark === "pass" ? "rgba(52,211,153,0.1)" : buzzerMark === "fail" ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.02)",
        }}
        aria-label={`Buzzer rule: should sound only when dry. ${buzzerMark === "pass" ? "Correct." : buzzerMark === "fail" ? "Not yet." : "Not tested."}`}
      >
        <span className="text-ink-dim" aria-hidden="true">🔔 Buzzer sounds only when DRY</span>
        <span aria-hidden="true" style={{ color: buzzerMark === "pass" ? ACCENT : buzzerMark === "fail" ? "#f87171" : "#6b7a90" }}>
          {buzzerMark === "pass" ? "✓ correct" : buzzerMark === "fail" ? "✕ not yet" : "• untested"}
        </span>
      </div>

      {/* ── Kind reasons for any failing test row ── */}
      {checked && !won && (
        <div className="w-full space-y-1" aria-live="polite">
          {STATES.filter((s) => marks[s.id] === "fail").map((s) => (
            <p key={s.id} className="text-[11px]" style={{ color: "#f87171" }}>
              {s.emoji} {reasonFor(s, zoneFor(s.reading, low, high))}
            </p>
          ))}
          {marks.dry === "pass" && marks.ok === "pass" && marks.wet === "pass" && buzzerMark === "fail" && (
            <p className="text-[11px]" style={{ color: "#f87171" }}>
              🔔 Colours are right, but the buzzer must stay quiet unless the RED zone lights.
            </p>
          )}
        </div>
      )}

      {/* ── Hint reveal — reveals ONE boundary reading + its zone, never the answer ── */}
      {hintShown && !won && (
        <p className="w-full text-[11px]" style={{ color: ACCENT }} aria-live="polite">
          💡 The dry-soil test reads 180 and must light RED, while the just-right test reads 450 and must light YELLOW — so your DRY line belongs somewhere between them (the green band shows where).
        </p>
      )}

      {/* ── Controls ── */}
      <div className="flex w-full items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); reset(); }}
          aria-label="Start over"
          className="grid h-[54px] w-[56px] place-items-center rounded-2xl text-xl transition active:scale-90"
          style={{ touchAction: "none", background: "rgba(255,255,255,0.05)", border: "2px solid var(--color-line, #33405c)" }}
        >
          <span aria-hidden="true">🔄</span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); setHintShown(true); }}
          disabled={won}
          aria-label="Show a hint"
          className="grid h-[54px] w-[56px] place-items-center rounded-2xl text-xl transition active:scale-90 disabled:opacity-40"
          style={{ touchAction: "none", background: "rgba(255,255,255,0.05)", border: "2px solid var(--color-line, #33405c)" }}
        >
          <span aria-hidden="true">💭</span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); runTest(); }}
          disabled={won}
          aria-label="Test the rule across all three soil readings"
          className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-2xl text-lg font-bold transition active:scale-95 disabled:opacity-50"
          style={{ touchAction: "none", background: ACCENT, color: "#04130d", boxShadow: "0 6px 0 0 #15916a" }}
        >
          <span aria-hidden="true">{won ? "✅" : "▶"}</span>
          <span aria-hidden="true" className="font-extrabold">{won ? "SOLVED" : "TEST"}</span>
        </button>
      </div>

      {/* ── Win celebration ── */}
      {won && (
        <div className="flex flex-col items-center gap-1">
          <div className="rounded-full px-4 py-1 text-xs font-bold" style={{ background: "rgba(52,211,153,0.18)", color: ACCENT, border: `2px solid ${ACCENT}` }}>
            🌿 Your plant is happy
          </div>
          <div className="pointer-events-none flex justify-center gap-2 text-2xl">
            <span style={{ animation: "g4plantmonitor-float 1.6s ease-in-out infinite" }} aria-hidden="true">✨</span>
            <span style={{ animation: "g4plantmonitor-float 1.6s ease-in-out infinite", animationDelay: "0.2s" }} aria-hidden="true">🎉</span>
            <span style={{ animation: "g4plantmonitor-float 1.6s ease-in-out infinite", animationDelay: "0.4s" }} aria-hidden="true">✨</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes g4plantmonitor-ring {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.9; }
        }
        @keyframes g4plantmonitor-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
