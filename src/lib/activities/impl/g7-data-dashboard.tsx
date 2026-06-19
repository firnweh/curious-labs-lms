"use client";
import type { ActivityProps } from "@/lib/activities/types";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Data Detective Dashboard — one data pipeline, three honest steps:  */
/*  CLEAN the dataset (handle missing values without losing a city),   */
/*  VISUALISE (pick the chart that actually answers each question),    */
/*  then INTERPRET (read the real trend the chart reveals).            */
/*  Learning goal: a good answer needs clean data + the right chart.   */
/* ------------------------------------------------------------------ */

const ACCENT = "#a855f7";
const RED = "#f87171";
const GREEN = "#34d399";

/** One city's weather row. `null` = a deliberately missing value. */
interface Row {
  city: string;
  temp: number | null; // °C
  humidity: number | null; // %
  rainfall: number; // mm
}

/**
 * Fixed dataset. Two cells are blank (Pune.temp, Kochi.humidity).
 * The non-blank temps & humidities rise together, so the cleaned
 * scatter shows a clear POSITIVE trend — the baked-in insight.
 */
const RAW: readonly Row[] = [
  { city: "Delhi", temp: 22, humidity: 40, rainfall: 8 },
  { city: "Pune", temp: null, humidity: 52, rainfall: 15 },
  { city: "Mumbai", temp: 30, humidity: 70, rainfall: 60 },
  { city: "Chennai", temp: 34, humidity: 78, rainfall: 30 },
  { city: "Kochi", temp: 28, humidity: null, rainfall: 90 },
  { city: "Shimla", temp: 16, humidity: 35, rainfall: 12 },
] as const;

/** Column average over the present (non-null) values, rounded. */
function columnAverage(key: "temp" | "humidity"): number {
  const present = RAW.map((r) => r[key]).filter((v): v is number => v !== null);
  const sum = present.reduce((a, b) => a + b, 0);
  return Math.round(sum / present.length);
}

const TEMP_AVG = columnAverage("temp"); // ≈ 26
const HUM_AVG = columnAverage("humidity"); // ≈ 55

/** How each blank cell is handled. */
type FixChoice = "none" | "fill" | "drop";

/** Which chart was dropped on a question card. */
type ChartType = "line" | "bar" | "scatter" | "heatmap";

interface ChartTile {
  type: ChartType;
  label: string;
  emoji: string;
}

const TILES: readonly ChartTile[] = [
  { type: "line", label: "Line", emoji: "📈" },
  { type: "bar", label: "Bar", emoji: "📊" },
  { type: "scatter", label: "Scatter", emoji: "🔵" },
  { type: "heatmap", label: "Heatmap", emoji: "🟥" },
] as const;

interface Question {
  id: string;
  ask: string;
  correct: ChartType;
  /** Why a mismatched chart fails to answer this question. */
  hides: string;
}

const QUESTIONS: readonly Question[] = [
  { id: "trend", ask: "Temperature trend across the year's months", correct: "line", hides: "this hides the trend over time" },
  { id: "compare", ask: "Compare the temperature of each city", correct: "bar", hides: "this hides the city-by-city compare" },
  { id: "relate", ask: "Is temperature linked to humidity?", correct: "scatter", hides: "this hides the point-by-point link" },
  { id: "together", ask: "Which factors move together overall?", correct: "heatmap", hides: "this hides the all-pairs view" },
] as const;

type Assignment = Record<string, ChartType | null>;

const INSIGHT_OPTIONS: readonly { id: string; text: string; correct: boolean }[] = [
  { id: "rise", text: "rises too", correct: true },
  { id: "fall", text: "falls", correct: false },
  { id: "flat", text: "stays flat", correct: false },
] as const;

export default function DataDashboard({ onComplete }: ActivityProps) {
  // Stage 1 — cleaning choices for the two blank cells.
  const [puneFix, setPuneFix] = useState<FixChoice>("none");
  const [kochiFix, setKochiFix] = useState<FixChoice>("none");
  // Stage 2 — which chart tile sits on each question card.
  const [assign, setAssign] = useState<Assignment>({
    trend: null,
    compare: null,
    relate: null,
    together: null,
  });
  const [dragging, setDragging] = useState<ChartType | null>(null);
  // Stage 3 — chosen insight.
  const [insight, setInsight] = useState<string | null>(null);

  const doneRef = useRef<boolean>(false);
  const [won, setWon] = useState<boolean>(false);

  // ---- Stage 1 results ---------------------------------------------------
  // Filling keeps the row; dropping removes it (and loses a city we need).
  const rowsKept = useMemo<number>(() => {
    let kept = RAW.length;
    if (puneFix === "drop") kept -= 1;
    if (kochiFix === "drop") kept -= 1;
    return kept;
  }, [puneFix, kochiFix]);

  const cleanOk = puneFix === "fill" && kochiFix === "fill";

  /** The cleaned dataset the charts are drawn from (fills applied). */
  const cleaned = useMemo<{ city: string; temp: number; humidity: number; rainfall: number }[]>(() => {
    return RAW.filter((r) => {
      if (r.city === "Pune" && puneFix === "drop") return false;
      if (r.city === "Kochi" && kochiFix === "drop") return false;
      return true;
    }).map((r) => ({
      city: r.city,
      temp: r.temp ?? (puneFix === "fill" ? TEMP_AVG : 0),
      humidity: r.humidity ?? (kochiFix === "fill" ? HUM_AVG : 0),
      rainfall: r.rainfall,
    }));
  }, [puneFix, kochiFix]);

  // ---- Stage 2 results ---------------------------------------------------
  const chartsOk = useMemo<boolean>(
    () => QUESTIONS.every((q) => assign[q.id] === q.correct),
    [assign],
  );

  // ---- Win check ---------------------------------------------------------
  const insightOk = insight === "rise";
  const allOk = cleanOk && chartsOk && insightOk;

  const tryWin = useCallback(() => {
    if (allOk && !doneRef.current) {
      doneRef.current = true;
      setWon(true);
      onComplete({
        passed: true,
        stars: 3,
        detail:
          "Pipeline complete — you filled the gaps, matched every chart, and read the real trend: warmer cities are more humid.",
      });
    } else if (!allOk) {
      // A kind, recoverable nudge — never blocks another attempt.
      const nudge = !cleanOk
        ? "Almost! Dropping a row throws away a city you need later — try filling instead."
        : !chartsOk
          ? "Some chart cards still hide the answer. Match each to the question it makes clear."
          : "Look again at the scatter: as the dots go right, do they go up or down?";
      onComplete({ passed: false, detail: nudge });
    }
  }, [allOk, cleanOk, chartsOk, onComplete]);

  const reset = useCallback(() => {
    setPuneFix("none");
    setKochiFix("none");
    setAssign({ trend: null, compare: null, relate: null, together: null });
    setInsight(null);
    setWon(false);
    doneRef.current = false;
  }, []);

  const dropOnCard = useCallback(
    (qid: string) => {
      if (won || dragging === null) return;
      setAssign((prev) => ({ ...prev, [qid]: dragging }));
    },
    [won, dragging],
  );

  // Reveal each stage progressively so the pipeline reads top-to-bottom.
  const stage2Open = cleanOk;
  const stage3Open = cleanOk && chartsOk;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g7datadashboard-pop {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g7datadashboard-glow {
          0%,100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* ===================== STAGE 1 — CLEAN ===================== */}
      <section className="panel flex flex-col gap-2 rounded-xl p-3">
        <Header n={1} title="Clean the data" done={cleanOk} />
        <p className="text-[11px] text-ink-faint">
          Two cells are blank. Fill them with the column average to keep every city — or drop the row and lose one.
        </p>

        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full border-collapse text-center text-[11px]">
            <thead>
              <tr className="bg-panel-2/70 text-ink-dim">
                <th className="px-1 py-1 text-left font-normal">City</th>
                <th className="px-1 py-1 font-normal">Temp °C</th>
                <th className="px-1 py-1 font-normal">Humidity %</th>
                <th className="px-1 py-1 font-normal">Rain mm</th>
              </tr>
            </thead>
            <tbody>
              {RAW.map((r) => {
                const puneBlank = r.city === "Pune";
                const kochiBlank = r.city === "Kochi";
                const dropped =
                  (puneBlank && puneFix === "drop") || (kochiBlank && kochiFix === "drop");
                return (
                  <tr
                    key={r.city}
                    className="border-t border-line"
                    style={dropped ? { opacity: 0.3, textDecoration: "line-through" } : undefined}
                  >
                    <td className="px-1 py-1 text-left text-ink-dim">{r.city}</td>
                    <td className="px-1 py-1 tabular-nums">
                      <Cell value={r.temp} fill={puneBlank && puneFix === "fill" ? TEMP_AVG : null} />
                    </td>
                    <td className="px-1 py-1 tabular-nums">
                      <Cell value={r.humidity} fill={kochiBlank && kochiFix === "fill" ? HUM_AVG : null} />
                    </td>
                    <td className="px-1 py-1 tabular-nums text-ink-dim">{r.rainfall}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FixPicker
            label="Pune · blank temp"
            value={puneFix}
            onChange={setPuneFix}
            avg={TEMP_AVG}
            unit="°C"
          />
          <FixPicker
            label="Kochi · blank humidity"
            value={kochiFix}
            onChange={setKochiFix}
            avg={HUM_AVG}
            unit="%"
          />
        </div>

        <div
          className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs"
          role="status"
          aria-live="polite"
          style={{ borderColor: cleanOk ? GREEN : "var(--color-line)", color: cleanOk ? GREEN : "var(--color-ink-dim)" }}
        >
          <span>rows kept</span>
          <span className="font-display tabular-nums" style={{ color: cleanOk ? GREEN : rowsKept < 6 ? RED : ACCENT }}>
            {rowsKept} / 6
          </span>
        </div>
      </section>

      {/* ===================== STAGE 2 — VISUALISE ===================== */}
      <section
        className="panel flex flex-col gap-2 rounded-xl p-3"
        style={stage2Open ? undefined : { opacity: 0.45, pointerEvents: "none" }}
        aria-hidden={!stage2Open}
      >
        <Header n={2} title="Pick the right chart" done={chartsOk} />
        <p className="text-[11px] text-ink-faint">
          Drag a chart type onto each question. The mini-chart redraws from your cleaned data — watch which one answers it.
        </p>

        {/* draggable palette */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Chart type tiles to drag">
          {TILES.map((t) => (
            <button
              key={t.type}
              type="button"
              draggable
              onDragStart={() => setDragging(t.type)}
              onDragEnd={() => setDragging(null)}
              onPointerDown={() => setDragging(t.type)}
              aria-label={`${t.label} chart tile`}
              className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium"
              style={{
                touchAction: "none",
                borderColor: dragging === t.type ? ACCENT : "var(--color-line)",
                background: dragging === t.type ? "color-mix(in srgb, #a855f7 18%, transparent)" : "var(--color-panel-2)",
                color: "var(--color-ink)",
              }}
            >
              <span aria-hidden>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
        {dragging !== null && !won && (
          <p className="text-[11px]" style={{ color: ACCENT }}>
            Now tap the question card that this chart answers.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {QUESTIONS.map((q) => {
            const picked = assign[q.id];
            const ok = picked === q.correct;
            return (
              <div
                key={q.id}
                role="button"
                tabIndex={0}
                aria-label={`Question: ${q.ask}. ${picked ? `Current chart: ${picked}.` : "No chart yet."} Tap to drop the selected chart.`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOnCard(q.id)}
                onPointerUp={() => dropOnCard(q.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    dropOnCard(q.id);
                  }
                }}
                className="rounded-lg border p-2"
                style={{
                  touchAction: "manipulation",
                  borderColor: picked ? (ok ? GREEN : RED) : dragging ? ACCENT : "var(--color-line)",
                  background: "var(--color-panel-2)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-dim">{q.ask}</span>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={
                      picked
                        ? { background: ok ? GREEN : RED, color: "#05070d" }
                        : { color: "var(--color-ink-faint)", border: "1px solid var(--color-line)" }
                    }
                  >
                    {picked ? picked : "drop here"}
                  </span>
                </div>
                {picked && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <MiniChart type={picked} data={cleaned} />
                    <span className="text-[10px]" style={{ color: ok ? GREEN : RED }}>
                      {ok ? "this answers it ✓" : q.hides}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================== STAGE 3 — INSIGHT ===================== */}
      <section
        className="panel flex flex-col gap-2 rounded-xl p-3"
        style={stage3Open ? undefined : { opacity: 0.45, pointerEvents: "none" }}
        aria-hidden={!stage3Open}
      >
        <Header n={3} title="Read the insight" done={insightOk} />
        <p className="text-[11px] text-ink-faint">
          Your scatter plots temperature (→) against humidity (↑). Complete the sentence from what the dots show.
        </p>

        <div className="flex items-center gap-2">
          <MiniChart type="scatter" data={cleaned} large />
          <div className="text-[11px] text-ink-faint">
            each dot is a city
            <br />x = temp, y = humidity
          </div>
        </div>

        <p className="text-xs text-ink-dim">As temperature rises, humidity tends to…</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Insight choices">
          {INSIGHT_OPTIONS.map((o) => {
            const chosen = insight === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onPointerDown={() => setInsight(o.id)}
                aria-pressed={chosen}
                aria-label={`humidity ${o.text}`}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                style={{
                  touchAction: "manipulation",
                  borderColor: chosen ? ACCENT : "var(--color-line)",
                  background: chosen ? "color-mix(in srgb, #a855f7 18%, transparent)" : "var(--color-panel-2)",
                  color: "var(--color-ink)",
                }}
              >
                {o.text}
              </button>
            );
          })}
        </div>
      </section>

      {/* ===================== STATUS + WIN ===================== */}
      {won && (
        <div
          className="rounded-lg border p-3 text-center text-xs"
          style={{ borderColor: GREEN, color: "var(--color-ink)", animation: "g7datadashboard-pop 0.4s ease-out" }}
          role="status"
          aria-live="polite"
        >
          <div className="mb-1 text-base" aria-hidden>✨🎉 ⭐⭐⭐</div>
          Clean → visualise → interpret. You ran a real data pipeline and found that{" "}
          <b style={{ color: GREEN }}>warmer cities are more humid</b>.
        </div>
      )}

      {/* ===================== CONTROLS ===================== */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint" aria-hidden>
          {cleanOk ? "✓" : "○"} clean · {chartsOk ? "✓" : "○"} charts · {insightOk ? "✓" : "○"} insight
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
            aria-label="Reset the dashboard"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={tryWin}
            disabled={won}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: ACCENT, color: "#05070d" }}
            aria-label="Submit the finished data pipeline"
          >
            {won ? "Solved!" : "Run pipeline ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- sub-components ---------------------------- */

function Header({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold"
        style={{ background: done ? GREEN : ACCENT, color: "#05070d" }}
        aria-hidden
      >
        {done ? "✓" : n}
      </span>
      <h3 className="font-display text-sm tracking-tech text-ink">{title}</h3>
    </div>
  );
}

function Cell({ value, fill }: { value: number | null; fill: number | null }) {
  if (value !== null) return <span>{value}</span>;
  if (fill !== null) {
    return (
      <span style={{ color: GREEN }} aria-label={`filled with average ${fill}`}>
        {fill}
      </span>
    );
  }
  return (
    <span
      className="inline-block rounded px-1.5 text-[10px]"
      style={{ background: "color-mix(in srgb, #f87171 22%, transparent)", color: RED, animation: "g7datadashboard-glow 1.4s ease-in-out infinite" }}
      aria-label="missing value"
    >
      null
    </span>
  );
}

function FixPicker({
  label,
  value,
  onChange,
  avg,
  unit,
}: {
  label: string;
  value: FixChoice;
  onChange: (v: FixChoice) => void;
  avg: number;
  unit: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-ink-dim">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FixChoice)}
        aria-label={`${label}: choose how to handle the missing value`}
        className="rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-xs text-ink"
        style={{ accentColor: ACCENT }}
      >
        <option value="none">choose a fix…</option>
        <option value="fill">fill with average ({avg}{unit})</option>
        <option value="drop">drop this row</option>
      </select>
    </label>
  );
}

/** Deterministic mini-charts drawn straight from the cleaned dataset. */
function MiniChart({
  type,
  data,
  large = false,
}: {
  type: ChartType;
  data: { city: string; temp: number; humidity: number; rainfall: number }[];
  large?: boolean;
}) {
  const W = large ? 150 : 86;
  const H = large ? 90 : 52;
  const pad = 8;
  const iw = W - pad * 2;
  const ih = H - pad * 2;

  const content: ReactNode = useMemo(() => {
    if (data.length === 0) return null;
    const temps = data.map((d) => d.temp);
    const hums = data.map((d) => d.humidity);
    const tMin = Math.min(...temps);
    const tMax = Math.max(...temps);
    const hMin = Math.min(...hums);
    const hMax = Math.max(...hums);
    const sx = (t: number): number => pad + (tMax === tMin ? 0.5 : (t - tMin) / (tMax - tMin)) * iw;
    const syH = (h: number): number => pad + ih - (hMax === hMin ? 0.5 : (h - hMin) / (hMax - hMin)) * ih;

    if (type === "scatter") {
      return (
        <g>
          {data.map((d, i) => (
            <circle key={i} cx={sx(d.temp)} cy={syH(d.humidity)} r={large ? 3 : 2.2} fill={ACCENT} opacity={0.9} />
          ))}
        </g>
      );
    }

    if (type === "line") {
      // a "trend over months" line: order by temperature for a clean rising path
      const ordered = [...data].sort((a, b) => a.temp - b.temp);
      const pts = ordered
        .map((d, i) => {
          const x = pad + (ordered.length === 1 ? 0 : (i / (ordered.length - 1)) * iw);
          const y = pad + ih - (tMax === tMin ? 0.5 : (d.temp - tMin) / (tMax - tMin)) * ih;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
      return <polyline points={pts} fill="none" stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />;
    }

    if (type === "bar") {
      const bw = iw / data.length;
      return (
        <g>
          {data.map((d, i) => {
            const h = (tMax === tMin ? 0.6 : (d.temp - tMin) / (tMax - tMin)) * ih;
            return (
              <rect
                key={i}
                x={pad + i * bw + bw * 0.18}
                y={pad + ih - h}
                width={bw * 0.64}
                height={Math.max(1, h)}
                fill={ACCENT}
                rx={1}
              />
            );
          })}
        </g>
      );
    }

    // heatmap: 3×N grid of temp/humidity/rainfall intensity
    const cols = data.length;
    const keys: ("temp" | "humidity" | "rainfall")[] = ["temp", "humidity", "rainfall"];
    const cw = iw / cols;
    const ch = ih / 3;
    const maxBy: Record<string, number> = {
      temp: tMax,
      humidity: hMax,
      rainfall: Math.max(...data.map((d) => d.rainfall)),
    };
    const minBy: Record<string, number> = {
      temp: tMin,
      humidity: hMin,
      rainfall: Math.min(...data.map((d) => d.rainfall)),
    };
    return (
      <g>
        {keys.map((k, r) =>
          data.map((d, c) => {
            const span = maxBy[k] - minBy[k] || 1;
            const t = (d[k] - minBy[k]) / span;
            return (
              <rect
                key={`${k}${c}`}
                x={pad + c * cw}
                y={pad + r * ch}
                width={cw - 0.6}
                height={ch - 0.6}
                fill={ACCENT}
                opacity={0.18 + t * 0.75}
              />
            );
          }),
        )}
      </g>
    );
  }, [type, data, iw, ih, large]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${type} chart of the cleaned data`} className="shrink-0 rounded-md" style={{ background: "var(--color-panel)" }}>
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#1e2a44" strokeWidth={1} />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#1e2a44" strokeWidth={1} />
      {content}
    </svg>
  );
}
