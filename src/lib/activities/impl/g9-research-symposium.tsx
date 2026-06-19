"use client";
// LEARNING GOAL: The scientific method turns repeated controlled trials into
// evidence — run trials, compute mean + spread, and judge whether the averaged
// data (which beats the noise) supports the hypothesis.
import type { ActivityProps } from "@/lib/activities/types";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#22d3ee";
const GREEN = "#34d399";
const AMBER = "#fbbf24";
const LINE = "var(--color-line)";

/** Repeated trials required per condition before stats unlock. */
const MIN_TRIALS = 3;

/** The six IMRaD report sections, in their one correct order. */
const SECTIONS = [
  "Abstract",
  "Introduction",
  "Methodology",
  "Results",
  "Discussion",
  "Conclusion",
] as const;
type Section = (typeof SECTIONS)[number];

interface Study {
  id: string;
  emoji: string;
  question: string;
  /** Independent variable — what the experimenter sets each trial. */
  controlled: string;
  /** Dependent variable — what the experimenter records. */
  measured: string;
  unit: string;
  /** Three conditions, each with a hidden TRUE mean. Winner = highest mean. */
  conditions: { label: string; trueMean: number }[];
}

const STUDIES: readonly Study[] = [
  {
    id: "fan",
    emoji: "🌀",
    question: "Which fan-blade angle moves the most air?",
    controlled: "Blade angle",
    measured: "Airflow",
    unit: "m/s",
    conditions: [
      { label: "20°", trueMean: 3.1 },
      { label: "35°", trueMean: 5.4 },
      { label: "50°", trueMean: 4.2 },
    ],
  },
  {
    id: "ramp",
    emoji: "🛝",
    question: "Which ramp surface lets a car roll farthest?",
    controlled: "Surface",
    measured: "Roll distance",
    unit: "cm",
    conditions: [
      { label: "Carpet", trueMean: 42 },
      { label: "Wood", trueMean: 71 },
      { label: "Glass", trueMean: 88 },
    ],
  },
  {
    id: "plant",
    emoji: "🌱",
    question: "Which light colour grows the tallest sprout?",
    controlled: "Light colour",
    measured: "Height",
    unit: "mm",
    conditions: [
      { label: "Green", trueMean: 18 },
      { label: "Blue", trueMean: 27 },
      { label: "Red", trueMean: 41 },
    ],
  },
] as const;

/**
 * Deterministic, reproducible "measurement noise": a hash of
 * (studyId, condition, trial) → value in [-1,1). Small enough (≤10% of the mean)
 * that averaging MIN_TRIALS reliably reveals the true best condition.
 */
function seededNoise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 100000) / 100000) * 2 - 1;
}

function measure(study: Study, condIdx: number, trialIdx: number): number {
  const base = study.conditions[condIdx].trueMean;
  const v = base * (1 + seededNoise(`${study.id}:${condIdx}:${trialIdx}`) * 0.1);
  return Math.round(v * 10) / 10;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Population standard deviation — the spread of the trials. */
function stdev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

/** Seeded shuffle so the start is mixed but reproducible (never pre-solved). */
function shuffle(src: readonly Section[], seed: number): Section[] {
  const a = [...src];
  let s = seed * 2654435761;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.every((x, i) => x === src[i])) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

type Phase = "method" | "data" | "conclude";

/** A small selectable pill used across all three steps. */
function Chip({
  active,
  tone = ACCENT,
  onTap,
  label,
  children,
  className = "",
  style,
}: {
  active: boolean;
  tone?: string;
  onTap: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onPointerDown={onTap}
      aria-label={label}
      aria-pressed={active}
      className={`rounded-lg px-2 py-1.5 text-xs font-medium ${className}`}
      style={{
        touchAction: "manipulation",
        border: `1px solid ${active ? tone : LINE}`,
        background: active ? "rgba(34,211,238,0.14)" : "rgba(11,16,32,0.6)",
        color: active ? tone : "var(--color-ink-dim)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

const STEP_LABEL = "text-[10px] uppercase tracking-tech text-ink-faint";

export default function ResearchSymposium({ onComplete }: ActivityProps) {
  const [studyIdx, setStudyIdx] = useState<number>(0);
  const study = STUDIES[studyIdx];

  const [order, setOrder] = useState<Section[]>(() => shuffle(SECTIONS, 7));
  const [picked, setPicked] = useState<Section | null>(null);
  const [controlTag, setControlTag] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("method");
  const [methodMsg, setMethodMsg] = useState<string>(
    "Order the report sections, then tag the variable you control.",
  );

  const [trials, setTrials] = useState<number[][]>([[], [], []]);

  const [winPick, setWinPick] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<"supported" | "rejected" | null>(null);
  const [won, setWon] = useState<boolean>(false);
  const [concludeMsg, setConcludeMsg] = useState<string>("");
  const doneRef = useRef<boolean>(false);

  const orderCorrect = useMemo<boolean>(
    () => order.every((s, i) => s === SECTIONS[i]),
    [order],
  );

  const stats = useMemo(
    () =>
      study.conditions.map((c, i) => ({
        label: c.label,
        n: trials[i].length,
        mean: mean(trials[i]),
        sd: stdev(trials[i]),
      })),
    [study, trials],
  );

  const enoughTrials = useMemo<boolean>(
    () => trials.every((t) => t.length >= MIN_TRIALS),
    [trials],
  );

  /** True winner (highest true mean) — averaging the trials reveals it. */
  const trueWinner = useMemo<number>(() => {
    let best = 0;
    study.conditions.forEach((c, i) => {
      if (c.trueMean > study.conditions[best].trueMean) best = i;
    });
    return best;
  }, [study]);

  const controlCorrect = controlTag === study.controlled;

  const resetState = useCallback((seedBump: number): void => {
    setOrder(shuffle(SECTIONS, 7 + seedBump));
    setPicked(null);
    setControlTag(null);
    setPhase("method");
    setMethodMsg("Order the report sections, then tag the variable you control.");
    setTrials([[], [], []]);
    setWinPick(null);
    setVerdict(null);
    setConcludeMsg("");
  }, []);

  // ----- STEP 1: method -----
  const tapSection = useCallback(
    (s: Section): void => {
      setMethodMsg("Order the report sections, then tag the variable you control.");
      if (picked === null) return setPicked(s);
      if (picked === s) return setPicked(null);
      setOrder((prev) => {
        const next = [...prev];
        const a = next.indexOf(picked);
        const b = next.indexOf(s);
        [next[a], next[b]] = [next[b], next[a]];
        return next;
      });
      setPicked(null);
    },
    [picked],
  );

  const checkMethod = useCallback((): void => {
    if (!orderCorrect) {
      setMethodMsg("Not quite — an IMRaD report opens with the Abstract and ends with the Conclusion.");
      return onComplete({ passed: false, detail: "Reorder the report sections." });
    }
    if (controlTag === null) {
      setMethodMsg("Tag which variable YOU set each trial — that's the controlled (independent) one.");
      return onComplete({ passed: false, detail: "Tag the controlled variable." });
    }
    if (!controlCorrect) {
      setMethodMsg(`That one is what you measure. You CHOOSE the ${study.controlled.toLowerCase()} each trial.`);
      return onComplete({ passed: false, detail: "Re-tag the controlled variable." });
    }
    setMethodMsg("Method approved. Now run repeated trials.");
    setPhase("data");
  }, [orderCorrect, controlTag, controlCorrect, study, onComplete]);

  // ----- STEP 2: data -----
  const runTrial = useCallback(
    (condIdx: number): void => {
      setTrials((prev) => {
        const next = prev.map((t) => [...t]);
        next[condIdx] = [...next[condIdx], measure(study, condIdx, next[condIdx].length)];
        return next;
      });
    },
    [study],
  );

  // ----- STEP 3: conclude -----
  const finish = useCallback((): void => {
    if (doneRef.current) return;
    if (winPick === null || verdict === null) {
      setConcludeMsg("Pick the winning condition and a verdict for the hypothesis.");
      return onComplete({ passed: false, detail: "Choose a winner and a verdict." });
    }
    if (winPick !== trueWinner) {
      setConcludeMsg("Look again — the tallest bar (highest mean) is the winner once trials are averaged.");
      return onComplete({ passed: false, detail: "The highest mean is the winning condition." });
    }
    if (verdict !== "supported") {
      setConcludeMsg("The winning bar is clearly highest beyond its error bars — so the data SUPPORTS it.");
      return onComplete({ passed: false, detail: "The means support the hypothesis." });
    }
    doneRef.current = true;
    setWon(true);
    setConcludeMsg("Accepted to the Symposium! 🎉");
    onComplete({
      passed: true,
      stars: 3,
      detail: `Concluded ${study.conditions[trueWinner].label} wins for "${study.question}"`,
    });
  }, [winPick, verdict, trueWinner, study, onComplete]);

  const abstract = useMemo<string>(() => {
    const w = study.conditions[trueWinner];
    const ws = stats[trueWinner];
    return (
      `Abstract — We investigated "${study.question}" We changed the ${study.controlled.toLowerCase()} ` +
      `across three conditions (${study.conditions.map((c) => c.label).join(", ")}) and measured the ` +
      `${study.measured.toLowerCase()} in ${study.unit}. To control for measurement error we repeated ` +
      `each condition ${MIN_TRIALS} times and averaged the results, then computed the standard deviation ` +
      `as a measure of spread. The data show the ${w.label} condition produced the largest mean ` +
      `${study.measured.toLowerCase()} (${ws.mean.toFixed(1)} ${study.unit}, sd ${ws.sd.toFixed(1)}), and ` +
      `this gap exceeds the trial-to-trial spread, so a single noisy reading could not explain it. We ` +
      `therefore conclude that ${w.label} best answers the question, and that repeating trials and ` +
      `averaging is what let the true signal rise above the noise. Sources of error include timing and ` +
      `reading the instrument; more trials would tighten the estimate further.`
    );
  }, [study, trueWinner, stats]);

  const maxMean = Math.max(...stats.map((s) => s.mean), 1);
  const stepNo = phase === "method" ? 1 : phase === "data" ? 2 : 3;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g9researchsymposium-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g9researchsymposium-grow {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
      `}</style>

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm">
          <span aria-hidden className="text-lg">🔬</span>
          <span className="font-display">Research Data Lab</span>
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-tech"
          style={
            won
              ? { background: GREEN, color: "#05070d" }
              : { color: "var(--color-ink-faint)", border: `1px solid ${LINE}` }
          }
          aria-hidden
        >
          {won ? "● accepted" : `○ step ${stepNo}/3`}
        </span>
      </div>

      {/* STUDY PICKER */}
      <div className="flex gap-1.5" role="group" aria-label="Choose a research question">
        {STUDIES.map((s, i) => (
          <Chip
            key={s.id}
            active={i === studyIdx}
            onTap={() => {
              if (won) return;
              setStudyIdx(i);
              resetState(i);
            }}
            label={`Question: ${s.question}`}
            className="flex-1"
            style={{ opacity: won && i !== studyIdx ? 0.4 : 1 }}
          >
            <span aria-hidden className="text-base">{s.emoji}</span>
          </Chip>
        ))}
      </div>
      <p className="text-center text-xs text-ink-dim" aria-live="polite">
        <span aria-hidden>{study.emoji}</span> {study.question}
      </p>

      {/* ---------------- STEP 1: METHOD ---------------- */}
      {phase === "method" && (
        <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
          <div className={STEP_LABEL}>Step 1 · Plan the IMRaD report</div>
          <div className="flex flex-col gap-1.5">
            {order.map((s, i) => {
              const right = s === SECTIONS[i];
              const isPicked = picked === s;
              return (
                <button
                  key={s}
                  type="button"
                  onPointerDown={() => tapSection(s)}
                  aria-label={`Section ${s}, position ${i + 1}${isPicked ? ", selected" : ""}`}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs"
                  style={{
                    touchAction: "manipulation",
                    border: `1px solid ${isPicked ? ACCENT : right ? GREEN : LINE}`,
                    background: isPicked ? "rgba(34,211,238,0.14)" : "rgba(11,16,32,0.6)",
                  }}
                >
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold"
                    style={{ background: right ? GREEN : LINE, color: "#05070d" }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: right ? GREEN : "var(--color-ink-dim)" }}>{s}</span>
                  {right && <span className="ml-auto text-[10px]" style={{ color: GREEN }}>✓</span>}
                </button>
              );
            })}
          </div>

          <div className={STEP_LABEL}>Tag the CONTROLLED variable (the one you set)</div>
          <div className="flex gap-1.5" role="group" aria-label="Tag the controlled variable">
            {[study.controlled, study.measured].map((v) => (
              <Chip
                key={v}
                active={controlTag === v}
                onTap={() => setControlTag(v)}
                label={`Tag ${v} as controlled`}
                className="flex-1"
              >
                {v}
              </Chip>
            ))}
          </div>

          <p className="min-h-[16px] text-[11px] leading-tight" style={{ color: AMBER }} role="status">
            {methodMsg}
          </p>
          <button
            type="button"
            onPointerDown={checkMethod}
            aria-label="Check the method and continue to running trials"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: ACCENT, color: "#05070d", touchAction: "manipulation" }}
          >
            Approve method →
          </button>
        </div>
      )}

      {/* ---------------- STEP 2: DATA ---------------- */}
      {phase === "data" && (
        <div className="panel flex flex-col gap-2.5 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className={STEP_LABEL}>Step 2 · Run ≥{MIN_TRIALS} trials each</span>
            <span className="text-[10px] text-ink-faint">unit: {study.unit}</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-line">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-2 bg-panel-2/40 px-2 py-1 text-[10px] text-ink-faint">
              <span>set</span>
              <span>trials</span>
              <span className="text-right">mean</span>
              <span className="text-right">sd</span>
            </div>
            {study.conditions.map((c, i) => {
              const t = trials[i];
              const st = stats[i];
              const enough = t.length >= MIN_TRIALS;
              return (
                <div
                  key={c.label}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 border-t border-line px-2 py-1.5 text-[11px]"
                >
                  <span className="w-12 font-semibold" style={{ color: ACCENT }}>{c.label}</span>
                  <span className="flex flex-wrap gap-1 tabular-nums text-ink-dim">
                    {t.length === 0 ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      t.map((v, k) => (
                        <span key={k} className="rounded px-1" style={{ background: "rgba(34,211,238,0.10)" }}>
                          {v.toFixed(1)}
                        </span>
                      ))
                    )}
                  </span>
                  <span
                    className="text-right tabular-nums"
                    style={{ color: enough ? GREEN : "var(--color-ink-faint)" }}
                  >
                    {t.length ? st.mean.toFixed(1) : "—"}
                  </span>
                  <span className="text-right tabular-nums text-ink-faint">
                    {t.length ? st.sd.toFixed(1) : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {study.conditions.map((c, i) => {
              const t = trials[i];
              const enough = t.length >= MIN_TRIALS;
              return (
                <button
                  key={c.label}
                  type="button"
                  onPointerDown={() => runTrial(i)}
                  aria-label={`Run a trial for condition ${c.label}, ${t.length} done`}
                  className="flex flex-col items-center rounded-lg px-1 py-1.5 text-[11px] font-medium"
                  style={{
                    touchAction: "manipulation",
                    border: `1px solid ${enough ? GREEN : ACCENT}`,
                    background: "rgba(11,16,32,0.6)",
                    color: enough ? GREEN : ACCENT,
                  }}
                >
                  <span aria-hidden>▶ Run {c.label}</span>
                  <span className="text-[9px] text-ink-faint">
                    {t.length}/{MIN_TRIALS}{enough ? " ✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] leading-tight text-ink-faint">
            One reading is noisy. Repeat each set {MIN_TRIALS}+ times so the average reveals the real signal.
          </p>
          <button
            type="button"
            onPointerDown={() => enoughTrials && (setPhase("conclude"), setConcludeMsg("Read the chart. Which condition wins — and does the data support it?"))}
            disabled={!enoughTrials}
            aria-label="Continue to analyse the chart and conclude"
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: enoughTrials ? ACCENT : LINE, color: "#05070d", touchAction: "manipulation" }}
          >
            {enoughTrials ? "Analyse data →" : `Need ${MIN_TRIALS} trials each`}
          </button>
        </div>
      )}

      {/* ---------------- STEP 3: CONCLUDE ---------------- */}
      {phase === "conclude" && (
        <div
          className="panel flex flex-col gap-2.5 rounded-xl p-3"
          style={won ? { boxShadow: `0 0 0 1px ${GREEN}, 0 0 24px -4px ${GREEN}` } : undefined}
        >
          <div className={STEP_LABEL}>Step 3 · Read the chart, then conclude</div>

          <svg
            viewBox="0 0 120 80"
            className="block w-full"
            role="img"
            aria-label={`Bar chart of mean ${study.measured} per condition with standard-deviation error bars`}
          >
            {stats.map((s, i) => {
              const bw = 26;
              const x = 12 + i * (bw + 12);
              const h = (s.mean / maxMean) * 56;
              const y = 66 - h;
              const sdPx = (s.sd / maxMean) * 56;
              const chosen = winPick === i;
              const cx = x + bw / 2;
              return (
                <g key={s.label}>
                  <rect
                    x={x}
                    y={y}
                    width={bw}
                    height={h}
                    rx={2}
                    fill={chosen ? ACCENT : "rgba(34,211,238,0.35)"}
                    stroke={chosen ? ACCENT : "transparent"}
                    style={{ transformOrigin: "center 66px", animation: "g9researchsymposium-grow 360ms ease" }}
                  />
                  <line x1={cx} y1={y - sdPx} x2={cx} y2={y + sdPx} stroke="#e2e8f0" strokeWidth={0.8} />
                  <line x1={cx - 4} y1={y - sdPx} x2={cx + 4} y2={y - sdPx} stroke="#e2e8f0" strokeWidth={0.8} />
                  <line x1={cx - 4} y1={y + sdPx} x2={cx + 4} y2={y + sdPx} stroke="#e2e8f0" strokeWidth={0.8} />
                  <text x={cx} y={73} textAnchor="middle" fontSize={5} fill="#94a3b8">{s.label}</text>
                  <text x={cx} y={y - sdPx - 2} textAnchor="middle" fontSize={5} fill={chosen ? ACCENT : "#cbd5e1"}>
                    {s.mean.toFixed(1)}
                  </text>
                </g>
              );
            })}
            <line x1={8} y1={66} x2={112} y2={66} stroke={LINE} strokeWidth={0.6} />
          </svg>

          <div className={STEP_LABEL}>Winning condition</div>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Pick the winning condition">
            {study.conditions.map((c, i) => (
              <Chip
                key={c.label}
                active={winPick === i}
                onTap={() => !won && setWinPick(i)}
                label={`Winner is ${c.label}`}
              >
                {c.label}
              </Chip>
            ))}
          </div>

          <div className={STEP_LABEL}>Does the data support the hypothesis?</div>
          <div className="flex gap-1.5" role="group" aria-label="Hypothesis verdict">
            {([
              { k: "supported", label: "Supported ✓" },
              { k: "rejected", label: "Rejected ✗" },
            ] as const).map((o) => (
              <Chip
                key={o.k}
                active={verdict === o.k}
                onTap={() => !won && setVerdict(o.k)}
                label={o.label}
                className="flex-1"
              >
                {o.label}
              </Chip>
            ))}
          </div>

          {!won && (
            <>
              <p className="min-h-[16px] text-[11px] leading-tight" style={{ color: AMBER }} role="status">
                {concludeMsg}
              </p>
              <button
                type="button"
                onPointerDown={finish}
                aria-label="Submit conclusion to the symposium"
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ background: ACCENT, color: "#05070d", touchAction: "manipulation" }}
              >
                Submit to symposium
              </button>
            </>
          )}

          {won && (
            <div
              className="flex flex-col gap-2 rounded-lg p-3 text-center"
              style={{
                background: "rgba(52,211,153,0.10)",
                border: `1px solid ${GREEN}`,
                animation: "g9researchsymposium-pop 360ms ease",
              }}
              role="status"
              aria-label="Accepted to the Symposium"
            >
              <div className="text-2xl" aria-hidden>✨🎉</div>
              <div className="font-display text-sm" style={{ color: GREEN }}>Accepted to the Symposium</div>
              <div className="text-lg tracking-widest" aria-hidden>⭐⭐⭐</div>
              <p className="text-left text-[10px] leading-snug text-ink-dim">{abstract}</p>
            </div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <button
        type="button"
        onPointerDown={() => {
          setWon(false);
          doneRef.current = false;
          resetState(studyIdx);
        }}
        aria-label="Reset the whole experiment"
        className="self-center rounded-lg border border-line bg-panel/60 px-4 py-1.5 text-xs font-medium text-ink-dim"
        style={{ touchAction: "manipulation" }}
      >
        Reset
      </button>
    </div>
  );
}
