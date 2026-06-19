"use client";
// Learning goal: a regression model finds patterns between weather variables and
// rainfall — picking the most CORRELATED features (humidity + pressure) raises
// R² and drops the prediction error, letting you forecast tomorrow within tolerance.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#a855f7";

/** Feature keys the learner can feed to the regression. */
type FeatureKey = "temperature" | "humidity" | "pressure" | "wind";

/** One day of weather. `rainfall` is the value we model & predict. */
interface Row {
  temperature: number; // °C
  humidity: number; // %
  pressure: number; // hPa (offset from 1000)
  wind: number; // km/h
  rainfall: number; // mm
}

/**
 * Fixed 30-row dataset. Rainfall is built from a hidden ground-truth rule
 *   rainfall ≈ 0.42·humidity − 0.9·pressure  (+ small noise)
 * so humidity & pressure are STRONGLY correlated with rain, while temperature
 * and wind are noisy / weak. Hand-tuned so the winning feature set provably
 * clears the targets — deterministic & always solvable.
 */
const DATA: readonly Row[] = [
  { temperature: 22, humidity: 80, pressure: 6, rainfall: 28, wind: 12 },
  { temperature: 19, humidity: 88, pressure: 2, rainfall: 35, wind: 7 },
  { temperature: 27, humidity: 45, pressure: 14, rainfall: 6, wind: 18 },
  { temperature: 24, humidity: 62, pressure: 9, rainfall: 18, wind: 9 },
  { temperature: 18, humidity: 92, pressure: 1, rainfall: 38, wind: 20 },
  { temperature: 30, humidity: 38, pressure: 16, rainfall: 2, wind: 5 },
  { temperature: 21, humidity: 74, pressure: 7, rainfall: 25, wind: 14 },
  { temperature: 26, humidity: 55, pressure: 11, rainfall: 13, wind: 8 },
  { temperature: 17, humidity: 95, pressure: 0, rainfall: 41, wind: 11 },
  { temperature: 29, humidity: 41, pressure: 15, rainfall: 4, wind: 22 },
  { temperature: 23, humidity: 70, pressure: 8, rainfall: 22, wind: 6 },
  { temperature: 20, humidity: 84, pressure: 3, rainfall: 33, wind: 16 },
  { temperature: 28, humidity: 48, pressure: 13, rainfall: 8, wind: 10 },
  { temperature: 25, humidity: 60, pressure: 10, rainfall: 16, wind: 19 },
  { temperature: 16, humidity: 90, pressure: 2, rainfall: 36, wind: 4 },
  { temperature: 31, humidity: 35, pressure: 17, rainfall: 1, wind: 13 },
  { temperature: 22, humidity: 77, pressure: 6, rainfall: 26, wind: 21 },
  { temperature: 19, humidity: 86, pressure: 4, rainfall: 30, wind: 9 },
  { temperature: 27, humidity: 52, pressure: 12, rainfall: 11, wind: 15 },
  { temperature: 24, humidity: 66, pressure: 9, rainfall: 20, wind: 7 },
  { temperature: 18, humidity: 93, pressure: 1, rainfall: 39, wind: 17 },
  { temperature: 30, humidity: 40, pressure: 15, rainfall: 5, wind: 6 },
  { temperature: 21, humidity: 72, pressure: 7, rainfall: 24, wind: 12 },
  { temperature: 26, humidity: 58, pressure: 11, rainfall: 14, wind: 20 },
  { temperature: 17, humidity: 96, pressure: 0, rainfall: 42, wind: 8 },
  { temperature: 29, humidity: 44, pressure: 14, rainfall: 7, wind: 11 },
  { temperature: 23, humidity: 68, pressure: 8, rainfall: 21, wind: 5 },
  { temperature: 20, humidity: 82, pressure: 3, rainfall: 32, wind: 18 },
  { temperature: 28, humidity: 50, pressure: 13, rainfall: 9, wind: 14 },
  { temperature: 25, humidity: 64, pressure: 10, rainfall: 17, wind: 10 },
] as const;

/** The known next-day rainfall for the prediction challenge (ground truth). */
const TRUE_TOMORROW = 31; // mm — for humidity 78%, pressure 5 hPa
const PREDICT_HUMIDITY = 78;
const PREDICT_PRESSURE = 5;
const TOLERANCE = 5; // mm band around the true value

/** Win thresholds shown to the learner. */
const TARGET_R2 = 0.9;
const TARGET_RMSE = 4.5; // mm

const FEATURES: { key: FeatureKey; label: string; unit: string; emoji: string }[] = [
  { key: "temperature", label: "Temperature", unit: "°C", emoji: "🌡️" },
  { key: "humidity", label: "Humidity", unit: "%", emoji: "💧" },
  { key: "pressure", label: "Pressure", unit: "hPa", emoji: "🧭" },
  { key: "wind", label: "Wind", unit: "km/h", emoji: "💨" },
];

/** Precomputed Pearson correlation of each feature with rainfall (badge only). */
const CORR: Record<FeatureKey, number> = {
  humidity: 0.99,
  pressure: -0.98,
  temperature: -0.86,
  wind: 0.04,
};

function corrBadge(r: number): { text: string; color: string } {
  const a = Math.abs(r);
  if (a >= 0.8) return { text: "STRONG", color: "#34d399" };
  if (a >= 0.4) return { text: "MEDIUM", color: "#fbbf24" };
  return { text: "WEAK", color: "#f87171" };
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/**
 * Deterministic least-squares fit of rainfall on the chosen features via
 * normal equations  β = (XᵀX)⁻¹ Xᵀy  with a leading intercept column.
 * Returns coefficients (β₀ + per-feature) plus MAE / RMSE / R² on the data.
 */
interface FitResult {
  coef: number[]; // [intercept, ...one per selected feature]
  selected: FeatureKey[];
  mae: number;
  rmse: number;
  r2: number;
  predicted: number[]; // per-row prediction (for the scatter)
}

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Augmented matrix, Gaussian elimination with partial pivoting.
  const M: number[][] = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const pv = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

function fit(selected: FeatureKey[]): FitResult {
  const y = DATA.map((d) => d.rainfall);
  const yMean = mean(y);
  // Design matrix rows: [1, f1, f2, ...]
  const X: number[][] = DATA.map((d) => [1, ...selected.map((k) => d[k])]);
  const p = selected.length + 1;
  // Normal equations: XᵀX β = Xᵀy
  const XtX: number[][] = Array.from({ length: p }, () => Array<number>(p).fill(0));
  const Xty: number[] = Array<number>(p).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const coef = solveLinearSystem(XtX, Xty) ?? Array<number>(p).fill(0);
  const predicted = X.map((row) => row.reduce((s, v, j) => s + v * coef[j], 0));
  let sae = 0;
  let sse = 0;
  let sst = 0;
  for (let i = 0; i < y.length; i++) {
    const e = y[i] - predicted[i];
    sae += Math.abs(e);
    sse += e * e;
    sst += (y[i] - yMean) ** 2;
  }
  const n = y.length;
  return {
    coef,
    selected,
    mae: sae / n,
    rmse: Math.sqrt(sse / n),
    r2: sst < 1e-9 ? 0 : 1 - sse / sst,
    predicted,
  };
}

/** Predict rainfall for given humidity/pressure using a fitted model. */
function predictWith(f: FitResult, humidity: number, pressure: number): number {
  let v = f.coef[0];
  f.selected.forEach((k, i) => {
    const x = k === "humidity" ? humidity : k === "pressure" ? pressure : 0;
    v += f.coef[i + 1] * x;
  });
  return v;
}

export default function WeatherPredictor({ onComplete }: ActivityProps) {
  const [xVar, setXVar] = useState<FeatureKey>("humidity");
  const [selected, setSelected] = useState<Record<FeatureKey, boolean>>({
    temperature: true,
    humidity: false,
    pressure: false,
    wind: true,
  });
  const [trained, setTrained] = useState<FitResult | null>(null);
  const [humidity, setHumidity] = useState<number>(60);
  const [pressure, setPressure] = useState<number>(10);
  const [predicted, setPredicted] = useState<number | null>(null);
  const [status, setStatus] = useState<string>(
    "Explore the scatter plots, then train a model on the best features.",
  );
  const [done, setDone] = useState<boolean>(false);
  const firedRef = useRef<boolean>(false);

  const chosen = useMemo(
    () => FEATURES.map((f) => f.key).filter((k) => selected[k]),
    [selected],
  );

  // ── Scatter plot (chosen X variable vs rainfall) ──────────────────────────
  const scatter = useMemo(() => {
    const xs = DATA.map((d) => d[xVar]);
    const ys = DATA.map((d) => d.rainfall);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const PAD = 10;
    const W = 100;
    const H = 64;
    const sx = (x: number): number =>
      PAD + ((x - xMin) / (xMax - xMin || 1)) * (W - PAD * 2);
    const sy = (y: number): number =>
      H - PAD - ((y - yMin) / (yMax - yMin || 1)) * (H - PAD * 2);
    const pts = DATA.map((d) => ({ cx: sx(d[xVar]), cy: sy(d.rainfall) }));
    return { pts, W, H };
  }, [xVar]);

  const badge = corrBadge(CORR[xVar]);

  // ── Actual-vs-predicted scatter for the trained model ─────────────────────
  const fitScatter = useMemo(() => {
    if (!trained) return null;
    const ys = DATA.map((d) => d.rainfall);
    const lo = Math.min(...ys, ...trained.predicted);
    const hi = Math.max(...ys, ...trained.predicted);
    const PAD = 10;
    const S = 64;
    const map = (v: number): number =>
      PAD + ((v - lo) / (hi - lo || 1)) * (S - PAD * 2);
    const pts = DATA.map((d, i) => ({
      cx: map(d.rainfall),
      cy: S - map(trained.predicted[i]),
    }));
    return { pts, S, lineFrom: PAD, lineTo: S - PAD };
  }, [trained]);

  const toggle = useCallback(
    (key: FeatureKey): void => {
      if (done) return;
      setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
      setTrained(null);
      setPredicted(null);
      setStatus("Features changed — press Train to refit the model.");
    },
    [done],
  );

  const train = useCallback((): void => {
    if (done) return;
    if (chosen.length === 0) {
      setStatus("Pick at least one feature to train on.");
      onComplete({ passed: false, detail: "Select a feature first." });
      return;
    }
    const result = fit(chosen);
    setTrained(result);
    setPredicted(null);
    if (result.r2 >= TARGET_R2 && result.rmse <= TARGET_RMSE) {
      setStatus(
        `Great fit! R² ${result.r2.toFixed(2)} ≥ ${TARGET_R2} and RMSE ${result.rmse.toFixed(
          1,
        )} ≤ ${TARGET_RMSE}. Now predict tomorrow's rain.`,
      );
    } else {
      const r = result.r2.toFixed(2);
      setStatus(
        `Model trained: R² ${r}, RMSE ${result.rmse.toFixed(
          1,
        )} mm. Try swapping in features that correlate strongly with rain.`,
      );
      onComplete({ passed: false, detail: "Keep the strongly-correlated features." });
    }
  }, [chosen, done, onComplete]);

  const goodModel = !!trained && trained.r2 >= TARGET_R2 && trained.rmse <= TARGET_RMSE;

  const predict = useCallback((): void => {
    if (done || !trained) return;
    const value = predictWith(trained, humidity, pressure);
    setPredicted(value);
    if (!goodModel) {
      setStatus("Train a good model (clear both targets) before trusting a forecast.");
      onComplete({ passed: false, detail: "Improve the model first." });
      return;
    }
    // Final win check: good model + prediction made for the challenge inputs
    // lands inside the tolerance band of the known next-day value.
    const challenge = predictWith(trained, PREDICT_HUMIDITY, PREDICT_PRESSURE);
    const off = Math.abs(challenge - TRUE_TOMORROW);
    if (humidity === PREDICT_HUMIDITY && pressure === PREDICT_PRESSURE && off <= TOLERANCE) {
      setDone(true);
      setStatus("Forecast within tolerance — your model nailed tomorrow's rain!");
      if (!firedRef.current) {
        firedRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail: `R² ${trained.r2.toFixed(2)}, RMSE ${trained.rmse.toFixed(1)} mm.`,
        });
      }
    } else if (off <= TOLERANCE) {
      setStatus(
        `Predicted ${value.toFixed(1)} mm. To win, set humidity ${PREDICT_HUMIDITY}% and pressure ${PREDICT_PRESSURE} hPa to match the known day.`,
      );
    } else {
      setStatus(`Predicted ${value.toFixed(1)} mm. Match the challenge inputs to compare with the real value.`);
    }
  }, [done, trained, humidity, pressure, goodModel, onComplete]);

  const reset = useCallback((): void => {
    setXVar("humidity");
    setSelected({ temperature: true, humidity: false, pressure: false, wind: true });
    setTrained(null);
    setHumidity(60);
    setPressure(10);
    setPredicted(null);
    setDone(false);
    firedRef.current = false;
    setStatus("Explore the scatter plots, then train a model on the best features.");
  }, []);

  const r2Pct = trained ? Math.max(0, Math.min(1, trained.r2)) * 100 : 0;

  return (
    <div className="flex w-full flex-col gap-3 font-mono text-ink" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g8weatherpredictor-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g8weatherpredictor-fill {
          from { width: 0%; }
        }
      `}</style>

      {/* ── 1. Explore: scatter plot vs rainfall ─────────────────────────── */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-ink-dim">
            <span>📈 Plot</span>
            <select
              value={xVar}
              onChange={(e) => setXVar(e.target.value as FeatureKey)}
              aria-label="Choose the X-axis weather variable to plot against rainfall"
              className="rounded-md border border-line bg-panel/60 px-2 py-1 text-ink"
              style={{ accentColor: ACCENT }}
            >
              {FEATURES.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <span className="text-ink-faint">vs rainfall</span>
          </label>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: `${badge.color}22`, color: badge.color }}
            aria-label={`Correlation strength: ${badge.text}, r equals ${CORR[xVar].toFixed(2)}`}
          >
            {badge.text} · r={CORR[xVar].toFixed(2)}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${scatter.W} ${scatter.H}`}
          className="block w-full"
          role="img"
          aria-label={`Scatter plot of ${xVar} versus rainfall`}
        >
          <line x1={10} y1={scatter.H - 10} x2={scatter.W - 6} y2={scatter.H - 10} stroke="#27314f" strokeWidth={0.4} />
          <line x1={10} y1={6} x2={10} y2={scatter.H - 10} stroke="#27314f" strokeWidth={0.4} />
          {scatter.pts.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r={1.5} fill={ACCENT} opacity={0.85} />
          ))}
        </svg>
      </div>

      {/* ── 2. Feature selection + Train ─────────────────────────────────── */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <span className="text-xs text-ink-dim">🧪 Features feeding the regression</span>
        <div className="grid grid-cols-2 gap-2">
          {FEATURES.map((f) => {
            const on = selected[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onPointerDown={() => toggle(f.key)}
                aria-pressed={on}
                aria-label={`${f.label} feature, ${on ? "selected" : "not selected"}`}
                className="flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs transition"
                style={{
                  borderColor: on ? ACCENT : "var(--color-line, #27314f)",
                  background: on ? `${ACCENT}1f` : "rgba(11,16,32,0.6)",
                  color: on ? "#e9d5ff" : "#9aa6cf",
                  touchAction: "manipulation",
                }}
              >
                <span>
                  {f.emoji} {f.label}
                </span>
                <span aria-hidden="true">{on ? "✓" : "+"}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onPointerDown={train}
          disabled={done}
          aria-label="Train the linear regression on the selected features"
          className="mt-1 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ background: ACCENT, color: "#0a0612", touchAction: "manipulation" }}
        >
          ⚙️ Train model
        </button>

        {trained && (
          <div className="mt-1 flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <Metric label="MAE" value={`${trained.mae.toFixed(1)}`} unit="mm" />
              <Metric
                label="RMSE"
                value={`${trained.rmse.toFixed(1)}`}
                unit="mm"
                good={trained.rmse <= TARGET_RMSE}
              />
              <Metric
                label="R²"
                value={trained.r2.toFixed(2)}
                unit={`≥${TARGET_R2}`}
                good={trained.r2 >= TARGET_R2}
              />
            </div>
            {/* R² bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-panel-2" aria-hidden="true">
              <div
                style={{
                  width: `${r2Pct}%`,
                  height: "100%",
                  background: goodModel ? "#34d399" : ACCENT,
                  animation: "g8weatherpredictor-fill 500ms ease",
                }}
              />
            </div>
            {fitScatter && (
              <svg
                viewBox={`0 0 ${fitScatter.S} ${fitScatter.S}`}
                className="mx-auto block w-2/3"
                role="img"
                aria-label="Actual versus predicted rainfall scatter; points near the diagonal mean a good fit"
              >
                <line
                  x1={fitScatter.lineFrom}
                  y1={fitScatter.lineTo}
                  x2={fitScatter.lineTo}
                  y2={fitScatter.lineFrom}
                  stroke="#27314f"
                  strokeWidth={0.5}
                  strokeDasharray="2 2"
                />
                {fitScatter.pts.map((p, i) => (
                  <circle key={i} cx={p.cx} cy={p.cy} r={1.4} fill={goodModel ? "#34d399" : ACCENT} />
                ))}
              </svg>
            )}
            {goodModel && (
              <span
                className="self-center rounded-full px-3 py-1 text-[11px] font-bold"
                style={{
                  background: "#34d39922",
                  color: "#34d399",
                  animation: "g8weatherpredictor-pop 360ms ease",
                }}
              >
                ✅ good model
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 3. Predict tomorrow ──────────────────────────────────────────── */}
      <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
        <span className="text-xs text-ink-dim">
          🔮 Predict tomorrow&apos;s rain — match humidity {PREDICT_HUMIDITY}% &amp; pressure {PREDICT_PRESSURE} hPa to test against the known {TRUE_TOMORROW} mm day.
        </span>
        <SliderRow
          label="Humidity"
          unit="%"
          min={35}
          max={96}
          value={humidity}
          onChange={(v) => {
            setHumidity(v);
            setPredicted(null);
          }}
        />
        <SliderRow
          label="Pressure"
          unit="hPa"
          min={0}
          max={17}
          value={pressure}
          onChange={(v) => {
            setPressure(v);
            setPredicted(null);
          }}
        />
        <button
          type="button"
          onPointerDown={predict}
          disabled={done || !trained}
          aria-label="Predict tomorrow's rainfall with the trained model"
          className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40"
          style={{
            borderColor: ACCENT,
            color: "#e9d5ff",
            background: "rgba(11,16,32,0.6)",
            touchAction: "manipulation",
          }}
        >
          🔮 Predict rainfall
        </button>
        {predicted !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-dim">
              predicted: <span style={{ color: ACCENT }}>{predicted.toFixed(1)} mm</span>
            </span>
            {humidity === PREDICT_HUMIDITY && pressure === PREDICT_PRESSURE && (
              <span className="text-ink-faint">true: {TRUE_TOMORROW} mm</span>
            )}
          </div>
        )}
      </div>

      {/* status + win + reset */}
      <div
        className="rounded-xl px-3 py-2 text-center text-xs"
        role="status"
        aria-live="polite"
        style={{
          background: done ? `${ACCENT}26` : "transparent",
          color: done ? "#e9d5ff" : "#9aa6cf",
          boxShadow: done ? `0 0 0 1px ${ACCENT}, 0 0 24px -6px ${ACCENT}` : undefined,
        }}
      >
        {done ? (
          <span
            className="font-display"
            style={{ animation: "g8weatherpredictor-pop 420ms ease", display: "inline-block" }}
          >
            ✨🎉 Model trained &amp; forecast nailed! ⭐⭐⭐
          </span>
        ) : (
          status
        )}
      </div>

      <button
        type="button"
        onPointerDown={reset}
        className="self-center rounded-lg border border-line bg-panel/60 px-4 py-1.5 text-xs font-medium text-ink-dim"
        aria-label="Reset the lab to its starting state"
        style={{ touchAction: "manipulation" }}
      >
        Reset
      </button>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  good,
}: {
  label: string;
  value: string;
  unit: string;
  good?: boolean;
}) {
  const color = good === undefined ? "#cbd3ef" : good ? "#34d399" : "#f87171";
  return (
    <div className="rounded-lg border border-line bg-panel/40 px-1 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className="font-display tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[8px] text-ink-faint">{unit}</div>
    </div>
  );
}

function SliderRow({
  label,
  unit,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="flex items-center justify-between">
        <span className="text-ink-dim">{label}</span>
        <span className="font-display tabular-nums" style={{ color: ACCENT }}>
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label}, current value ${value} ${unit}`}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
        style={{ accentColor: ACCENT, touchAction: "none" }}
      />
    </label>
  );
}
