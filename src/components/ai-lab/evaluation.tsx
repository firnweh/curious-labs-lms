"use client";

import { useMemo, useState } from "react";

/**
 * AI Lab experiment — "How Good Is It?" (model evaluation).
 *
 * A confusion-matrix / precision-recall playground. The AI flags items by a
 * SCORE; the child moves a THRESHOLD slider to decide how strict it is. Every
 * item's flag (score ≥ threshold) is compared to its TRUE label to fill a live
 * 2×2 confusion matrix (TP / FP / FN / TN), with Accuracy, Precision and Recall
 * recomputed as the slider moves. A scenario toggle reuses the same mechanic:
 * 📧 Spam filter (a False Positive loses a real friend's mail — annoying) vs
 * 🚨 Danger alarm (a False Negative misses a real danger — harmful).
 *
 * Aha: one "accuracy" number hides WHICH mistakes happen. Raising the threshold
 * cuts false alarms (↑precision) but misses more real cases (↓recall) — and the
 * worse error depends on the situation.
 *
 * Shell-compatible: renders as a body block (no full-screen chrome / Back — the
 * AI Lab shell owns those). Deterministic, no deps, no random, no Date.
 */

const ACCENT = "#fb7185";

type CellKey = "TP" | "FP" | "FN" | "TN";

interface Item {
  id: number;
  label: string; // short text shown in the list
  isReal: boolean; // TRUE label: true = it really IS the target thing
  score: number; // AI confidence 0–100 that it IS the target thing
}

// Compact item form: [label, isReal, score]. ids are added when building.
type Row = [string, boolean, number];

interface Scenario {
  key: "spam" | "alarm";
  emoji: string;
  name: string;
  target: string; // what a "positive" means
  realWord: string; // label chip for a truly-positive item, e.g. "real spam"
  fakeWord: string; // label chip for a truly-negative item, e.g. "friend's email"
  fpCost: string; // what a False Positive means in plain words
  fnCost: string; // what a False Negative means in plain words
  worse: CellKey; // which mistake hurts more here
  items: Item[];
}

const build = (rows: Row[]): Item[] =>
  rows.map(([label, isReal, score], i) => ({ id: i + 1, label, isReal, score }));

// Two scenarios, same fixed 14-item mechanic (deterministic — no random/date).
const SCENARIOS: Scenario[] = [
  {
    key: "spam",
    emoji: "📧",
    name: "Spam filter",
    target: "spam",
    realWord: "real spam",
    fakeWord: "friend's email",
    fpCost: "a real friend's email gets thrown in the spam bin",
    fnCost: "junk spam sneaks into your inbox",
    worse: "FP",
    items: build([
      ["WIN A FREE iPHONE!!!", true, 97],
      ["Your account is locked, click here", true, 88],
      ["Cheap pi11s no prescription", true, 92],
      ["You won the lottery 🤑", true, 74],
      ["Re: invoice (weird link)", true, 61],
      ["Crypto double your money", true, 55],
      ["Newsletter: 50% off shoes", false, 70],
      ["Bank: monthly statement", false, 48],
      ["Mom: dinner at 7?", false, 12],
      ["Coach: practice moved", false, 8],
      ["Best friend: meme 😂", false, 20],
      ["School: field-trip form", false, 33],
      ["Sale ends tonight!", false, 58],
      ["Grandma: photos ❤️", false, 5],
    ]),
  },
  {
    key: "alarm",
    emoji: "🚨",
    name: "Danger alarm",
    target: "danger",
    realWord: "real danger",
    fakeWord: "harmless thing",
    fpCost: "the alarm blares for nothing (a false alarm)",
    fnCost: "a real danger is missed and no one is warned",
    worse: "FN",
    items: build([
      ["Smoke + heat rising fast", true, 95],
      ["Gas smell in the kitchen", true, 86],
      ["Flames seen on camera", true, 99],
      ["Faint smoke, slow rise", true, 58],
      ["Wires sparking a little", true, 64],
      ["Warm wall, no smoke yet", true, 41],
      ["Burnt toast smoke", false, 72],
      ["Steam from hot shower", false, 60],
      ["Candle for a birthday", false, 38],
      ["Dust on the sensor", false, 15],
      ["Sunlight on the lens", false, 10],
      ["Cooking on the stove", false, 50],
      ["Vacuum cleaner running", false, 22],
      ["Pet walking past camera", false, 6],
    ]),
  },
];

const CELL: Record<CellKey, { title: string; color: string; good: boolean }> = {
  TP: { title: "True Positive", color: "#34d399", good: true },
  FP: { title: "False Positive", color: "#eab308", good: false },
  FN: { title: "False Negative", color: "#fb7185", good: false },
  TN: { title: "True Negative", color: "#60a5fa", good: true },
};

function cellOf(item: Item, threshold: number): CellKey {
  const flagged = item.score >= threshold;
  if (item.isReal) return flagged ? "TP" : "FN";
  return flagged ? "FP" : "TN";
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export default function Evaluation() {
  const [scenarioKey, setScenarioKey] = useState<"spam" | "alarm">("spam");
  const [threshold, setThreshold] = useState(50);
  const [touched, setTouched] = useState(false);

  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) as Scenario;

  const { counts, accuracy, precision, recall } = useMemo(() => {
    const c: Record<CellKey, number> = { TP: 0, FP: 0, FN: 0, TN: 0 };
    for (const item of scenario.items) c[cellOf(item, threshold)]++;
    const total = scenario.items.length;
    return {
      counts: c,
      accuracy: pct(c.TP + c.TN, total),
      precision: pct(c.TP, c.TP + c.FP),
      recall: pct(c.TP, c.TP + c.FN),
    };
  }, [scenario, threshold]);

  const setStrict = (v: number) => {
    setThreshold(v);
    setTouched(true);
  };

  const reset = () => {
    setThreshold(50);
    setTouched(false);
  };

  // Teaching caption — narrates the trade-off and lands on a clear aha.
  const teach = (() => {
    if (!touched) {
      return `${scenario.emoji} The AI gives each item a score. Items scoring ≥ ${threshold} get FLAGGED as ${scenario.target}. Slide the strictness to see the mistakes change.`;
    }
    if (threshold >= 85) {
      return `🔒 Super strict (≥ ${threshold}): almost no false alarms (precision ${precision}%) — but ${counts.FN} ${scenario.realWord}${counts.FN === 1 ? "" : "s"} slipped through (recall ${recall}%). Aha — fewer false alarms means more misses.`;
    }
    if (threshold <= 25) {
      return `📣 Super loose (≥ ${threshold}): it catches almost everything (recall ${recall}%) — but flags ${counts.FP} ${scenario.fakeWord}${counts.FP === 1 ? "" : "s"} by mistake (precision ${precision}%). Aha — catching more means more false alarms.`;
    }
    const worse = CELL[scenario.worse];
    return `📊 Accuracy is ${accuracy}%, but that ONE number hides which mistakes happen: ${counts.FP} false alarm${counts.FP === 1 ? "" : "s"} and ${counts.FN} miss${counts.FN === 1 ? "" : "es"}. Here a ${worse.title} is the worse one — ${scenario.worse === "FP" ? scenario.fpCost : scenario.fnCost}.`;
  })();

  const matrixOrder: CellKey[] = ["TP", "FP", "FN", "TN"];

  return (
    <div className="flex w-full flex-col gap-3" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="text-xl">📊</span>
        <span className="font-mono text-sm font-semibold tracking-wide">How Good Is It?</span>
        <span
          className="rounded-md px-2 py-0.5 font-mono text-[10px]"
          style={{ color: ACCENT, background: `${ACCENT}1a`, border: `1px solid ${ACCENT}55` }}
        >
          Grades 7-10
        </span>
        <span className="font-mono text-[11px] text-[#5b6b8c]">· Model evaluation</span>

        {/* Scenario toggle */}
        <div className="ml-auto flex items-center gap-1.5">
          {SCENARIOS.map((s) => {
            const on = s.key === scenarioKey;
            return (
              <button
                key={s.key}
                onClick={() => {
                  setScenarioKey(s.key);
                  setTouched(true);
                }}
                className="flex items-center gap-1 rounded-xl border-2 px-2.5 py-1 font-mono text-[11px] transition-colors"
                style={{
                  borderColor: on ? ACCENT : "#1e2738",
                  background: on ? `${ACCENT}14` : "#0f1420",
                  color: on ? "#e8eefc" : "#9fb0d0",
                }}
              >
                <span aria-hidden>{s.emoji}</span>
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      <p
        aria-live="polite"
        className="rounded-xl border border-[#1e2738] bg-[#0f1420] p-2.5 font-mono text-[11px] leading-relaxed text-[#9fb0d0]"
      >
        {teach}
      </p>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* LEFT: threshold + confusion matrix + metrics */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[320px]">
          {/* Strictness slider */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-wide text-[#5b6b8c]">HOW STRICT IS THE AI?</p>
              <span className="font-mono text-[11px] font-bold" style={{ color: ACCENT }}>
                flag ≥ {threshold}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={threshold}
              onChange={(e) => setStrict(Number(e.target.value))}
              aria-label="Strictness threshold"
              className="w-full cursor-pointer"
              style={{ accentColor: ACCENT }}
            />
            <div className="mt-1 flex justify-between font-mono text-[9px] text-[#5b6b8c]">
              <span>← loose · catch more</span>
              <span>strict · fewer alarms →</span>
            </div>
            {/* Quick taps — slider + tap fallback */}
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { v: 20, t: "Loose" },
                { v: 50, t: "Medium" },
                { v: 85, t: "Strict" },
              ].map((q) => {
                const on = threshold === q.v;
                return (
                  <button
                    key={q.v}
                    onClick={() => setStrict(q.v)}
                    className="rounded-xl border-2 py-1.5 font-mono text-[10px] transition-colors"
                    style={{
                      borderColor: on ? ACCENT : "#1e2738",
                      background: on ? `${ACCENT}14` : "transparent",
                      color: on ? "#e8eefc" : "#9fb0d0",
                    }}
                  >
                    {q.t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confusion matrix 2×2 */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">CONFUSION MATRIX</p>
            <div className="grid grid-cols-[auto_1fr_1fr] gap-1">
              {/* column headers */}
              <span />
              <span className="text-center font-mono text-[9px] text-[#5b6b8c]">AI flagged ✔</span>
              <span className="text-center font-mono text-[9px] text-[#5b6b8c]">AI passed ✘</span>

              {/* row 1: truly IS the thing */}
              <span className="flex items-center font-mono text-[9px] text-[#5b6b8c]">really {scenario.target}</span>
              <MatrixCell k="TP" n={counts.TP} />
              <MatrixCell k="FN" n={counts.FN} />

              {/* row 2: truly NOT the thing */}
              <span className="flex items-center font-mono text-[9px] text-[#5b6b8c]">not {scenario.target}</span>
              <MatrixCell k="FP" n={counts.FP} />
              <MatrixCell k="TN" n={counts.TN} />
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Accuracy" value={accuracy} color="#9fb0d0" hint="all correct" />
            <Metric label="Precision" value={precision} color="#eab308" hint="flags that hit" />
            <Metric label="Recall" value={recall} color="#34d399" hint="reals caught" />
          </div>

          <button
            onClick={reset}
            className="rounded-xl border border-[#2a3550] py-2 font-mono text-[11px] text-[#9fb0d0] transition-colors hover:border-[#fb7185] hover:text-[#fb7185]"
          >
            🔄 Reset slider
          </button>
        </div>

        {/* RIGHT: item list tinted by cell */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] tracking-wide text-[#5b6b8c]">
              {scenario.items.length} ITEMS — tinted by which box they fall in
            </p>
            <div className="flex flex-wrap gap-2">
              {matrixOrder.map((k) => (
                <span key={k} className="flex items-center gap-1 font-mono text-[9px]" style={{ color: CELL[k].color }}>
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: CELL[k].color }} />
                  {k}
                </span>
              ))}
            </div>
          </div>

          <ul className="flex flex-col gap-1.5">
            {scenario.items.map((item) => {
              const k = cellOf(item, threshold);
              const c = CELL[k];
              const flagged = item.score >= threshold;
              const mistake = !c.good;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-2.5 rounded-xl border-2 p-2.5"
                  style={{
                    borderColor: `${c.color}${mistake ? "aa" : "55"}`,
                    background: `${c.color}${mistake ? "18" : "0d"}`,
                  }}
                >
                  {/* truth chip */}
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[8px]"
                    style={{
                      color: item.isReal ? "#e8eefc" : "#9fb0d0",
                      background: item.isReal ? "#0b1018" : "transparent",
                      border: `1px solid ${item.isReal ? "#2a3550" : "#1e2738"}`,
                    }}
                  >
                    {item.isReal ? scenario.realWord : scenario.fakeWord}
                  </span>

                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#e8eefc]">{item.label}</span>

                  {/* AI score bar */}
                  <span className="hidden shrink-0 items-center gap-1.5 sm:flex" title={`AI score ${item.score}`}>
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#0b1018]">
                      <span
                        className="block h-full transition-all"
                        style={{ width: `${item.score}%`, background: flagged ? ACCENT : "#2a3550" }}
                      />
                    </span>
                    <span className="w-6 text-right font-mono text-[9px] text-[#5b6b8c]">{item.score}</span>
                  </span>

                  {/* cell badge */}
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold"
                    style={{ color: "#0b1018", background: c.color }}
                  >
                    {k}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 rounded-xl border border-[#1e2738] bg-[#0f1420] p-2.5 font-mono text-[10px] leading-relaxed text-[#5b6b8c]">
            Same AI, same items — only the <span style={{ color: ACCENT }}>threshold</span> changed. A{" "}
            <span className="text-[#eab308]">False Positive</span> here means {scenario.fpCost}; a{" "}
            <span className="text-[#fb7185]">False Negative</span> means {scenario.fnCost}. For{" "}
            <span aria-hidden>{scenario.emoji}</span> {scenario.name.toLowerCase()}, the{" "}
            <span style={{ color: CELL[scenario.worse].color }}>{CELL[scenario.worse].title}</span> is the costlier
            mistake — so you&apos;d tune the slider to avoid it.
          </p>
        </div>
      </div>
    </div>
  );
}

function MatrixCell({ k, n }: { k: CellKey; n: number }) {
  const c = CELL[k];
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border-2 py-2.5 transition-colors"
      style={{ borderColor: `${c.color}66`, background: `${c.color}14` }}
    >
      <span className="font-mono text-2xl font-bold" style={{ color: c.color }}>
        {n}
      </span>
      <span className="font-mono text-[8px]" style={{ color: c.color }}>
        {k}
      </span>
      <span className="font-mono text-[7px] text-[#5b6b8c]">{c.title}</span>
    </div>
  );
}

function Metric({ label, value, color, hint }: { label: string; value: number; color: string; hint: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[#1e2738] bg-[#0f1420] py-2.5">
      <span className="font-mono text-xl font-bold" style={{ color }}>
        {value}%
      </span>
      <span className="font-mono text-[10px]" style={{ color }}>
        {label}
      </span>
      <span className="font-mono text-[8px] text-[#5b6b8c]">{hint}</span>
    </div>
  );
}
