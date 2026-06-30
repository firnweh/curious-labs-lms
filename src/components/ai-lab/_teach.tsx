"use client";

import { useCallback, useRef, useState } from "react";
import { TeachableModel, type Prediction } from "@/lib/ai/knn";

/**
 * Shared "teachable model" plumbing + UI for the Neural Lab trainer
 * experiments. The hook owns a KNN TeachableModel; the two components render
 * the collect-samples controls and the live prediction bars, so each trainer
 * (image / pose / hand / audio / object) only has to feed in feature vectors.
 */

export interface TeachClass {
  id: string;
  label: string;
}

export function useTeachable() {
  const modelRef = useRef(new TeachableModel());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pred, setPred] = useState<Prediction | null>(null);

  const addSample = useCallback((id: string, vec: number[]) => {
    modelRef.current.addSample(id, vec);
    setCounts(modelRef.current.counts());
  }, []);

  const classify = useCallback((vec: number[]) => {
    setPred(modelRef.current.classify(vec));
  }, []);

  const reset = useCallback(() => {
    modelRef.current.reset();
    setCounts({});
    setPred(null);
  }, []);

  const trainedClasses = modelRef.current.trainedClasses();
  return { addSample, classify, reset, counts, pred, ready: trainedClasses >= 2 };
}

export function TrainerClasses({
  classes,
  counts,
  accent,
  onAdd,
  onReset,
  disabled,
}: {
  classes: TeachClass[];
  counts: Record<string, number>;
  accent: string;
  onAdd: (id: string) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">
        TEACH IT — show an example, then tap its button (≈8+ each)
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {classes.map((c) => {
          const n = counts[c.id] ?? 0;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => onAdd(c.id)}
              className="rounded-xl border-2 px-3 py-1.5 font-mono text-[11px] transition-colors disabled:opacity-40"
              style={{ borderColor: n > 0 ? accent : "#1e2738", background: n > 0 ? `${accent}1a` : "transparent", color: n > 0 ? accent : "#9fb0d0" }}
            >
              + {c.label} <span className="opacity-70">({n})</span>
            </button>
          );
        })}
        <button type="button" onClick={onReset} className="rounded-xl border border-[#2a3550] px-2.5 py-1.5 font-mono text-[10px] text-[#9fb0d0]">
          ↺ forget all
        </button>
      </div>
    </div>
  );
}

export function PredictionBars({
  classes,
  pred,
  accent,
  ready,
}: {
  classes: TeachClass[];
  pred: Prediction | null;
  accent: string;
  ready: boolean;
}) {
  const labelOf = (id: string) => classes.find((c) => c.id === id)?.label ?? id;
  return (
    <div>
      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">
        THE MODEL THINKS {pred && ready && <span style={{ color: accent }}>→ {labelOf(pred.label)}</span>}
      </p>
      {!ready ? (
        <p className="font-mono text-[10px] text-[#5b6b8c]">Teach at least 2 classes to start predicting.</p>
      ) : (
        <div className="space-y-1.5">
          {(pred?.scores ?? classes.map((c) => ({ label: c.id, score: 0 }))).map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate font-mono text-[10px] text-[#9fb0d0]">{labelOf(s.label)}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#1e2738]">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(s.score * 100)}%`, background: accent }} />
              </div>
              <span className="w-10 text-right font-mono text-[10px] text-[#5b6b8c]">{Math.round(s.score * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
