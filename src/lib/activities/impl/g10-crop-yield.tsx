"use client";
// Learning goal: feature selection in a prediction model — discover which input
// columns (rainfall, fertiliser) actually drive the outcome, train a model that
// keeps the strong predictors and drops the noise column, then read the trend to
// forecast a new field. Everything here is deterministic and always winnable.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#22d3ee";

/** One row of the fixed crop dataset. */
interface CropRow {
  state: string;
  season: "Kharif" | "Rabi";
  fieldId: number; // the DECOY column — a random label, predicts nothing
  rainfall: number; // mm (strong predictor)
  fertiliser: number; // kg/ha (strong predictor)
  yield: number; // t/ha (outcome) ≈ 0.018·rain + 0.05·fert
}

/**
 * 12 hand-built rows. yield = round(0.018*rainfall + 0.05*fertiliser, 1).
 * So rainfall and fertiliser line up tightly against yield; fieldId is a random
 * tag that scatters. Sorted-ish so the table reads naturally.
 */
const DATA: readonly CropRow[] = [
  { state: "Punjab", season: "Rabi", fieldId: 47, rainfall: 320, fertiliser: 90, yield: 10.3 },
  { state: "Bihar", season: "Kharif", fieldId: 12, rainfall: 280, fertiliser: 60, yield: 8.0 },
  { state: "Odisha", season: "Kharif", fieldId: 88, rainfall: 410, fertiliser: 70, yield: 10.9 },
  { state: "Kerala", season: "Kharif", fieldId: 33, rainfall: 460, fertiliser: 55, yield: 11.0 },
  { state: "Punjab", season: "Rabi", fieldId: 5, rainfall: 350, fertiliser: 100, yield: 11.3 },
  { state: "Rajasthan", season: "Rabi", fieldId: 71, rainfall: 180, fertiliser: 40, yield: 5.2 },
  { state: "Gujarat", season: "Kharif", fieldId: 60, rainfall: 240, fertiliser: 50, yield: 6.8 },
  { state: "Assam", season: "Kharif", fieldId: 19, rainfall: 500, fertiliser: 65, yield: 12.3 },
  { state: "Bihar", season: "Rabi", fieldId: 26, rainfall: 300, fertiliser: 80, yield: 9.4 },
  { state: "Rajasthan", season: "Rabi", fieldId: 92, rainfall: 150, fertiliser: 35, yield: 4.5 },
  { state: "Haryana", season: "Rabi", fieldId: 41, rainfall: 380, fertiliser: 95, yield: 11.6 },
  { state: "Telangana", season: "Kharif", fieldId: 54, rainfall: 220, fertiliser: 45, yield: 6.2 },
] as const;

/** The three candidate inputs the learner can plot / include. */
type Feature = "rainfall" | "fertiliser" | "fieldId";

const FEATURES: readonly { key: Feature; label: string; unit: string; strong: boolean }[] = [
  { key: "rainfall", label: "Rainfall", unit: "mm", strong: true },
  { key: "fertiliser", label: "Fertiliser", unit: "kg/ha", strong: true },
  { key: "fieldId", label: "Field ID", unit: "tag", strong: false },
] as const;

/** Min/max per feature for axis scaling. */
const RANGE: Record<Feature, { min: number; max: number }> = {
  rainfall: { min: 140, max: 520 },
  fertiliser: { min: 30, max: 105 },
  fieldId: { min: 0, max: 100 },
};
const YIELD_RANGE = { min: 4, max: 13 } as const;

/**
 * Pre-baked R² lookup keyed by the included-feature set. The win set is
 * rainfall+fertiliser (no Field ID) → 0.94. Dropping a strong predictor caps it
 * low; adding Field ID never helps. Deterministic and honest.
 */
function modelAccuracy(set: ReadonlySet<Feature>): number {
  const rain = set.has("rainfall");
  const fert = set.has("fertiliser");
  const noise = set.has("fieldId");
  if (rain && fert && !noise) return 0.94; // the target model
  if (rain && fert && noise) return 0.9; // noise adds nothing, slight drag
  if (rain && !fert && !noise) return 0.61; // one predictor only
  if (rain && !fert && noise) return 0.58;
  if (!rain && fert && !noise) return 0.52; // dropped the best predictor
  if (!rain && fert && noise) return 0.49;
  if (!rain && !fert && noise) return 0.08; // only the random tag
  return 0.0; // nothing selected
}

/** Importance (bar heights) the trained model assigns each input, 0–1. */
function importance(set: ReadonlySet<Feature>): Record<Feature, number> {
  return {
    rainfall: set.has("rainfall") ? 0.62 : 0,
    fertiliser: set.has("fertiliser") ? 0.38 : 0,
    fieldId: set.has("fieldId") ? 0.04 : 0,
  };
}

const TARGET_ACC = 0.85; // win threshold

/** The new field to forecast (Step 3). High rain + medium fertiliser. */
const NEW_FIELD = { rainfall: 470, fertiliser: 75 } as const;

/** Deterministic forecast: yield ≈ 0.018·rain + 0.05·fert → bucket. */
const FORECAST_YIELD = 0.018 * NEW_FIELD.rainfall + 0.05 * NEW_FIELD.fertiliser; // ≈ 12.2
type Bucket = "Low" | "Medium" | "High";
const CORRECT_BUCKET: Bucket = FORECAST_YIELD >= 9 ? "High" : FORECAST_YIELD >= 6 ? "Medium" : "Low";
const BUCKETS: readonly Bucket[] = ["Low", "Medium", "High"] as const;

export default function CropYieldPredictor({ onComplete }: ActivityProps) {
  // Step 1: which feature is on the X-axis of the scatter plot.
  const [xFeat, setXFeat] = useState<Feature>("rainfall");
  // Step 2: which features are included as model inputs.
  const [inputs, setInputs] = useState<Set<Feature>>(new Set<Feature>(["rainfall"]));
  const [trained, setTrained] = useState<boolean>(false);
  const [acc, setAcc] = useState<number>(0);
  // Step 3: chosen forecast bucket.
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Step 1 — plot each column on X. Which one lines up with yield?",
  );
  const firedRef = useRef<boolean>(false);

  const accStrong = useMemo(() => acc >= TARGET_ACC, [acc]);
  const imp = useMemo(() => importance(inputs), [inputs]);

  // ── Scatter geometry (0..100 viewBox) ──────────────────────
  const PAD = 12;
  const span = 100 - PAD * 2;
  const sx = useCallback(
    (v: number): number => {
      const r = RANGE[xFeat];
      return PAD + ((v - r.min) / (r.max - r.min)) * span;
    },
    [xFeat, span],
  );
  const sy = useCallback(
    (v: number): number =>
      PAD + (1 - (v - YIELD_RANGE.min) / (YIELD_RANGE.max - YIELD_RANGE.min)) * span,
    [span],
  );

  const setX = useCallback((f: Feature): void => {
    setXFeat(f);
    const meta = FEATURES.find((m) => m.key === f);
    if (!meta) return;
    setStatus(
      meta.strong
        ? `${meta.label}: points climb in a clean line — strong predictor of yield.`
        : `${meta.label}: points scatter everywhere — this column is random, it doesn't predict yield.`,
    );
  }, []);

  const toggleInput = useCallback(
    (f: Feature): void => {
      if (solved) return;
      setTrained(false);
      setAcc(0);
      setInputs((prev) => {
        const next = new Set(prev);
        if (next.has(f)) next.delete(f);
        else next.add(f);
        return next;
      });
    },
    [solved],
  );

  const train = useCallback((): void => {
    if (solved) return;
    const a = modelAccuracy(inputs);
    setAcc(a);
    setTrained(true);
    if (inputs.has("fieldId")) {
      setStatus("Field ID is a random tag — it doesn't help the model. Untick it.");
    } else if (!inputs.has("rainfall")) {
      setStatus(`Accuracy collapsed to ${Math.round(a * 100)}% — you dropped your best predictor (rainfall).`);
    } else if (!inputs.has("fertiliser")) {
      setStatus(`Only ${Math.round(a * 100)}% — one predictor isn't enough. Add fertiliser too.`);
    } else {
      setStatus(`Model trained at ${Math.round(a * 100)}% accuracy — both strong predictors in, noise out. Now forecast →`);
    }
    onComplete({ passed: false, detail: `Model accuracy ${Math.round(a * 100)}%.` });
  }, [solved, inputs, onComplete]);

  const pickBucket = useCallback(
    (b: Bucket): void => {
      if (solved) return;
      setBucket(b);
      setStatus(`Forecast set to ${b}. Press Predict to lock it in.`);
    },
    [solved],
  );

  const predict = useCallback((): void => {
    if (solved) return;
    if (!trained || !accStrong) {
      setStatus("Train a model with accuracy ≥ 85% first (keep rainfall + fertiliser, drop Field ID).");
      onComplete({ passed: false, detail: "Build an accurate model before forecasting." });
      return;
    }
    if (bucket === null) {
      setStatus("Pick a predicted-yield bucket (Low / Medium / High) for the new field.");
      onComplete({ passed: false, detail: "Choose a forecast bucket." });
      return;
    }
    if (bucket !== CORRECT_BUCKET) {
      setStatus(
        `Not quite — heavy rain (470mm) + decent fertiliser (75) sits high on the trend line. Re-read the scatter.`,
      );
      onComplete({ passed: false, detail: "That bucket doesn't match the trend." });
      return;
    }
    setSolved(true);
    firedRef.current = true;
    setStatus("✨🎉 Model trained and forecast correct — High yield, just like the trend predicted!");
    onComplete({
      passed: true,
      stars: 3,
      detail: "Selected rainfall + fertiliser, dropped the noise column, and forecast High correctly.",
    });
  }, [solved, trained, accStrong, bucket, onComplete]);

  const reset = useCallback((): void => {
    setXFeat("rainfall");
    setInputs(new Set<Feature>(["rainfall"]));
    setTrained(false);
    setAcc(0);
    setBucket(null);
    setSolved(false);
    setStatus("Step 1 — plot each column on X. Which one lines up with yield?");
  }, []);

  const xMeta = FEATURES.find((m) => m.key === xFeat);

  return (
    <div
      className="mx-auto flex w-full flex-col gap-3 font-mono text-ink"
      style={{ maxWidth: 440 }}
    >
      <style>{`
        @keyframes g10cropyield-pop { 0%{transform:scale(.7);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes g10cropyield-grow { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes g10cropyield-glow { 0%,100%{filter:drop-shadow(0 0 2px ${ACCENT})} 50%{filter:drop-shadow(0 0 8px ${ACCENT})} }
        .g10cropyield-win { animation: g10cropyield-pop 420ms ease-out both; }
        .g10cropyield-bar { transform-origin: left center; animation: g10cropyield-grow 480ms ease-out both; }
        .g10cropyield-pulse { animation: g10cropyield-glow 1.6s ease-in-out infinite; }
      `}</style>

      {/* Step 1 — Scatter plot + X-axis toggle */}
      <div
        className="panel rounded-xl p-2.5"
        style={{ borderWidth: 1, borderStyle: "solid", borderColor: solved ? ACCENT : "var(--color-line, #27314f)" }}
      >
        <p className="mb-1.5 text-[11px] text-ink-dim">
          <span style={{ color: ACCENT }}>1.</span> Read the trend — put a column on X vs yield
        </p>
        <div className="mb-2 flex gap-1.5">
          {FEATURES.map((f) => (
            <button
              key={f.key}
              type="button"
              onPointerDown={() => setX(f.key)}
              aria-pressed={xFeat === f.key}
              aria-label={`Plot ${f.label} on the X axis`}
              className="flex-1 rounded-lg px-1.5 py-1 text-[11px]"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: xFeat === f.key ? ACCENT : "var(--color-line, #27314f)",
                background: xFeat === f.key ? "rgba(34,211,238,0.18)" : "rgba(11,16,32,0.6)",
                color: xFeat === f.key ? "#fff" : "#9aa6cf",
                touchAction: "manipulation",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <svg viewBox="0 0 100 100" className="block aspect-square w-full" role="img" aria-label={`Scatter plot of ${xMeta?.label ?? "feature"} versus crop yield`}>
          {/* axes */}
          <g stroke="#27314f" strokeWidth={0.4}>
            <line x1={PAD} y1={PAD} x2={PAD} y2={100 - PAD} />
            <line x1={PAD} y1={100 - PAD} x2={100 - PAD} y2={100 - PAD} />
          </g>
          {/* points */}
          {DATA.map((row, i) => {
            const seasonColor = row.season === "Kharif" ? ACCENT : "#f59e0b";
            return (
              <circle
                key={i}
                cx={sx(row[xFeat])}
                cy={sy(row.yield)}
                r={2.4}
                fill={seasonColor}
                opacity={0.9}
              />
            );
          })}
          {/* axis labels */}
          <text x={50} y={99} fontSize={4} fill="#7c89b0" textAnchor="middle">
            {xMeta?.label} ({xMeta?.unit}) →
          </text>
          <text x={3} y={50} fontSize={4} fill="#7c89b0" textAnchor="middle" transform="rotate(-90 3 50)">
            yield →
          </text>
        </svg>
        <div className="mt-1 flex items-center justify-between text-[10px] text-ink-faint">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: ACCENT }} /> Kharif
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#f59e0b" }} /> Rabi
          </span>
          <span style={{ color: xMeta?.strong ? ACCENT : "#7c89b0" }}>
            {xMeta?.strong ? "tight line → predicts yield" : "random scatter → noise"}
          </span>
        </div>
      </div>

      {/* Dataset table (collapsible-feeling, scrollable) */}
      <details className="panel rounded-xl p-2.5">
        <summary className="cursor-pointer text-[11px] text-ink-dim" style={{ touchAction: "manipulation" }}>
          📋 Dataset — 12 fields (tap to view)
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-center text-[10px]">
            <thead>
              <tr className="text-ink-faint">
                <th className="px-1 py-0.5 text-left">state</th>
                <th className="px-1 py-0.5">rain</th>
                <th className="px-1 py-0.5">fert</th>
                <th className="px-1 py-0.5" style={{ color: "#7c89b0" }}>fieldID</th>
                <th className="px-1 py-0.5" style={{ color: ACCENT }}>yield</th>
              </tr>
            </thead>
            <tbody>
              {DATA.map((row, i) => (
                <tr key={i} style={{ color: "#cbd3ef" }}>
                  <td className="px-1 py-0.5 text-left text-ink-dim">{row.state}</td>
                  <td className="px-1 py-0.5 tabular-nums">{row.rainfall}</td>
                  <td className="px-1 py-0.5 tabular-nums">{row.fertiliser}</td>
                  <td className="px-1 py-0.5 tabular-nums" style={{ color: "#566" }}>{row.fieldId}</td>
                  <td className="px-1 py-0.5 tabular-nums" style={{ color: ACCENT }}>{row.yield}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Step 2 — Feature selection + Train */}
      <div className="panel rounded-xl p-2.5">
        <p className="mb-1.5 text-[11px] text-ink-dim">
          <span style={{ color: ACCENT }}>2.</span> Build the model — pick which inputs to include
        </p>
        <div className="flex flex-col gap-1.5">
          {FEATURES.map((f) => {
            const on = inputs.has(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onPointerDown={() => toggleInput(f.key)}
                disabled={solved}
                role="checkbox"
                aria-checked={on}
                aria-label={`Include ${f.label} as a model input`}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] disabled:opacity-60"
                style={{
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: on ? ACCENT : "var(--color-line, #27314f)",
                  background: on ? "rgba(34,211,238,0.14)" : "rgba(11,16,32,0.6)",
                  color: "#cbd3ef",
                  touchAction: "manipulation",
                }}
              >
                <span>
                  <span aria-hidden="true">{on ? "☑" : "☐"}</span> {f.label}{" "}
                  <span className="text-ink-faint">({f.unit})</span>
                </span>
                {/* live importance bar once trained */}
                {trained && (
                  <span className="ml-2 flex h-2 w-16 overflow-hidden rounded-full" style={{ background: "#1c2540" }}>
                    <span
                      className="g10cropyield-bar h-full rounded-full"
                      style={{ width: `${Math.round(imp[f.key] * 100)}%`, background: f.strong ? ACCENT : "#7c89b0" }}
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onPointerDown={train}
          disabled={solved}
          className="mt-2 w-full rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-50"
          style={{ background: "rgba(34,211,238,0.18)", borderWidth: 1, borderStyle: "solid", borderColor: ACCENT, color: "#fff", touchAction: "manipulation" }}
          aria-label="Train the model and measure accuracy"
        >
          ⚙ Train model
        </button>

        {/* Accuracy bar */}
        {trained && (
          <div className="mt-2">
            <div className="mb-0.5 flex items-center justify-between text-[10px]">
              <span className="text-ink-faint">accuracy (R²)</span>
              <span className="font-display tabular-nums" style={{ color: accStrong ? ACCENT : "#f59e0b" }}>
                {Math.round(acc * 100)}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: "#1c2540" }} role="meter" aria-valuenow={Math.round(acc * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Model accuracy">
              <div
                className="g10cropyield-bar h-full rounded-full"
                style={{ width: `${Math.round(acc * 100)}%`, background: accStrong ? ACCENT : "#f59e0b" }}
              />
            </div>
            <div className="mt-0.5 text-right text-[9px] text-ink-faint">target ≥ {Math.round(TARGET_ACC * 100)}%</div>
          </div>
        )}
      </div>

      {/* Step 3 — Forecast a new field */}
      <div className="panel rounded-xl p-2.5" style={{ opacity: accStrong ? 1 : 0.55 }}>
        <p className="mb-1.5 text-[11px] text-ink-dim">
          <span style={{ color: ACCENT }}>3.</span> Forecast a new field — read it off the trend
        </p>
        <div className="mb-2 flex justify-between text-[11px] text-ink-dim">
          <span>🌧 rainfall <b style={{ color: ACCENT }}>{NEW_FIELD.rainfall}mm</b> (high)</span>
          <span>🧪 fertiliser <b style={{ color: ACCENT }}>{NEW_FIELD.fertiliser}</b> (medium)</span>
        </div>
        <div className="flex gap-1.5">
          {BUCKETS.map((b) => (
            <button
              key={b}
              type="button"
              onPointerDown={() => pickBucket(b)}
              disabled={solved || !accStrong}
              aria-pressed={bucket === b}
              aria-label={`Predict ${b} yield`}
              className="flex-1 rounded-lg px-1 py-2 text-[12px] disabled:opacity-50"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: bucket === b ? ACCENT : "var(--color-line, #27314f)",
                background: bucket === b ? "rgba(34,211,238,0.2)" : "rgba(11,16,32,0.6)",
                color: bucket === b ? "#fff" : "#cbd3ef",
                touchAction: "manipulation",
              }}
            >
              {b === "Low" ? "🟥" : b === "Medium" ? "🟨" : "🟩"} {b}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div
        className="panel rounded-xl px-3 py-2 text-center text-[12px]"
        role="status"
        aria-live="polite"
        style={solved ? { background: ACCENT, color: "#04141a" } : { color: "#9aa6cf" }}
      >
        {solved ? (
          <span className="g10cropyield-win inline-block font-display">
            {status} ⭐⭐⭐
          </span>
        ) : (
          status
        )}
      </div>

      {/* Win celebration + closing prompt */}
      {solved && (
        <div
          className="panel g10cropyield-pulse rounded-xl p-3 text-center"
          style={{ borderWidth: 1, borderStyle: "solid", borderColor: ACCENT }}
        >
          <div className="text-2xl" aria-hidden="true">🌾🎉</div>
          <div className="mt-1 font-display text-sm" style={{ color: ACCENT }}>
            Rajasthan has the lowest yields in your data.
          </div>
          <div className="mt-0.5 text-[11px] text-ink-dim">
            Its fields had very low <b>rainfall</b> (150–180mm). Your model says rainfall carries the
            most weight — so <b style={{ color: ACCENT }}>more irrigation</b> would lift yield more
            than extra fertiliser there.
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={predict}
          disabled={solved}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT, color: "#04141a", touchAction: "manipulation" }}
          aria-label="Lock in your forecast and check the model"
        >
          {solved ? "Forecast correct!" : "🌾 Predict yield"}
        </button>
        <button
          type="button"
          onPointerDown={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          style={{ touchAction: "manipulation" }}
          aria-label="Reset the lab"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
