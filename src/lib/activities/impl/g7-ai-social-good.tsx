"use client";
// Learning goal: a classifier is only as good as its labelled data — train it,
// read its accuracy from a confusion matrix, then judge its limits before trusting it.
import { useCallback, useMemo, useRef, useState } from "react";
import type { ActivityProps } from "@/lib/activities/types";

const ACCENT = "#a855f7";
const HEALTHY = "#34d399";
const DISEASED = "#fbbf24";
const WRONG = "#fb7185";
/** Test accuracy needed to trust the model enough to move on. */
const TARGET = 80;

type Truth = "healthy" | "diseased";
type Stage = "label" | "train" | "test";

interface Leaf {
  id: string;
  /** Ground-truth class — what the leaf REALLY is. */
  truth: Truth;
  /** Visible feature: brown spots mean disease. The learner reads this to label. */
  spots: number;
  emoji: string;
}

/**
 * 12 training leaves. The honest rule "any brown spots => diseased" labels every
 * one of these correctly, so a clean LABEL pass trains a model that scores 100%
 * on the held-out test set below. Spots are the only feature the rule sees.
 */
const TRAIN: readonly Leaf[] = [
  { id: "h1", truth: "healthy", spots: 0, emoji: "🍃" },
  { id: "h2", truth: "healthy", spots: 0, emoji: "🌿" },
  { id: "h3", truth: "healthy", spots: 0, emoji: "🍃" },
  { id: "h4", truth: "healthy", spots: 0, emoji: "🌱" },
  { id: "h5", truth: "healthy", spots: 0, emoji: "🌿" },
  { id: "h6", truth: "healthy", spots: 0, emoji: "🍃" },
  { id: "d1", truth: "diseased", spots: 3, emoji: "🍂" },
  { id: "d2", truth: "diseased", spots: 4, emoji: "🍁" },
  { id: "d3", truth: "diseased", spots: 2, emoji: "🍂" },
  { id: "d4", truth: "diseased", spots: 5, emoji: "🍁" },
  { id: "d5", truth: "diseased", spots: 3, emoji: "🍂" },
  { id: "d6", truth: "diseased", spots: 4, emoji: "🍁" },
] as const;

/**
 * 6 held-out test leaves the learner never labels — the model classifies these
 * to fill the confusion matrix. The last one is a deliberate EDGE CASE: a yellow
 * leaf with no brown spots. The spots-rule calls it "healthy", but it is really
 * diseased, so it always lands as a false negative — the teaching point about a
 * model's blind spot. With the other 5 correct, accuracy = 5/6 = 83% >= TARGET.
 */
const TEST: readonly Leaf[] = [
  { id: "t1", truth: "healthy", spots: 0, emoji: "🍃" },
  { id: "t2", truth: "healthy", spots: 0, emoji: "🌿" },
  { id: "t3", truth: "diseased", spots: 4, emoji: "🍁" },
  { id: "t4", truth: "diseased", spots: 3, emoji: "🍂" },
  { id: "t5", truth: "healthy", spots: 0, emoji: "🌱" },
  { id: "t6", truth: "diseased", spots: 0, emoji: "🍋" },
] as const;

type Labels = Record<string, Truth | undefined>;

interface Cell {
  leaf: Leaf;
  /** What the learned rule predicted. */
  pred: Truth;
  correct: boolean;
}

/** Confusion-matrix tallies, "diseased" treated as the positive class. */
interface Matrix {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

/**
 * The model: learn a spot-threshold from the learner's labels, then predict.
 * threshold = the smallest spot-count any leaf the learner called "diseased" had
 * (default 1 if none). Predict diseased when spots >= threshold. With correct
 * labels this becomes "any spots => diseased", which is exactly the honest rule.
 */
function learnThreshold(labelled: { leaf: Leaf; label: Truth }[]): number {
  const diseased = labelled.filter((l) => l.label === "diseased");
  if (diseased.length === 0) return 1;
  return Math.max(1, Math.min(...diseased.map((l) => l.leaf.spots)));
}

function predict(leaf: Leaf, threshold: number): Truth {
  return leaf.spots >= threshold ? "diseased" : "healthy";
}

export default function AIForSocialGood({ onComplete }: ActivityProps) {
  const [labels, setLabels] = useState<Labels>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("label");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [ethics, setEthics] = useState<"safe" | "more-data" | null>(null);
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Tap a leaf, then tap a bucket to label your training set.",
  );
  const firedRef = useRef<boolean>(false);

  const labelledList = useMemo(
    () =>
      TRAIN.flatMap((leaf) => {
        const label = labels[leaf.id];
        return label ? [{ leaf, label }] : [];
      }),
    [labels],
  );

  const labelledCount = labelledList.length;
  const allLabelled = labelledCount === TRAIN.length;
  const allCorrect = useMemo(
    () => labelledList.every(({ leaf, label }) => label === leaf.truth),
    [labelledList],
  );

  const assign = useCallback(
    (id: string, kind: Truth): void => {
      if (stage !== "label") return;
      setLabels((prev) => ({ ...prev, [id]: kind }));
      setSelected(null);
      setStatus("Tap a leaf, then tap a bucket to label your training set.");
    },
    [stage],
  );

  const pickBucket = useCallback(
    (kind: Truth): void => {
      if (selected) assign(selected, kind);
    },
    [selected, assign],
  );

  const train = useCallback((): void => {
    if (!allLabelled) return;
    const threshold = learnThreshold(labelledList);
    // The model "re-labels" the training set; mislabels lower the train score.
    const learnedRight = labelledList.reduce(
      (n, { leaf, label }) => (predict(leaf, threshold) === label ? n + 1 : n),
      0,
    );
    const trainScore = Math.round((100 * learnedRight) / TRAIN.length);
    setAccuracy(trainScore);
    setStage("train");
    setStatus(
      allCorrect
        ? `Model trained — it agrees with ${trainScore}% of your labels. Now run the test set.`
        : `Trained, but only ${trainScore}% — some labels disagree. Re-check the spotted leaves.`,
    );
  }, [allLabelled, labelledList, allCorrect]);

  const runTest = useCallback((): void => {
    const threshold = learnThreshold(labelledList);
    const scored: Cell[] = TEST.map((leaf) => {
      const pred = predict(leaf, threshold);
      return { leaf, pred, correct: pred === leaf.truth };
    });
    const m: Matrix = { tp: 0, tn: 0, fp: 0, fn: 0 };
    for (const c of scored) {
      if (c.leaf.truth === "diseased" && c.pred === "diseased") m.tp += 1;
      else if (c.leaf.truth === "healthy" && c.pred === "healthy") m.tn += 1;
      else if (c.leaf.truth === "healthy" && c.pred === "diseased") m.fp += 1;
      else m.fn += 1;
    }
    const acc = Math.round((100 * (m.tp + m.tn)) / TEST.length);
    setCells(scored);
    setMatrix(m);
    setAccuracy(acc);
    setStage("test");
    setStatus(
      acc >= TARGET
        ? `Test accuracy ${acc}% — one ethics check stands between you and shipping it.`
        : `Test accuracy ${acc}% — below ${TARGET}%. Reset, relabel carefully, retrain.`,
    );
  }, [labelledList]);

  const answerEthics = useCallback(
    (choice: "safe" | "more-data"): void => {
      setEthics(choice);
      const accuracyOk = (accuracy ?? 0) >= TARGET;
      if (choice === "more-data" && accuracyOk && !firedRef.current) {
        firedRef.current = true;
        setSolved(true);
        setStatus("Shipped responsibly! Accurate enough — and you knew its limits.");
        onComplete({
          passed: true,
          stars: 3,
          detail: `Trained to ${accuracy}% and refused to over-trust it across crops.`,
        });
      } else if (choice === "safe") {
        setStatus(
          "Careful — it only ever saw THIS crop. High accuracy here doesn't transfer.",
        );
        onComplete({
          passed: false,
          detail: "Same accuracy won't hold on a crop it never trained on — it needs more data.",
        });
      } else {
        setStatus(`Right instinct, but lift accuracy to ${TARGET}%+ first.`);
      }
    },
    [accuracy, onComplete],
  );

  const reset = useCallback((): void => {
    setLabels({});
    setSelected(null);
    setStage("label");
    setAccuracy(null);
    setCells(null);
    setMatrix(null);
    setEthics(null);
    setSolved(false);
    firedRef.current = false;
    setStatus("Tap a leaf, then tap a bucket to label your training set.");
  }, []);

  const accuracyOk = (accuracy ?? 0) >= TARGET;

  return (
    <div
      className="flex w-full flex-col gap-3"
      style={{ maxWidth: 440, margin: "0 auto" }}
    >
      <style>{`
        @keyframes g7aisocialgood-pop {
          0% { transform: scale(0.4); opacity: 0; }
          70% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g7aisocialgood-fill {
          from { width: 0%; }
        }
        @keyframes g7aisocialgood-glow {
          0%, 100% { box-shadow: 0 0 0 1px ${ACCENT}, 0 0 18px -6px ${ACCENT}; }
          50% { box-shadow: 0 0 0 1px ${ACCENT}, 0 0 28px 0px ${ACCENT}; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] tracking-tech text-ink-dim">
          🌍 brown spots = diseased · clean green = healthy
        </p>
        <span
          className="rounded-md px-2 py-0.5 font-mono text-[11px]"
          style={{ background: "rgba(168,85,247,0.14)", color: ACCENT }}
        >
          {stage === "label" ? "1 · label" : stage === "train" ? "2 · train" : "3 · evaluate"}
        </span>
      </div>

      {/* Stage 1 — LABEL tray + buckets */}
      <div className="panel rounded-lg p-2">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-tech text-ink-faint">
          Training leaves — label all {TRAIN.length}
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {TRAIN.map((leaf) => {
            const label = labels[leaf.id];
            const isSel = selected === leaf.id;
            return (
              <button
                key={leaf.id}
                type="button"
                aria-label={`Leaf ${leaf.id}, ${leaf.spots} brown spots${label ? `, labelled ${label}` : ", unlabelled"}`}
                aria-pressed={isSel}
                disabled={stage !== "label"}
                onPointerDown={() =>
                  stage === "label" && setSelected(isSel ? null : leaf.id)
                }
                className="relative flex aspect-square items-center justify-center rounded-md border bg-panel-2/70 text-xl transition-transform active:scale-95 disabled:opacity-60"
                style={{
                  touchAction: "manipulation",
                  borderColor: label
                    ? label === "healthy"
                      ? HEALTHY
                      : DISEASED
                    : isSel
                      ? ACCENT
                      : "var(--color-line, #2a2f3a)",
                  boxShadow: isSel ? `0 0 0 2px ${ACCENT}` : undefined,
                }}
              >
                <span aria-hidden>{leaf.emoji}</span>
                {/* render the visible spots so the feature is readable */}
                {leaf.spots > 0 && (
                  <span
                    aria-hidden
                    className="absolute left-0.5 top-0.5 font-mono text-[8px] leading-none"
                    style={{ color: DISEASED }}
                  >
                    {"•".repeat(Math.min(leaf.spots, 3))}
                  </span>
                )}
                {label && (
                  <span
                    aria-hidden
                    className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full"
                    style={{ background: label === "healthy" ? HEALTHY : DISEASED }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["healthy", "diseased"] as Truth[]).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={!selected || stage !== "label"}
              onPointerDown={() => pickBucket(kind)}
              aria-label={`Put selected leaf in the ${kind} bucket`}
              className="flex items-center justify-center gap-1.5 rounded-lg border py-2 font-mono text-xs transition-colors disabled:opacity-40"
              style={{
                touchAction: "manipulation",
                borderColor: selected
                  ? kind === "healthy"
                    ? HEALTHY
                    : DISEASED
                  : "var(--color-line, #2a2f3a)",
                background: selected
                  ? kind === "healthy"
                    ? "rgba(52,211,153,0.12)"
                    : "rgba(251,191,36,0.12)"
                  : "transparent",
                color: "var(--color-ink, #e6e9ef)",
              }}
            >
              <span aria-hidden className="text-base">
                {kind === "healthy" ? "✅" : "🦠"}
              </span>
              {kind === "healthy" ? "Healthy" : "Diseased"}
            </button>
          ))}
        </div>
        {stage === "label" && (
          <p className="mt-1.5 text-center font-mono text-[10px] text-ink-faint">
            {labelledCount} / {TRAIN.length} labelled
          </p>
        )}
      </div>

      {/* Accuracy meter (after train / test) */}
      {accuracy !== null && (
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${accuracy}%`,
                background: accuracyOk ? ACCENT : DISEASED,
                animation: "g7aisocialgood-fill 700ms ease",
              }}
            />
          </div>
          <span className="font-mono text-xs" style={{ color: accuracyOk ? ACCENT : DISEASED }}>
            {accuracy}%
          </span>
        </div>
      )}

      {/* Stage 3 — confusion matrix */}
      {matrix && cells && (
        <div className="panel rounded-lg p-2">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-tech text-ink-faint">
            Confusion matrix — 6 held-out leaves · accuracy = (TP+TN)/6
          </p>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-center font-mono text-[10px]">
            <span />
            <span className="text-ink-faint">pred diseased</span>
            <span className="text-ink-faint">pred healthy</span>

            <span className="self-center text-ink-faint">is diseased</span>
            <MatrixCell label="TP" n={matrix.tp} good />
            <MatrixCell label="FN" n={matrix.fn} />

            <span className="self-center text-ink-faint">is healthy</span>
            <MatrixCell label="FP" n={matrix.fp} />
            <MatrixCell label="TN" n={matrix.tn} good />
          </div>
          {/* the misclassified leaves, called out so the blind spot is visible */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {cells.map(({ leaf, correct }) => (
              <span
                key={leaf.id}
                title={`${leaf.id}: ${correct ? "correct" : "misclassified"}`}
                className="flex items-center gap-0.5 rounded px-1 py-0.5 text-sm"
                style={{
                  border: `1px solid ${correct ? "var(--color-line, #2a2f3a)" : WRONG}`,
                  opacity: correct ? 0.85 : 1,
                }}
              >
                <span aria-hidden>{leaf.emoji}</span>
                {!correct && (
                  <span aria-hidden style={{ color: WRONG }} className="text-[10px]">
                    ✕
                  </span>
                )}
              </span>
            ))}
          </div>
          {matrix.fn > 0 && (
            <p className="mt-1.5 text-center font-mono text-[9px]" style={{ color: WRONG }}>
              ✕ the yellow no-spot leaf fooled the spots rule — a real blind spot.
            </p>
          )}
        </div>
      )}

      {/* Stage 3 — ethics check */}
      {stage === "test" && accuracyOk && (
        <div
          className="panel rounded-lg p-3"
          style={solved ? { animation: "g7aisocialgood-glow 1.6s ease-in-out infinite" } : undefined}
        >
          <p className="mb-2 font-mono text-[11px] leading-snug text-ink-dim">
            🤔 You trained on ONE crop&apos;s leaves. Is it safe to use this model on a
            totally different crop right away?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "safe", text: "Yes — it's 83%+" },
              { key: "more-data", text: "No — needs more data" },
            ] as { key: "safe" | "more-data"; text: string }[]).map((opt) => (
              <button
                key={opt.key}
                type="button"
                disabled={solved}
                onPointerDown={() => answerEthics(opt.key)}
                aria-label={opt.text}
                aria-pressed={ethics === opt.key}
                className="rounded-lg border py-2 font-mono text-[11px] transition-colors disabled:opacity-60"
                style={{
                  touchAction: "manipulation",
                  borderColor:
                    ethics === opt.key
                      ? opt.key === "more-data"
                        ? ACCENT
                        : WRONG
                      : "var(--color-line, #2a2f3a)",
                  background:
                    ethics === opt.key && opt.key === "more-data"
                      ? "rgba(168,85,247,0.14)"
                      : "transparent",
                  color: "var(--color-ink, #e6e9ef)",
                }}
              >
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Win celebration */}
      {solved && (
        <div
          className="panel rounded-lg p-3 text-center"
          style={{ animation: "g7aisocialgood-pop 420ms ease both" }}
          role="status"
        >
          <div className="text-2xl" aria-hidden>
            ✨🎉
          </div>
          <div className="my-1 text-xl tracking-widest" aria-label="Three stars earned">
            ⭐⭐⭐
          </div>
          <p className="font-mono text-xs" style={{ color: ACCENT }}>
            Labelled → trained → evaluated → judged. That&apos;s responsible AI.
          </p>
        </div>
      )}

      {/* Status line */}
      <p
        className="text-center font-mono text-xs"
        aria-live="polite"
        role="status"
        style={{ color: solved ? ACCENT : "var(--color-ink-dim, #9aa3b2)" }}
      >
        {status}
      </p>

      {/* Controls */}
      <div className="mt-auto flex gap-2">
        {stage === "label" && (
          <button
            type="button"
            onPointerDown={train}
            disabled={!allLabelled}
            aria-label="Train the model on your labelled leaves"
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ touchAction: "manipulation", background: ACCENT, color: "#05070d" }}
          >
            Train ▸
          </button>
        )}
        {stage === "train" && (
          <button
            type="button"
            onPointerDown={runTest}
            aria-label="Classify the held-out test leaves and build the confusion matrix"
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium"
            style={{ touchAction: "manipulation", background: ACCENT, color: "#05070d" }}
          >
            Run test set ▸
          </button>
        )}
        <button
          type="button"
          onPointerDown={reset}
          aria-label="Reset and start over from labelling"
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm text-ink-dim"
          style={{ touchAction: "manipulation" }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function MatrixCell({ label, n, good }: { label: string; n: number; good?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded py-1.5"
      style={{
        background: good ? "rgba(52,211,153,0.10)" : "rgba(251,113,133,0.08)",
        border: `1px solid ${good ? "rgba(52,211,153,0.4)" : "rgba(251,113,133,0.3)"}`,
      }}
    >
      <span className="text-[9px] text-ink-faint">{label}</span>
      <span className="text-sm" style={{ color: good ? HEALTHY : WRONG }}>
        {n}
      </span>
    </div>
  );
}
