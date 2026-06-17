"use client";
import { useCallback, useMemo, useState } from "react";
import type { ActivityProps } from "@/lib/activities/types";

const ACCENT = "#a855f7";
const TARGET = 90;

type Kind = "apple" | "banana";

interface Fruit {
  id: string;
  /** Ground-truth kind (used for grading the predictions on the test set). */
  truth: Kind;
  /** Feature 1: redness (0 = green/yellow, 100 = deep red). */
  red: number;
  /** Feature 2: roundness (0 = long, 100 = perfectly round). */
  round: number;
}

const EMOJI: Record<Kind, string> = { apple: "🍎", banana: "🍌" };

/**
 * Deterministic data pools — verified so that labelling ALL 10 examples
 * correctly yields 100% test accuracy (a clean solve), while labelling only
 * one or two gives ~50% (the teaching moment: a model needs enough examples
 * of BOTH kinds before it can sort reliably).
 */
const TRAIN: Fruit[] = [
  { id: "a1", truth: "apple", red: 90, round: 88 },
  { id: "a2", truth: "apple", red: 82, round: 80 },
  { id: "a3", truth: "apple", red: 74, round: 68 },
  { id: "a4", truth: "apple", red: 68, round: 58 },
  { id: "a5", truth: "apple", red: 60, round: 72 },
  { id: "b1", truth: "banana", red: 12, round: 14 },
  { id: "b2", truth: "banana", red: 24, round: 20 },
  { id: "b3", truth: "banana", red: 34, round: 38 },
  { id: "b4", truth: "banana", red: 44, round: 30 },
  { id: "b5", truth: "banana", red: 40, round: 46 },
];

const TEST: Fruit[] = [
  { id: "t1", truth: "apple", red: 86, round: 84 },
  { id: "t2", truth: "apple", red: 78, round: 70 },
  { id: "t3", truth: "apple", red: 64, round: 62 },
  { id: "t4", truth: "banana", red: 16, round: 18 },
  { id: "t5", truth: "banana", red: 38, round: 34 },
  { id: "t6", truth: "banana", red: 46, round: 42 },
];

type Labels = Record<string, Kind | undefined>;

interface Scored {
  fruit: Fruit;
  pred: Kind;
  correct: boolean;
}

/** k-NN (k up to 3) classifier over the learner's labelled examples. */
function classify(test: Fruit, labelled: { f: Fruit; label: Kind }[]): Kind {
  const k = Math.min(3, labelled.length);
  const ranked = labelled
    .map(({ f, label }) => ({
      label,
      dist: (test.red - f.red) ** 2 + (test.round - f.round) ** 2,
    }))
    .sort((m, n) => m.dist - n.dist)
    .slice(0, k);
  let apples = 0;
  let bananas = 0;
  for (const r of ranked) r.label === "apple" ? (apples += 1) : (bananas += 1);
  return apples >= bananas ? "apple" : "banana";
}

export default function TraintheSorter({ onComplete }: ActivityProps) {
  const [labels, setLabels] = useState<Labels>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [scored, setScored] = useState<Scored[] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [tries, setTries] = useState(0);

  const labelledList = useMemo(
    () =>
      TRAIN.flatMap((f) => {
        const label = labels[f.id];
        return label ? [{ f, label }] : [];
      }),
    [labels],
  );

  const labelledCount = labelledList.length;
  const canTrain = labelledList.some((l) => l.label === "apple") &&
    labelledList.some((l) => l.label === "banana");

  const assign = useCallback(
    (id: string, kind: Kind) => {
      if (solved) return;
      setLabels((prev) => ({ ...prev, [id]: kind }));
      setSelected(null);
      setScored(null);
      setAccuracy(null);
    },
    [solved],
  );

  const pickBucket = useCallback(
    (kind: Kind) => {
      if (selected) assign(selected, kind);
    },
    [selected, assign],
  );

  const reset = useCallback(() => {
    setLabels({});
    setSelected(null);
    setScored(null);
    setAccuracy(null);
    setSolved(false);
    setTries(0);
  }, []);

  const train = useCallback(() => {
    if (!canTrain) return;
    const results: Scored[] = TEST.map((f) => {
      const pred = classify(f, labelledList);
      return { fruit: f, pred, correct: pred === f.truth };
    });
    const right = results.filter((r) => r.correct).length;
    const acc = Math.round((100 * right) / TEST.length);
    setScored(results);
    setAccuracy(acc);
    const attempt = tries + 1;
    setTries(attempt);
    if (acc >= TARGET) {
      setSolved(true);
      onComplete({ passed: true, stars: attempt <= 3 ? 3 : 2 });
    } else {
      onComplete({
        passed: false,
        detail: `Only ${acc}% — label more fruit of both kinds, then re-train.`,
      });
    }
  }, [canTrain, labelledList, tries, onComplete]);

  const status = solved
    ? `Solved! Your model sorts at ${accuracy}% accuracy. 🎉`
    : accuracy !== null
      ? `${accuracy}% correct — aim for ${TARGET}%+. More examples help!`
      : labelledCount === 0
        ? "Tap a fruit, then tap a bucket to teach the model."
        : `${labelledCount} / ${TRAIN.length} examples labelled. Press Train when ready.`;

  return (
    <div
      className="flex w-full flex-col gap-3 rounded-xl p-3"
      style={{ minHeight: 460 }}
    >
      {/* Hint header */}
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] tracking-tech text-ink-dim">
          🍎 red &amp; round · 🍌 yellow &amp; long
        </p>
        <span
          className="rounded-md px-2 py-0.5 font-mono text-[11px]"
          style={{ background: "rgba(168,85,247,0.14)", color: ACCENT }}
        >
          k-NN sorter
        </span>
      </div>

      {/* Unlabelled / training tray */}
      <div className="panel rounded-lg p-2">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-tech text-ink-faint">
          Training examples — label each one
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {TRAIN.map((f) => {
            const label = labels[f.id];
            const isSel = selected === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-label={`Example fruit ${f.id}${label ? `, labelled ${label}` : ", unlabelled"}`}
                aria-pressed={isSel}
                onClick={() => !solved && setSelected(isSel ? null : f.id)}
                className="relative flex aspect-square items-center justify-center rounded-md border bg-panel-2/70 text-2xl transition-transform active:scale-95"
                style={{
                  borderColor: isSel ? ACCENT : "var(--color-line, #2a2f3a)",
                  boxShadow: isSel ? `0 0 0 2px ${ACCENT}` : undefined,
                  opacity: solved && !label ? 0.5 : 1,
                }}
              >
                <span aria-hidden>{label ? EMOJI[label] : "❔"}</span>
                {label && (
                  <span
                    aria-hidden
                    className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full"
                    style={{
                      background: label === "apple" ? ACCENT : "var(--color-neon-amber, #f5b942)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Buckets */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["apple", "banana"] as Kind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={!selected || solved}
              onClick={() => pickBucket(kind)}
              aria-label={`Put selected fruit in the ${kind} bucket`}
              className="flex items-center justify-center gap-1.5 rounded-lg border py-2 font-mono text-xs transition-colors disabled:opacity-40"
              style={{
                borderColor: selected ? ACCENT : "var(--color-line, #2a2f3a)",
                background: selected ? "rgba(168,85,247,0.12)" : "transparent",
                color: "var(--color-ink, #e6e9ef)",
              }}
            >
              <span aria-hidden className="text-lg">{EMOJI[kind]}</span>
              {kind === "apple" ? "Apple" : "Banana"}
            </button>
          ))}
        </div>
      </div>

      {/* Scatter view of feature space */}
      <div className="panel rounded-lg p-2">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-tech text-ink-faint">
          Feature map {scored ? "— test predictions" : "— your labels"}
        </p>
        <svg
          viewBox="0 0 100 100"
          className="w-full rounded-md"
          style={{ background: "rgba(255,255,255,0.02)", aspectRatio: "16 / 9" }}
          role="img"
          aria-label="Scatter plot of fruit by redness and roundness"
        >
          {/* axes */}
          <line x1="6" y1="94" x2="98" y2="94" stroke="#3a3f4b" strokeWidth="0.5" />
          <line x1="6" y1="2" x2="6" y2="94" stroke="#3a3f4b" strokeWidth="0.5" />
          <text x="52" y="99" fontSize="3.2" fill="#6b7280" textAnchor="middle">
            redness →
          </text>

          {/* labelled training points */}
          {TRAIN.map((f) => {
            const label = labels[f.id];
            if (!label) return null;
            const cx = 6 + (f.red / 100) * 90;
            const cy = 94 - (f.round / 100) * 88;
            return (
              <circle
                key={f.id}
                cx={cx}
                cy={cy}
                r="2.6"
                fill={label === "apple" ? ACCENT : "#f5b942"}
                opacity="0.9"
              />
            );
          })}

          {/* test predictions (after training) */}
          {scored?.map(({ fruit, pred, correct }) => {
            const cx = 6 + (fruit.red / 100) * 90;
            const cy = 94 - (fruit.round / 100) * 88;
            return (
              <g key={fruit.id}>
                <rect
                  x={cx - 2.4}
                  y={cy - 2.4}
                  width="4.8"
                  height="4.8"
                  rx="1"
                  fill="none"
                  stroke={pred === "apple" ? ACCENT : "#f5b942"}
                  strokeWidth="0.9"
                />
                {!correct && (
                  <text x={cx} y={cy + 1.1} fontSize="3.6" fill="#ff5d6c" textAnchor="middle">
                    ✕
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="mt-1 font-mono text-[9px] text-ink-faint">
          ● your labels · ▢ model guesses {scored ? "(✕ = wrong)" : ""}
        </p>
      </div>

      {/* Accuracy meter */}
      {accuracy !== null && (
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${accuracy}%`,
                background: accuracy >= TARGET ? ACCENT : "var(--color-neon-amber, #f5b942)",
              }}
            />
          </div>
          <span className="font-mono text-xs" style={{ color: ACCENT }}>
            {accuracy}%
          </span>
        </div>
      )}

      {/* Status line */}
      <p
        className="text-center font-mono text-xs"
        style={{ color: solved ? ACCENT : "var(--color-ink-dim, #9aa3b2)" }}
        aria-live="polite"
      >
        {status}
      </p>

      {/* Controls */}
      <div className="mt-auto flex gap-2">
        <button
          type="button"
          onClick={train}
          disabled={!canTrain || solved}
          aria-label="Train the model and test its accuracy"
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: ACCENT, color: "#05070d" }}
        >
          {scored ? "Re-train" : "Train"} ▸
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="Reset all labels and start over"
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm text-ink-dim"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
