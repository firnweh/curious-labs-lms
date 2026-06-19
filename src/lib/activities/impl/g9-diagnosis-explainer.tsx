"use client";
// LEARNING GOAL: a logistic-regression risk score is turned into a yes/no
// decision by a tunable THRESHOLD that trades recall against precision — and
// every prediction can be explained by each feature's signed contribution.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#a855f7";

/** Features the model reads off each patient card. */
type FeatureKey = "glucose" | "bmi" | "bp" | "age";

interface Feature {
  key: FeatureKey;
  label: string;
  unit: string;
  /** Centre used to scale the raw value: scaled = (value - centre) / spread. */
  centre: number;
  spread: number;
  /** Learned logistic weight on the scaled feature. */
  weight: number;
}

/** Fixed, "trained" model. Never changes — keeps everything deterministic. */
const FEATURES: readonly Feature[] = [
  { key: "glucose", label: "Glucose", unit: "mg/dL", centre: 110, spread: 35, weight: 2.4 },
  { key: "bmi", label: "BMI", unit: "", centre: 27, spread: 7, weight: 1.5 },
  { key: "bp", label: "Blood pressure", unit: "mmHg", centre: 80, spread: 14, weight: 0.9 },
  { key: "age", label: "Age", unit: "yrs", centre: 45, spread: 16, weight: 0.7 },
] as const;

const BIAS = -0.35;

interface Patient {
  id: number;
  name: string;
  values: Record<FeatureKey, number>;
  /** Ground-truth label baked into the dataset (1 = has diabetes). */
  truth: 0 | 1;
  /** A short note for the ethics outlier; "" for everyone else. */
  outlier: string;
}

/**
 * 12 hand-tuned patients (7 positive, 5 negative). The fixed model's scores
 * are spread so that:
 *   - at the high START threshold, Ivy (a real positive, score ≈ 0.46) is
 *     MISSED → recall ≈ 0.71, below the 0.80 goal;
 *   - lowering the threshold into ≈ 0.30–0.46 catches Ivy → recall 0.86 with
 *     precision ≥ 0.86, satisfying the win condition.
 * So the recall/precision trade-off is genuine and the ~0.45 window is real.
 */
const PATIENTS: readonly Patient[] = [
  { id: 1, name: "Asha", values: { glucose: 168, bmi: 33, bp: 92, age: 58 }, truth: 1, outlier: "" },
  { id: 2, name: "Ben", values: { glucose: 96, bmi: 23, bp: 74, age: 31 }, truth: 0, outlier: "" },
  { id: 3, name: "Chen", values: { glucose: 152, bmi: 30, bp: 86, age: 49 }, truth: 1, outlier: "" },
  { id: 4, name: "Dia", values: { glucose: 104, bmi: 25, bp: 78, age: 28 }, truth: 0, outlier: "" },
  { id: 5, name: "Ed", values: { glucose: 120, bmi: 27, bp: 80, age: 50 }, truth: 1, outlier: "" },
  { id: 6, name: "Fay", values: { glucose: 110, bmi: 25, bp: 78, age: 40 }, truth: 0, outlier: "" },
  { id: 7, name: "Gita", values: { glucose: 146, bmi: 31, bp: 88, age: 47 }, truth: 1, outlier: "" },
  { id: 8, name: "Hari", values: { glucose: 112, bmi: 26, bp: 80, age: 43 }, truth: 0, outlier: "" },
  { id: 9, name: "Ivy", values: { glucose: 116, bmi: 26, bp: 78, age: 48 }, truth: 1, outlier: "" },
  { id: 10, name: "Jon", values: { glucose: 100, bmi: 22, bp: 72, age: 35 }, truth: 0, outlier: "" },
  { id: 11, name: "Kim", values: { glucose: 158, bmi: 32, bp: 90, age: 50 }, truth: 1, outlier: "" },
  {
    id: 12,
    name: "Priya",
    values: { glucose: 122, bmi: 24, bp: 76, age: 34 },
    truth: 1,
    outlier:
      "Priya is young and slim yet truly positive — the training data had almost no patients like her, so the model under-rates her risk.",
  },
] as const;

const MIN_T = 0.3;
const MAX_T = 0.7;
const START_T = 0.66; // starts high: Ivy is missed, recall too low — trade-off is visible
const WIN_RECALL = 0.8;
const WIN_PRECISION = 0.6;

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/** Signed contribution of one feature for a patient (weight × scaled value). */
function contribution(f: Feature, p: Patient): number {
  return f.weight * ((p.values[f.key] - f.centre) / f.spread);
}

/** Risk score in [0,1] for a patient under the fixed model. */
function riskOf(p: Patient): number {
  const z = FEATURES.reduce((s, f) => s + contribution(f, p), BIAS);
  return sigmoid(z);
}

interface Metrics {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
}

function metricsAt(threshold: number, scores: readonly number[]): Metrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  PATIENTS.forEach((p, i) => {
    const predicted = scores[i] >= threshold ? 1 : 0;
    if (predicted === 1 && p.truth === 1) tp++;
    else if (predicted === 1 && p.truth === 0) fp++;
    else if (predicted === 0 && p.truth === 0) tn++;
    else fn++;
  });
  const accuracy = (tp + tn) / PATIENTS.length;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { tp, fp, tn, fn, accuracy, precision, recall, f1 };
}

export default function DiagnosisExplainer({ onComplete }: ActivityProps) {
  const [threshold, setThreshold] = useState<number>(START_T);
  const [openId, setOpenId] = useState<number | null>(null);
  const [won, setWon] = useState<boolean>(false);
  const firedRef = useRef<boolean>(false);

  // Scores never change — the model is fixed — so compute once.
  const scores = useMemo<number[]>(() => PATIENTS.map((p) => riskOf(p)), []);
  const m = useMemo<Metrics>(() => metricsAt(threshold, scores), [threshold, scores]);

  const tuned = m.recall >= WIN_RECALL && m.precision >= WIN_PRECISION;

  const onSlide = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const t = Number(e.target.value);
      setThreshold(t);
      const nm = metricsAt(t, scores);
      if (nm.recall >= WIN_RECALL && nm.precision >= WIN_PRECISION) {
        if (!firedRef.current) {
          firedRef.current = true;
          setWon(true);
          onComplete({
            passed: true,
            stars: 3,
            detail: `Clinically tuned at ${t.toFixed(2)} — recall ${nm.recall.toFixed(
              2,
            )}, precision ${nm.precision.toFixed(2)}.`,
          });
        }
      } else if (!firedRef.current) {
        // Gentle, never-scolding nudge toward the winning window.
        const need =
          nm.recall < WIN_RECALL ? "lower it to catch more sick patients" : "raise it to cut false alarms";
        onComplete({ passed: false, detail: `Not tuned yet — try to ${need}.` });
      }
    },
    [scores, onComplete],
  );

  const reset = useCallback((): void => {
    setThreshold(START_T);
    setOpenId(null);
  }, []);

  const openPatient = openId === null ? null : PATIENTS.find((p) => p.id === openId) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g9diagnosisexplainer-flash {
          0%,100% { box-shadow: 0 0 0 1px rgba(248,113,113,0); }
          50% { box-shadow: 0 0 0 1px #f87171, 0 0 10px -2px #f87171; }
        }
        @keyframes g9diagnosisexplainer-pop {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .g9diagnosisexplainer-mis { animation: g9diagnosisexplainer-flash 1.4s ease-in-out infinite; }
        .g9diagnosisexplainer-win { animation: g9diagnosisexplainer-pop 320ms ease-out; }
      `}</style>

      {/* Patient grid — STEP 1: live scores */}
      <div className="rounded-xl border border-line bg-panel/60 p-3">
        <p className="mb-2 text-[11px] text-ink-faint">
          Tap a patient to see <span style={{ color: ACCENT }}>why</span> the model scored them.
        </p>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Patient cards with risk scores">
          {PATIENTS.map((p, i) => {
            const s = scores[i];
            const predicted: 0 | 1 = s >= threshold ? 1 : 0;
            const correct = predicted === p.truth;
            const fill = predicted === 1 ? ACCENT : "#334155";
            return (
              <button
                key={p.id}
                type="button"
                onPointerDown={() => setOpenId(p.id)}
                aria-label={`${p.name}, risk ${(s * 100).toFixed(0)} percent, predicted ${
                  predicted === 1 ? "at risk" : "low risk"
                }, ${correct ? "correct" : "misclassified"}`}
                className={`flex flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left ${
                  correct ? "" : "g9diagnosisexplainer-mis"
                }`}
                style={{
                  borderColor: openId === p.id ? ACCENT : "var(--color-line, #27314f)",
                  background: "rgba(11,16,32,0.6)",
                  touchAction: "manipulation",
                }}
              >
                <span className="flex w-full items-center justify-between text-[11px] text-ink-dim">
                  <span className="truncate">{p.name}</span>
                  {p.outlier ? <span aria-hidden="true">⚠️</span> : null}
                </span>
                <span className="text-[13px] font-bold tabular-nums" style={{ color: fill === ACCENT ? ACCENT : "#94a3b8" }}>
                  {(s * 100).toFixed(0)}%
                </span>
                {/* mini risk bar */}
                <span className="h-1 w-full overflow-hidden rounded-full bg-panel-2" style={{ background: "#1c2540" }}>
                  <span className="block h-full" style={{ width: `${s * 100}%`, background: fill }} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: threshold + confusion matrix + metric bars */}
      <div className="rounded-xl border border-line bg-panel/60 p-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center justify-between">
            <span className="text-ink-dim">Decision threshold</span>
            <span className="font-bold tabular-nums" style={{ color: ACCENT }}>
              {threshold.toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min={MIN_T}
            max={MAX_T}
            step={0.01}
            value={threshold}
            onChange={onSlide}
            aria-label={`Decision threshold, ${threshold.toFixed(2)}`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{ accentColor: ACCENT, background: "#1c2540", touchAction: "none" }}
          />
          <span className="text-[10px] text-ink-faint">
            Lower → catch more sick patients (recall ↑) but more false alarms (precision ↓).
          </span>
        </label>

        <div className="mt-3 flex gap-3">
          {/* 2×2 confusion matrix */}
          <div className="grid grid-cols-2 gap-1" role="img" aria-label={`Confusion matrix: ${m.tp} true positive, ${m.fp} false positive, ${m.fn} false negative, ${m.tn} true negative`}>
            <Cell n={m.tp} label="TP" tone={ACCENT} />
            <Cell n={m.fp} label="FP" tone="#f87171" />
            <Cell n={m.fn} label="FN" tone="#f87171" />
            <Cell n={m.tn} label="TN" tone="#64748b" />
          </div>
          {/* metric bars */}
          <div className="flex flex-1 flex-col justify-center gap-1.5">
            <Bar name="accuracy" value={m.accuracy} />
            <Bar name="precision" value={m.precision} target={WIN_PRECISION} />
            <Bar name="recall" value={m.recall} target={WIN_RECALL} />
            <Bar name="F1" value={m.f1} />
          </div>
        </div>
      </div>

      {/* Status / win badge */}
      <div
        role="status"
        aria-live="polite"
        className={`rounded-xl px-3 py-2 text-center text-sm ${won ? "g9diagnosisexplainer-win" : ""}`}
        style={{
          color: tuned ? "#05070d" : "#9aa6cf",
          background: tuned ? ACCENT : "rgba(11,16,32,0.6)",
          border: tuned ? "none" : "1px solid var(--color-line, #27314f)",
        }}
      >
        {tuned
          ? "✨🎉 Clinically tuned!  ⭐⭐⭐"
          : `Goal: recall ≥ ${WIN_RECALL.toFixed(2)} and precision ≥ ${WIN_PRECISION.toFixed(2)}`}
      </div>

      <button
        type="button"
        onClick={reset}
        className="self-center rounded-lg border border-line bg-panel/60 px-4 py-1.5 text-xs font-medium text-ink-dim"
        aria-label="Reset the threshold"
      >
        Reset
      </button>

      {/* STEP 3: SHAP-style waterfall modal */}
      {openPatient ? (
        <Waterfall patient={openPatient} score={riskOf(openPatient)} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  );
}

function Cell({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div
      className="grid h-12 w-12 place-items-center rounded-lg border text-center"
      style={{ borderColor: tone, background: "rgba(11,16,32,0.6)" }}
    >
      <span className="text-base font-bold tabular-nums" style={{ color: tone }}>
        {n}
      </span>
      <span className="text-[9px] text-ink-faint">{label}</span>
    </div>
  );
}

function Bar({ name, value, target }: { name: string; value: number; target?: number }) {
  const hit = target !== undefined && value >= target;
  return (
    <div className="flex items-center gap-2 text-[10px]" title={`${name}: ${value.toFixed(2)}`}>
      <span className="w-14 shrink-0 text-ink-faint">{name}</span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full" style={{ background: "#1c2540" }}>
        <span
          className="block h-full rounded-full"
          style={{ width: `${value * 100}%`, background: target !== undefined ? (hit ? ACCENT : "#f87171") : "#64748b" }}
        />
        {target !== undefined ? (
          <span className="absolute top-0 h-full w-px" style={{ left: `${target * 100}%`, background: "#e2e8f0" }} aria-hidden="true" />
        ) : null}
      </span>
      <span className="w-8 text-right tabular-nums" style={{ color: hit ? ACCENT : "#cbd3ef" }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function Waterfall({ patient, score, onClose }: { patient: Patient; score: number; onClose: () => void }) {
  // Build the stacking waterfall from the base rate up to the final score.
  const baseProb = sigmoid(BIAS);
  const rows = FEATURES.map((f) => {
    const c = contribution(f, patient);
    return {
      key: f.key,
      label: f.label,
      raw: patient.values[f.key],
      unit: f.unit,
      contrib: c,
      sentence: `${f.label.toLowerCase()} ${patient.values[f.key]}${f.unit ? " " + f.unit : ""} pushed risk ${
        c >= 0 ? "+" : "−"
      }${Math.abs(c).toFixed(2)}`,
    };
  });
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.contrib)), 0.5);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(2,6,18,0.78)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Why the model scored ${patient.name}`}
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-[400px] rounded-xl border p-4 font-mono"
        style={{ borderColor: ACCENT, background: "#0b1020" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-ink">Why {patient.name}?</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: ACCENT }}>
            {(score * 100).toFixed(0)}%
          </span>
        </div>
        <p className="mb-3 text-[10px] text-ink-faint">
          base rate {(baseProb * 100).toFixed(0)}% + each feature&apos;s signed contribution → final score
        </p>

        <div className="flex flex-col gap-2">
          {rows.map((r) => {
            const pos = r.contrib >= 0;
            const w = (Math.abs(r.contrib) / maxAbs) * 50; // % of half-width
            return (
              <div key={r.key} className="text-[10px]" title={r.sentence}>
                <div className="mb-0.5 flex justify-between text-ink-dim">
                  <span>
                    {r.label} <span className="text-ink-faint">{r.raw}{r.unit ? ` ${r.unit}` : ""}</span>
                  </span>
                  <span className="tabular-nums" style={{ color: pos ? ACCENT : "#22d3ee" }}>
                    {pos ? "+" : "−"}
                    {Math.abs(r.contrib).toFixed(2)}
                  </span>
                </div>
                {/* diverging bar around a centre line */}
                <div className="relative h-3 w-full rounded" style={{ background: "#1c2540" }}>
                  <span className="absolute top-0 h-full w-px bg-ink-faint" style={{ left: "50%" }} aria-hidden="true" />
                  <span
                    className="absolute top-0 h-full rounded"
                    style={{
                      left: pos ? "50%" : `${50 - w}%`,
                      width: `${w}%`,
                      background: pos ? ACCENT : "#22d3ee",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 rounded-lg p-2 text-[11px] leading-snug" style={{ background: "rgba(168,85,247,0.12)", color: "#cbd3ef" }}>
          {rows.reduce((a, b) => (Math.abs(b.contrib) > Math.abs(a.contrib) ? b : a)).sentence} — the biggest driver.
        </p>

        {patient.outlier ? (
          <p
            className="mt-2 rounded-lg border p-2 text-[10px] leading-snug"
            style={{ borderColor: "#f59e0b", background: "rgba(245,158,11,0.10)", color: "#fcd34d" }}
          >
            ⚠️ Dataset bias: {patient.outlier}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Close explanation"
        >
          Close
        </button>
      </div>
    </div>
  );
}
