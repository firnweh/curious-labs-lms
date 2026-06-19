"use client";
// Learning goal: time-series models learn SMOOTH trends from past prices, so a
// good forecast follows the smoothed trend + momentum — it lags sudden news.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#a855f7";
const GOOD = "#34d399";
const BAD = "#f87171";

/** Days of fictional Reliant Industries closing price (5 trading years). */
const N_DAYS = 260 * 5;
/** The forecast round hides the last 60 days. */
const HIDDEN = 60;

/** Deterministic price series: drift + seasonal wiggle + one Jan-2024 shock. */
function buildSeries(): number[] {
  const out: number[] = [];
  const shockStart = 4 * 260 + 10; // ~Jan 2024
  for (let t = 0; t < N_DAYS; t++) {
    // smooth multi-phase drift (up, down, up, down, up)
    const phase = Math.sin((t / N_DAYS) * Math.PI * 2.6);
    const drift = 100 + t * 0.035 + phase * 22;
    // yearly seasonal wiggle + a gentle weekly ripple (deterministic, no noise)
    const seasonal = Math.sin((t / 260) * Math.PI * 2) * 6;
    const ripple = Math.sin(t * 0.45) * 1.1;
    // engineered news shock: a sharp spike that decays back to trend
    let shock = 0;
    if (t >= shockStart) {
      const age = t - shockStart;
      shock = 46 * Math.exp(-age / 9);
    }
    out.push(drift + seasonal + ripple + shock);
  }
  return out;
}

/** Centred-ish trailing rolling mean over `win` days. */
function rollingMean(series: number[], win: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i];
    if (i >= win) sum -= series[i - win];
    out.push(i >= win - 1 ? sum / win : null);
  }
  return out;
}

/** A chart region the learner must tag. */
interface Region {
  kind: "up" | "down" | "spike";
  /** inclusive day-index window that counts as a correct tag */
  lo: number;
  hi: number;
}

/** Fixed correct regions to discover: 3 up, 2 down, 1 anomaly. */
const REGIONS: readonly Region[] = [
  { kind: "up", lo: 40, hi: 170 },
  { kind: "down", lo: 360, hi: 520 },
  { kind: "up", lo: 620, hi: 820 },
  { kind: "down", lo: 900, hi: 1040 },
  { kind: "up", lo: 1090, hi: 1240 },
  { kind: "spike", lo: 1045, hi: 1085 }, // the Jan-2024 shock
] as const;

type Tool = "up" | "down" | "spike";

interface Marker {
  day: number;
  price: number;
  kind: Tool;
  ok: boolean;
}

/** The deterministic "LSTM": smoothed trend + recent momentum (NOT a network). */
function lstmForecast(series: number[], cut: number, steps: number): number[] {
  const win = 25;
  const start = Math.max(0, cut - win);
  let mean = 0;
  for (let i = start; i < cut; i++) mean += series[i];
  mean /= cut - start;
  const momentum = (series[cut - 1] - series[cut - 1 - win]) / win;
  const out: number[] = [];
  let level = mean + momentum * (win / 2);
  for (let s = 0; s < steps; s++) {
    level += momentum * 0.82; // momentum gently decays — smooth, no jumps
    out.push(level);
  }
  return out;
}

/** Forecast multiple-choice. The model ALWAYS follows the smoothed trend. */
const FORECAST_OPTS = [
  { id: "trend", label: "Follows the smoothed up-trend" },
  { id: "reverse", label: "Suddenly reverses downward" },
  { id: "flat", label: "Goes perfectly flat" },
  { id: "spike", label: "Jumps to a news spike" },
] as const;
type ForecastId = (typeof FORECAST_OPTS)[number]["id"];

/** 20-epoch training vs validation loss; validation turns up at epoch 12. */
const OVERFIT_EPOCH = 12;
function lossCurves(): { train: number[]; val: number[] } {
  const train: number[] = [];
  const val: number[] = [];
  for (let e = 0; e < 20; e++) {
    train.push(1.0 * Math.exp(-e / 6) + 0.04);
    const base = 1.0 * Math.exp(-e / 6) + 0.06;
    const over = e > OVERFIT_EPOCH ? (e - OVERFIT_EPOCH) * 0.022 : 0;
    val.push(base + over);
  }
  return { train, val };
}

type Stage = "tag" | "forecast" | "epoch" | "won";

export default function StockTrendForecaster({ onComplete }: ActivityProps) {
  const series = useMemo<number[]>(() => buildSeries(), []);
  const losses = useMemo(() => lossCurves(), []);

  const [stage, setStage] = useState<Stage>("tag");
  const [tool, setTool] = useState<Tool>("up");
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [win, setWin] = useState<number>(20);
  const [showMean, setShowMean] = useState<boolean>(false);
  const [showReturns, setShowReturns] = useState<boolean>(false);

  const [fcIndex, setFcIndex] = useState<number>(0);
  const [fcWrong, setFcWrong] = useState<number>(0);
  const [pickedEpoch, setPickedEpoch] = useState<number | null>(null);
  const [status, setStatus] = useState<string>(
    "Tag the chart: find 3 up-trends, 2 down-trends and 1 anomaly.",
  );
  const [showWhy, setShowWhy] = useState<boolean>(false);
  const completed = useRef<boolean>(false);

  // ---- chart geometry ----
  const W = 420;
  const H = 180;
  const PAD = 10;
  const lo = useMemo<number>(() => Math.min(...series), [series]);
  const hi = useMemo<number>(() => Math.max(...series), [series]);
  const sx = useCallback(
    (day: number): number => PAD + (day / (N_DAYS - 1)) * (W - PAD * 2),
    [],
  );
  const sy = useCallback(
    (price: number): number =>
      H - PAD - ((price - lo) / (hi - lo)) * (H - PAD * 2),
    [lo, hi],
  );

  const meanLine = useMemo(() => rollingMean(series, win), [series, win]);

  const pricePath = useMemo<string>(() => {
    return series
      .map((p, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(p).toFixed(1)}`)
      .join(" ");
  }, [series, sx, sy]);

  const meanPath = useMemo<string>(() => {
    let d = "";
    let started = false;
    meanLine.forEach((m, i) => {
      if (m == null) return;
      d += `${started ? "L" : "M"}${sx(i).toFixed(1)},${sy(m).toFixed(1)} `;
      started = true;
    });
    return d.trim();
  }, [meanLine, sx, sy]);

  // daily returns strip (sampled so the strip stays light)
  const returns = useMemo(() => {
    const step = 16;
    const bars: { x: number; r: number }[] = [];
    for (let i = step; i < N_DAYS; i += step) {
      bars.push({ x: sx(i), r: (series[i] - series[i - step]) / series[i - step] });
    }
    return bars;
  }, [series, sx]);

  const tagsCorrect = useMemo<number>(
    () => markers.filter((m) => m.ok).length,
    [markers],
  );

  // ---- tagging ----
  const onChartPointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (stage !== "tag") return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      const day = Math.round(((px - PAD) / (W - PAD * 2)) * (N_DAYS - 1));
      const clamped = Math.max(0, Math.min(N_DAYS - 1, day));
      // a marker is correct if it lands inside a region matching the active tool
      const region = REGIONS.find(
        (r) => r.kind === tool && clamped >= r.lo && clamped <= r.hi,
      );
      const ok = Boolean(region);
      const m: Marker = { day: clamped, price: series[clamped], kind: tool, ok };
      setMarkers((prev) => {
        // ignore a duplicate correct tag of the same region
        if (ok && region) {
          const dup = prev.some(
            (x) => x.ok && x.kind === tool && x.day >= region.lo && x.day <= region.hi,
          );
          if (dup) return prev;
        }
        return [...prev, m];
      });
      setStatus(
        ok
          ? "Snap! Correct region tagged."
          : "Not quite — try where the line clearly trends that way.",
      );
    },
    [stage, tool, series],
  );

  // advance to forecast once all 6 regions are correctly tagged
  useEffect(() => {
    if (stage === "tag" && tagsCorrect >= REGIONS.length) {
      setStage("forecast");
      setShowMean(true);
      setStatus("Now forecast: which way does the model's prediction go?");
    }
  }, [stage, tagsCorrect]);

  // forecast round: hide last 60 days, draw deterministic LSTM, ask 3 windows
  const FC_ROUNDS = 3;
  const fcCut = useMemo<number>(() => N_DAYS - HIDDEN, []);
  const fcPred = useMemo<number[]>(
    () => lstmForecast(series, fcCut, HIDDEN),
    [series, fcCut],
  );

  const predPath = useMemo<string>(() => {
    let d = `M${sx(fcCut - 1).toFixed(1)},${sy(series[fcCut - 1]).toFixed(1)} `;
    fcPred.forEach((p, i) => {
      d += `L${sx(fcCut + i).toFixed(1)},${sy(p).toFixed(1)} `;
    });
    return d.trim();
  }, [fcPred, fcCut, series, sx, sy]);

  const pickForecast = useCallback(
    (id: ForecastId) => {
      if (stage !== "forecast") return;
      if (id === "trend") {
        setStatus("Right — the model rides the smoothed trend + momentum.");
        if (fcIndex + 1 >= FC_ROUNDS) {
          setStage("epoch");
          setStatus("Click the epoch where VALIDATION loss starts rising.");
        } else {
          setFcIndex((i) => i + 1);
        }
      } else if (id === "spike") {
        setFcWrong((n) => n + 1);
        setShowWhy(true);
        setStatus("The model lags sudden news — it can't predict a spike.");
        onComplete({ passed: false, detail: "The model lags sudden news." });
      } else {
        setFcWrong((n) => n + 1);
        setStatus("A trained model stays near the smoothed trend — look again.");
        onComplete({ passed: false, detail: "Follow the smoothed trend." });
      }
    },
    [stage, fcIndex, onComplete],
  );

  // overfitting epoch
  const lp = useMemo(() => {
    const w = 200;
    const h = 96;
    const px = (e: number): number => 6 + (e / 19) * (w - 12);
    const maxL = Math.max(...losses.train, ...losses.val);
    const py = (l: number): number => h - 6 - (l / maxL) * (h - 12);
    const path = (arr: number[]): string =>
      arr.map((l, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(l).toFixed(1)}`).join(" ");
    return { w, h, px, py, train: path(losses.train), val: path(losses.val) };
  }, [losses]);

  const pickEpoch = useCallback(
    (e: number) => {
      if (stage !== "epoch") return;
      setPickedEpoch(e);
      if (e === OVERFIT_EPOCH) {
        setStage("won");
        setStatus("Overfitting epoch found — forecast locked in!");
      } else {
        setStatus(
          e < OVERFIT_EPOCH
            ? "Earlier than that — both losses still fall here."
            : "A bit earlier — find where the gap first opens.",
        );
      }
    },
    [stage],
  );

  // win: fire onComplete exactly once
  const rmse = useMemo<number>(() => {
    // deterministic RMSE that improves as wrong picks fall — always winnable
    return Number((1.4 + fcWrong * 0.6).toFixed(2));
  }, [fcWrong]);
  const rmseTarget = 3.0;

  useEffect(() => {
    if (stage === "won" && !completed.current) {
      completed.current = true;
      onComplete({
        passed: true,
        stars: 3,
        detail: `Tagged 6 features, found overfit @epoch ${OVERFIT_EPOCH}, RMSE ${rmse}.`,
      });
    }
  }, [stage, rmse, onComplete]);

  const reset = useCallback(() => {
    setStage("tag");
    setTool("up");
    setMarkers([]);
    setWin(20);
    setShowMean(false);
    setShowReturns(false);
    setFcIndex(0);
    setFcWrong(0);
    setPickedEpoch(null);
    setShowWhy(false);
    setStatus("Tag the chart: find 3 up-trends, 2 down-trends and 1 anomaly.");
    completed.current = false;
  }, []);

  const won = stage === "won";
  const showForecast = stage === "forecast" || stage === "epoch" || won;

  const toolBtns: { id: Tool; label: string; emoji: string; color: string }[] = [
    { id: "up", label: "Up-trend", emoji: "📈", color: GOOD },
    { id: "down", label: "Down-trend", emoji: "📉", color: BAD },
    { id: "spike", label: "Anomaly", emoji: "⚡", color: ACCENT },
  ];

  return (
    <div
      className="mx-auto flex w-full flex-col gap-3"
      style={{ maxWidth: 440 }}
    >
      <style>{`
        @keyframes g9stockforecast-draw { from { stroke-dashoffset: 600; } to { stroke-dashoffset: 0; } }
        @keyframes g9stockforecast-pop { 0% { transform: scale(0); } 70% { transform: scale(1.3); } 100% { transform: scale(1); } }
        @keyframes g9stockforecast-cele { 0% { transform: translateY(0); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-26px); opacity: 0; } }
      `}</style>

      <header className="flex items-center justify-between">
        <h2 className="font-display text-base" style={{ color: ACCENT }}>
          📈 Stock Trend Forecaster
        </h2>
        <span className="text-[11px] text-ink-faint">Reliant Industries · 5y</span>
      </header>

      {/* chart panel */}
      <div
        className="panel relative overflow-hidden rounded-xl p-2"
        style={won ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 24px -4px ${ACCENT}` } : undefined}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="Closing-price line chart for Reliant Industries with optional rolling-mean overlay."
          style={{ touchAction: "none", cursor: stage === "tag" ? "crosshair" : "default" }}
          onPointerDown={onChartPointer}
        >
          {/* hidden-window shade during forecast */}
          {showForecast && (
            <rect
              x={sx(fcCut - 1)}
              y={PAD}
              width={W - PAD - sx(fcCut - 1)}
              height={H - PAD * 2}
              fill={ACCENT}
              opacity={0.08}
            />
          )}

          {/* daily-returns strip */}
          {showReturns &&
            returns.map((b, i) => {
              const up = b.r >= 0;
              const hgt = Math.min(14, Math.abs(b.r) * 220);
              return (
                <rect
                  key={`ret${i}`}
                  x={b.x - 1.4}
                  y={up ? H - PAD - hgt - 24 : H - PAD - 24}
                  width={2.8}
                  height={hgt}
                  fill={up ? GOOD : BAD}
                  opacity={0.55}
                />
              );
            })}

          {/* price line (during forecast, only the visible part is solid) */}
          <path
            d={pricePath}
            fill="none"
            stroke="#64748b"
            strokeWidth={1}
            opacity={showForecast ? 0.35 : 0.9}
          />

          {/* rolling-mean overlay */}
          {(showMean || showForecast) && meanPath && (
            <path d={meanPath} fill="none" stroke={ACCENT} strokeWidth={1.4} opacity={0.95} />
          )}

          {/* LSTM prediction during forecast */}
          {showForecast && (
            <path
              d={predPath}
              fill="none"
              stroke={GOOD}
              strokeWidth={1.8}
              strokeDasharray="600"
              style={{ animation: "g9stockforecast-draw 1.1s ease forwards" }}
            />
          )}

          {/* correct-region hints once tagging is done */}
          {stage !== "tag" &&
            REGIONS.map((r, i) => (
              <line
                key={`reg${i}`}
                x1={sx((r.lo + r.hi) / 2)}
                y1={PAD}
                x2={sx((r.lo + r.hi) / 2)}
                y2={H - PAD}
                stroke={r.kind === "spike" ? ACCENT : r.kind === "up" ? GOOD : BAD}
                strokeWidth={0.5}
                opacity={0.25}
              />
            ))}

          {/* placed markers */}
          {markers.map((m, i) => (
            <g key={`mk${i}`} style={{ transformOrigin: `${sx(m.day)}px ${sy(m.price)}px` }}>
              <circle
                cx={sx(m.day)}
                cy={sy(m.price)}
                r={4}
                fill={m.ok ? GOOD : "none"}
                stroke={m.ok ? GOOD : BAD}
                strokeWidth={1.5}
                opacity={0.95}
                style={m.ok ? { animation: "g9stockforecast-pop 240ms ease" } : undefined}
              />
            </g>
          ))}

          {won && (
            <text
              x={W / 2}
              y={H / 2}
              textAnchor="middle"
              fontSize={18}
              fill={ACCENT}
              style={{ animation: "g9stockforecast-cele 1.4s ease forwards" }}
            >
              ✨🎉 ⭐⭐⭐
            </text>
          )}
        </svg>

        <div
          className="mt-1 rounded-md px-2 py-1 text-center text-xs"
          role="status"
          aria-live="polite"
          style={{ color: won ? ACCENT : "#9aa6cf" }}
        >
          {status}
        </div>
      </div>

      {/* TOOLBOX: rolling-mean + returns */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowMean((v) => !v)}
            aria-pressed={showMean}
            className="rounded-lg border px-2.5 py-1 font-medium"
            style={{
              borderColor: showMean ? ACCENT : "var(--color-line)",
              color: showMean ? ACCENT : "#cbd3ef",
              background: "rgba(11,16,32,0.6)",
            }}
          >
            Rolling mean
          </button>
          <button
            type="button"
            onClick={() => setShowReturns((v) => !v)}
            aria-pressed={showReturns}
            className="rounded-lg border px-2.5 py-1 font-medium"
            style={{
              borderColor: showReturns ? ACCENT : "var(--color-line)",
              color: showReturns ? ACCENT : "#cbd3ef",
              background: "rgba(11,16,32,0.6)",
            }}
          >
            Daily returns
          </button>
        </div>
        <label className="flex items-center gap-2 text-ink-dim">
          <span className="whitespace-nowrap">window {win}d</span>
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={win}
            onChange={(e) => setWin(Number(e.target.value))}
            aria-label={`Rolling-mean window, ${win} days`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
            style={{ accentColor: ACCENT }}
          />
        </label>
      </div>

      {/* STAGE: tagging tools */}
      {stage === "tag" && (
        <div className="panel flex flex-col gap-2 rounded-xl p-3">
          <p className="text-[11px] text-ink-faint">
            Pick a tool, then click the chart to tag a matching region.
          </p>
          <div className="flex gap-2" role="group" aria-label="Tagging tools">
            {toolBtns.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id)}
                aria-pressed={tool === t.id}
                aria-label={`Tag tool: ${t.label}`}
                className="flex flex-1 flex-col items-center rounded-lg border py-1.5 text-xs font-medium"
                style={{
                  borderColor: tool === t.id ? t.color : "var(--color-line)",
                  color: tool === t.id ? t.color : "#cbd3ef",
                  background: "rgba(11,16,32,0.6)",
                }}
              >
                <span aria-hidden="true">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-center text-xs text-ink-faint">
            tagged {tagsCorrect} / {REGIONS.length}
          </span>
        </div>
      )}

      {/* STAGE: forecast choices */}
      {stage === "forecast" && (
        <div className="panel flex flex-col gap-2 rounded-xl p-3">
          <p className="text-xs text-ink-dim">
            Window {fcIndex + 1} / {FC_ROUNDS} — the green line is the model&apos;s
            forecast for the hidden 60 days. Where does it head?
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {FORECAST_OPTS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => pickForecast(o.id)}
                className="rounded-lg border px-3 py-2 text-left text-xs font-medium"
                style={{
                  borderColor: "var(--color-line)",
                  color: "#cbd3ef",
                  background: "rgba(11,16,32,0.6)",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STAGE: overfitting epoch */}
      {(stage === "epoch" || won) && (
        <div className="panel flex flex-col gap-2 rounded-xl p-3">
          <p className="text-xs text-ink-dim">
            Training (cyan) vs validation (violet) loss over 20 epochs. Click where
            validation loss starts <strong>rising</strong> — that&apos;s overfitting.
          </p>
          <svg
            viewBox={`0 0 ${lp.w} ${lp.h}`}
            className="block w-full"
            role="img"
            aria-label="Training versus validation loss curves over 20 epochs."
            style={{ touchAction: "manipulation" }}
          >
            <path d={lp.train} fill="none" stroke="#22d3ee" strokeWidth={1.5} />
            <path d={lp.val} fill="none" stroke={ACCENT} strokeWidth={1.5} />
            {losses.val.map((_, e) => (
              <rect
                key={`ep${e}`}
                x={lp.px(e) - 4}
                y={2}
                width={8}
                height={lp.h - 4}
                fill="transparent"
                style={{ cursor: won ? "default" : "pointer" }}
                onPointerDown={() => pickEpoch(e)}
                aria-label={`Epoch ${e}`}
              />
            ))}
            {pickedEpoch != null && (
              <line
                x1={lp.px(pickedEpoch)}
                y1={2}
                x2={lp.px(pickedEpoch)}
                y2={lp.h - 2}
                stroke={pickedEpoch === OVERFIT_EPOCH ? GOOD : "#facc15"}
                strokeWidth={1.5}
                strokeDasharray={pickedEpoch === OVERFIT_EPOCH ? "0" : "3 3"}
              />
            )}
          </svg>
          <span className="text-center text-[11px] text-ink-faint">
            RMSE {rmse} · target &lt; {rmseTarget.toFixed(1)}
          </span>
        </div>
      )}

      {/* "Why did Jan 2024 spike?" reveal card */}
      {(showWhy || won) && (
        <div
          className="rounded-xl border p-3 text-xs"
          style={{ borderColor: ACCENT, background: "rgba(168,85,247,0.08)" }}
        >
          <p className="mb-1 font-display" style={{ color: ACCENT }}>
            ⚡ Why did Jan 2024 spike?
          </p>
          <p className="leading-snug text-ink-dim">
            Reliant won a surprise government mega-contract — breaking news no past
            price contained. The model only learns smooth trends, so it
            <strong> lagged</strong> the shock and could not have predicted it.
          </p>
        </div>
      )}

      {/* win + reset */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: won ? ACCENT : "#5f7194" }}>
          {won ? "✨🎉 Forecast complete ⭐⭐⭐" : "Reach RMSE under target to win."}
        </span>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-dim"
          aria-label="Reset the lab"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
