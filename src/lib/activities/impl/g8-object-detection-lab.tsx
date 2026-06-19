"use client";
/**
 * LEARNING GOAL: An image classifier learns from labelled examples, and its
 * accuracy depends on how MANY and how VARIED those examples are — balance the
 * three classes and include odd-angle variants, and the model stops guessing.
 */
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#a855f7";

/** The three object classes the learner trains the detector to tell apart. */
type ClassId = "pen" | "eraser" | "book";
const CLASS_IDS: readonly ClassId[] = ["pen", "eraser", "book"] as const;
const CLASS_LABEL: Record<ClassId, string> = {
  pen: "Pen",
  eraser: "Eraser",
  book: "Book",
};
const CLASS_EMOJI: Record<ClassId, string> = {
  pen: "🖊️",
  eraser: "🧽",
  book: "📕",
};

/**
 * A capturable sample. Hidden features are deterministic, normalised 0..1:
 *  - hue:    colour family (lets variety be measured)
 *  - edges:  how many straight edges the silhouette has
 *  - aspect: long-and-thin (low) ↔ chunky-square (high)
 * `varied` marks the "odd-angle" capture that widens a class's spread.
 */
interface Tile {
  id: string;
  cls: ClassId;
  emoji: string;
  hue: number;
  edges: number;
  aspect: number;
  varied: boolean;
}

interface Feat {
  hue: number;
  edges: number;
  aspect: number;
}

/** The class "ideal" each tile is jittered around — keeps classes separable. */
const PROTO: Record<ClassId, Feat> = {
  pen: { hue: 0.15, edges: 0.2, aspect: 0.12 },
  eraser: { hue: 0.55, edges: 0.5, aspect: 0.62 },
  book: { hue: 0.85, edges: 0.9, aspect: 0.85 },
};

/** Tiny symmetric jitter for the 6 "plain" samples of each class. */
const PLAIN_J: readonly number[] = [-0.04, 0.04, -0.03, 0.03, -0.02, 0.02];

/**
 * The 2 `varied` odd-angle samples per class. Their offsets pull the class
 * centroid DIRECTIONALLY toward the inter-class boundary, so capturing them
 * lets the model recognise off-angle test items it otherwise mislabels.
 */
const VARIED_OFFSET: Record<ClassId, readonly Feat[]> = {
  pen: [
    { hue: 0.2, edges: 0.22, aspect: 0.24 },
    { hue: 0.16, edges: 0.18, aspect: 0.2 },
  ],
  eraser: [
    { hue: 0.05, edges: 0.05, aspect: 0.05 },
    { hue: -0.05, edges: -0.05, aspect: -0.05 },
  ],
  book: [
    { hue: -0.22, edges: -0.2, aspect: -0.22 },
    { hue: -0.18, edges: -0.18, aspect: -0.2 },
  ],
};

/** Build the fixed tray: 8 tiles per class — 6 plain + 2 `varied` odd-angle. */
function buildTray(): Tile[] {
  const tray: Tile[] = [];
  CLASS_IDS.forEach((cls) => {
    const p = PROTO[cls];
    for (let i = 0; i < 6; i++) {
      const j = PLAIN_J[i];
      tray.push({
        id: `${cls}-${i}`,
        cls,
        emoji: CLASS_EMOJI[cls],
        hue: clamp01(p.hue + j),
        edges: clamp01(p.edges + j),
        aspect: clamp01(p.aspect + j),
        varied: false,
      });
    }
    VARIED_OFFSET[cls].forEach((v, k) => {
      tray.push({
        id: `${cls}-v${k}`,
        cls,
        emoji: CLASS_EMOJI[cls],
        hue: clamp01(p.hue + v.hue),
        edges: clamp01(p.edges + v.edges),
        aspect: clamp01(p.aspect + v.aspect),
        varied: true,
      });
    });
  });
  return tray;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** 5 fixed unseen test items, drawn from edges of each class's true spread. */
const TESTS: readonly Tile[] = [
  { id: "t0", cls: "pen", emoji: "🖋️", hue: 0.1, edges: 0.18, aspect: 0.1, varied: false },
  { id: "t1", cls: "eraser", emoji: "🧼", hue: 0.6, edges: 0.46, aspect: 0.66, varied: false },
  { id: "t2", cls: "book", emoji: "📗", hue: 0.82, edges: 0.92, aspect: 0.8, varied: false },
  // the two "hard" ones — only classifiable once the varied samples widen the
  // spread (verified: 6-plain-only mislabels both; adding the ⟂ tiles fixes them)
  { id: "t3", cls: "pen", emoji: "✒️", hue: 0.33, edges: 0.45, aspect: 0.35, varied: true },
  { id: "t4", cls: "book", emoji: "📘", hue: 0.4, edges: 0.88, aspect: 0.86, varied: true },
] as const;

const feat = (t: { hue: number; edges: number; aspect: number }): Feat => ({
  hue: t.hue,
  edges: t.edges,
  aspect: t.aspect,
});

function dist(a: Feat, b: Feat): number {
  const dh = a.hue - b.hue;
  const de = a.edges - b.edges;
  const da = a.aspect - b.aspect;
  return Math.sqrt(dh * dh + de * de + da * da);
}

interface TestOutcome {
  test: Tile;
  predicted: ClassId | null;
  correct: boolean;
  reason: string;
}

interface Trained {
  outcomes: TestOutcome[];
  accuracy: number; // 0..100, whole number
  diversity: number; // 0..100
  perClass: Record<ClassId, number>;
}

export default function ObjectDetectorTrainer({ onComplete }: ActivityProps) {
  const tray = useMemo<Tile[]>(() => buildTray(), []);
  const [buckets, setBuckets] = useState<Record<ClassId, string[]>>({
    pen: [],
    eraser: [],
    book: [],
  });
  const [result, setResult] = useState<Trained | null>(null);
  const [revealed, setRevealed] = useState<number>(0);
  const [status, setStatus] = useState<string>(
    "Tap tray objects into the right class, then Train.",
  );
  const [won, setWon] = useState<boolean>(false);
  const firedRef = useRef<boolean>(false);

  const tileById = useMemo<Map<string, Tile>>(
    () => new Map(tray.map((t) => [t.id, t])),
    [tray],
  );

  const usedIds = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    CLASS_IDS.forEach((c) => buckets[c].forEach((id) => s.add(id)));
    return s;
  }, [buckets]);

  const capture = useCallback(
    (t: Tile): void => {
      if (won || usedIds.has(t.id)) return;
      setResult(null);
      setRevealed(0);
      setBuckets((prev) => ({ ...prev, [t.cls]: [...prev[t.cls], t.id] }));
      setStatus(`Added a ${CLASS_LABEL[t.cls]} sample — keep balancing.`);
    },
    [won, usedIds],
  );

  const removeSample = useCallback(
    (cls: ClassId, id: string): void => {
      if (won) return;
      setResult(null);
      setRevealed(0);
      setBuckets((prev) => ({ ...prev, [cls]: prev[cls].filter((x) => x !== id) }));
    },
    [won],
  );

  /** Centroid of each bucket from the captured samples' hidden features. */
  const centroids = useMemo<Partial<Record<ClassId, Feat>>>(() => {
    const out: Partial<Record<ClassId, Feat>> = {};
    CLASS_IDS.forEach((cls) => {
      const ids = buckets[cls];
      if (ids.length === 0) return;
      let h = 0;
      let e = 0;
      let a = 0;
      ids.forEach((id) => {
        const t = tileById.get(id);
        if (!t) return;
        h += t.hue;
        e += t.edges;
        a += t.aspect;
      });
      out[cls] = { hue: h / ids.length, edges: e / ids.length, aspect: a / ids.length };
    });
    return out;
  }, [buckets, tileById]);

  const reset = useCallback((): void => {
    setBuckets({ pen: [], eraser: [], book: [] });
    setResult(null);
    setRevealed(0);
    setWon(false);
    setStatus("Tap tray objects into the right class, then Train.");
  }, []);

  const train = useCallback((): void => {
    if (won) return;

    // Need at least one sample in every class to have a model at all.
    const empties = CLASS_IDS.filter((c) => buckets[c].length === 0);
    if (empties.length > 0) {
      setResult(null);
      setRevealed(0);
      setStatus(`Give every class an example — ${empties.map((c) => CLASS_LABEL[c]).join(", ")} still empty.`);
      onComplete({ passed: false, detail: "Every class needs at least one sample." });
      return;
    }

    const perClass: Record<ClassId, number> = {
      pen: buckets.pen.length,
      eraser: buckets.eraser.length,
      book: buckets.book.length,
    };
    const variedCount = CLASS_IDS.reduce(
      (n, c) => n + buckets[c].filter((id) => tileById.get(id)?.varied).length,
      0,
    );
    // Diversity meter: spread of each bucket's hue, scaled — varied tiles widen it.
    let spreadSum = 0;
    CLASS_IDS.forEach((c) => {
      const hues = buckets[c].map((id) => tileById.get(id)?.hue ?? 0);
      if (hues.length > 1) {
        const mn = Math.min(...hues);
        const mx = Math.max(...hues);
        spreadSum += mx - mn;
      }
    });
    const diversity = Math.min(100, Math.round((spreadSum / 0.9) * 100));

    // Classify each unseen test by nearest captured centroid (real JS math).
    const outcomes: TestOutcome[] = TESTS.map((test) => {
      let best: ClassId | null = null;
      let bestD = Infinity;
      CLASS_IDS.forEach((c) => {
        const ctr = centroids[c];
        if (!ctr) return;
        const d = dist(feat(test), ctr);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      });
      const correct = best === test.cls;
      let reason: string;
      if (correct) {
        reason = `Matched ${CLASS_LABEL[test.cls]} — good centroid.`;
      } else if (perClass[test.cls] < 6) {
        reason = `Too few ${CLASS_LABEL[test.cls]} samples — its centroid is weak.`;
      } else if (test.varied) {
        reason = `All ${CLASS_LABEL[test.cls]}s looked the same — add the odd-angle variants.`;
      } else {
        reason = `Confused with ${best ? CLASS_LABEL[best] : "?"} — needs cleaner samples.`;
      }
      return { test, predicted: best, correct, reason };
    });

    const hits = outcomes.filter((o) => o.correct).length;
    const accuracy = Math.round((hits / TESTS.length) * 100);

    const trained: Trained = { outcomes, accuracy, diversity, perClass };
    setResult(trained);
    setRevealed(0);

    // Drop the test tiles in one at a time for drama.
    let i = 0;
    const tick = (): void => {
      i += 1;
      setRevealed(i);
      if (i < TESTS.length) {
        window.setTimeout(tick, 360);
      } else {
        finish(trained);
      }
    };
    window.setTimeout(tick, 280);

    const finish = (tr: Trained): void => {
      const balanced = CLASS_IDS.every((c) => tr.perClass[c] >= 6);
      if (tr.accuracy >= 90 && balanced) {
        if (!firedRef.current) {
          firedRef.current = true;
          setWon(true);
          setStatus(`Detector trained — ${tr.accuracy}% on unseen items!`);
          onComplete({
            passed: true,
            stars: 3,
            detail: `${tr.accuracy}% accuracy with balanced, varied classes.`,
          });
        }
      } else {
        const why = !balanced
          ? "Balance the classes — at least 6 samples each."
          : variedCount < 2
            ? "Add the ⟂ odd-angle variants so the model sees variety."
            : "Almost — more balanced, varied samples will push past 90%.";
        setStatus(`${tr.accuracy}% accuracy. ${why}`);
        onComplete({ passed: false, detail: why });
      }
    };
  }, [won, buckets, tileById, centroids, onComplete]);

  const totalCaptured = usedIds.size;

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3 text-ink">
      <style>{`
        @keyframes g8objectdetectionlab-pop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g8objectdetectionlab-drop {
          0% { transform: translateY(-14px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes g8objectdetectionlab-fill {
          from { width: 0%; }
        }
        @keyframes g8objectdetectionlab-cheer {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-5px) rotate(-7deg); }
          75% { transform: translateY(-5px) rotate(7deg); }
        }
      `}</style>

      {/* Header / status */}
      <div className="panel rounded-xl p-3">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm" style={{ color: ACCENT }}>
            👁️ Object Detector Trainer
          </span>
          <span className="font-mono text-[11px] text-ink-faint">
            {totalCaptured} captured
          </span>
        </div>
        <p
          role="status"
          aria-live="polite"
          className="mt-1.5 text-xs leading-snug text-ink-dim"
        >
          {status}
        </p>
      </div>

      {/* Class buckets */}
      <div className="flex flex-col gap-2">
        {CLASS_IDS.map((cls) => {
          const ids = buckets[cls];
          const enough = ids.length >= 6;
          return (
            <div key={cls} className="panel rounded-xl p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span aria-hidden="true">{CLASS_EMOJI[cls]}</span>
                  {CLASS_LABEL[cls]}
                </span>
                <span
                  className="font-mono text-[11px]"
                  style={{ color: enough ? "#22c55e" : "#94a3b8" }}
                  aria-label={`${ids.length} of 6 samples`}
                >
                  {ids.length}/6 {enough ? "✓" : ""}
                </span>
              </div>
              <div
                className="flex min-h-[40px] flex-wrap gap-1 rounded-lg p-1"
                style={{ background: "rgba(11,16,32,0.5)" }}
                role="list"
                aria-label={`${CLASS_LABEL[cls]} training samples`}
              >
                {ids.length === 0 && (
                  <span className="px-1 py-1.5 text-[11px] text-ink-faint">
                    empty — add samples
                  </span>
                )}
                {ids.map((id) => {
                  const t = tileById.get(id);
                  if (!t) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onPointerDown={() => removeSample(cls, id)}
                      aria-label={`Remove ${CLASS_LABEL[cls]} sample${t.varied ? ", odd-angle variant" : ""}`}
                      className="relative grid h-8 w-8 place-items-center rounded-md text-base"
                      style={{
                        background: "rgba(168,85,247,0.14)",
                        border: `1px solid ${t.varied ? ACCENT : "rgba(168,85,247,0.3)"}`,
                        animation: "g8objectdetectionlab-pop 220ms ease-out",
                        touchAction: "manipulation",
                      }}
                    >
                      <span aria-hidden="true">{t.emoji}</span>
                      {t.varied && (
                        <span
                          aria-hidden="true"
                          className="absolute -right-1 -top-1 rounded-full px-0.5 text-[8px] font-bold"
                          style={{ background: ACCENT, color: "#05070d" }}
                        >
                          ⟂
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Capture tray */}
      <div className="panel rounded-xl p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-dim">Capture tray</span>
          <span className="font-mono text-[10px] text-ink-faint">⟂ = odd-angle variant</span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Objects to capture">
          {tray.map((t) => {
            const used = usedIds.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                disabled={used || won}
                onPointerDown={() => capture(t)}
                aria-label={`Capture ${CLASS_LABEL[t.cls]}${t.varied ? " odd-angle variant" : ""}`}
                className="relative grid h-9 w-9 place-items-center rounded-lg text-lg disabled:opacity-25"
                style={{
                  background: "rgba(11,16,32,0.6)",
                  border: `1px solid ${t.varied ? ACCENT : "var(--color-line, #27314f)"}`,
                  touchAction: "manipulation",
                }}
              >
                <span aria-hidden="true">{t.emoji}</span>
                {t.varied && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 rounded-full px-0.5 text-[8px] font-bold"
                    style={{ background: ACCENT, color: "#05070d" }}
                  >
                    ⟂
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={train}
          disabled={won}
          className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Train the detector and run the unseen test set"
        >
          {won ? "Trained ✓" : "Train ▶"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2.5 text-sm font-medium text-ink-dim"
          aria-label="Reset all buckets and start over"
        >
          Reset
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="panel rounded-xl p-3">
          {/* Accuracy bar */}
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-ink-dim">Test accuracy</span>
            <span className="font-display tabular-nums" style={{ color: ACCENT }}>
              {result.accuracy}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: "rgba(11,16,32,0.7)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${result.accuracy}%`,
                background: result.accuracy >= 90 ? "#22c55e" : ACCENT,
                animation: "g8objectdetectionlab-fill 700ms ease-out",
                transition: "width 500ms ease-out",
              }}
            />
          </div>

          {/* Diversity meter */}
          <div className="mt-2.5 mb-1 flex items-center justify-between text-xs">
            <span className="text-ink-dim">Data diversity</span>
            <span className="font-mono tabular-nums text-ink-faint">{result.diversity}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(11,16,32,0.7)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${result.diversity}%`, background: "#22d3ee", transition: "width 500ms ease-out" }}
            />
          </div>

          {/* Test tiles dropping in */}
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {result.outcomes.map((o, i) => {
              const shown = i < revealed;
              return (
                <div
                  key={o.test.id}
                  title={shown ? o.reason : "testing…"}
                  className="flex flex-col items-center gap-1 rounded-lg p-1.5"
                  style={{
                    background: shown
                      ? o.correct
                        ? "rgba(34,197,94,0.14)"
                        : "rgba(248,113,113,0.14)"
                      : "rgba(11,16,32,0.5)",
                    border: `1px solid ${shown ? (o.correct ? "#22c55e" : "#f87171") : "var(--color-line,#27314f)"}`,
                    animation: shown ? "g8objectdetectionlab-drop 300ms ease-out" : undefined,
                    opacity: shown ? 1 : 0.3,
                  }}
                  aria-label={
                    shown
                      ? `Test item ${o.correct ? "correct" : "wrong"}: ${o.reason}`
                      : "Test pending"
                  }
                >
                  <span className="text-lg" aria-hidden="true">{o.test.emoji}</span>
                  <span aria-hidden="true" className="text-xs">
                    {shown ? (o.correct ? "✅" : "❌") : "…"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Why-wrong notes */}
          {revealed >= TESTS.length && (
            <ul className="mt-2 flex flex-col gap-1">
              {result.outcomes
                .filter((o) => !o.correct)
                .map((o) => (
                  <li key={o.test.id} className="text-[11px] leading-snug text-ink-faint">
                    <span aria-hidden="true">{o.test.emoji}</span>{" "}
                    <span style={{ color: "#f87171" }}>✕</span> {o.reason}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {/* Win celebration */}
      {won && (
        <div
          className="panel rounded-xl p-4 text-center"
          style={{ boxShadow: `0 0 0 1px ${ACCENT}, 0 0 28px -6px ${ACCENT}` }}
          role="status"
          aria-label="Lab complete, three stars"
        >
          <div
            className="text-3xl"
            style={{ animation: "g8objectdetectionlab-cheer 900ms ease-in-out infinite" }}
            aria-hidden="true"
          >
            ✨🎉
          </div>
          <p className="mt-1 font-display text-sm" style={{ color: ACCENT }}>
            Detector trained! ⭐⭐⭐
          </p>
          <p className="mt-1 text-[11px] leading-snug text-ink-faint">
            Balanced classes + varied samples = a model that reads unseen objects.
          </p>
        </div>
      )}
    </div>
  );
}
