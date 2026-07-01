"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageEmbedder } from "@mediapipe/tasks-vision";
import { loadImageEmbedder } from "@/lib/ai/vision";
import { CameraStage, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";
import { PredictionBars, TrainerClasses, useTeachable, type TeachClass } from "./_teach";

/**
 * Neural Lab — "Train an Image Brain": the KID is the trainer.
 *
 * Name your own 2–3 things, show the camera an example, tap a class to save it.
 * MobileNet turns each frame into an embedding (numbers); a KNN matches new frames
 * to the nearest class you taught. Live bars make "more + varied examples → more
 * confident" visible, and a "what you learned" recap surfaces the lesson — incl.
 * that lopsided examples make it biased. All on-device.
 */

const ACCENT = "#34d399";
const IDS = ["a", "b", "c"] as const;
const DEFAULTS: Record<string, string> = { a: "Thing 1", b: "Thing 2", c: "Thing 3" };

export default function TrainImageBrain() {
  const { videoRef, status, error, start, stop } = useCamera();
  const embRef = useRef<ImageEmbedder | null>(null);
  const rafRef = useRef<number | null>(null);
  const vecRef = useRef<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>(DEFAULTS);
  const [everConfident, setEverConfident] = useState(false);
  const { addSample, classify, reset, counts, pred, ready } = useTeachable();

  const classes: TeachClass[] = IDS.map((id) => ({ id, label: labels[id]?.trim() || DEFAULTS[id] }));

  const loop = useCallback(() => {
    const video = videoRef.current, emb = embRef.current;
    if (!video || !emb || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const res = emb.embedForVideo(video, performance.now());
    const v = res.embeddings[0]?.floatEmbedding;
    if (v) {
      vecRef.current = Array.from(v);
      classify(vecRef.current);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef, classify]);

  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadImageEmbedder()
      .then((d) => {
        if (cancelled) return d.close();
        embRef.current = d;
        setLoading(false);
        rafRef.current = requestAnimationFrame(loop);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      embRef.current?.close();
      embRef.current = null;
    };
  }, [status, loop]);

  useEffect(() => () => stop(), [stop]);

  // A confident prediction unlocks the "nearest class" lesson.
  useEffect(() => {
    if (everConfident || !pred?.scores?.length) return;
    if (Math.max(...pred.scores.map((s) => s.score)) > 0.85) setEverConfident(true);
  }, [pred, everConfident]);

  const onAdd = (id: string) => { if (vecRef.current) addSample(id, vecRef.current); };
  const ns = IDS.map((id) => counts[id] ?? 0);
  const total = ns.reduce((a, b) => a + b, 0);
  const taught = ns.filter((n) => n > 0);
  const maxC = taught.length ? Math.max(...taught) : 0;
  const minC = taught.length ? Math.min(...taught) : 0;
  const plenty = maxC >= 8;
  const biased = taught.length >= 2 && minC >= 1 && maxC >= 3 * minC;

  const LEARN = [
    { id: "teacher", text: "YOU are the teacher — the AI learns from the examples you label. That's supervised learning.", got: total >= 1 },
    { id: "embed", text: "Each photo becomes NUMBERS (an “embedding”); it remembers the average for each class.", got: ready },
    { id: "nearest", text: "A new photo gets matched to the CLOSEST class you taught — that's the prediction.", got: everConfident },
    { id: "data", text: "More + VARIED examples → steadier predictions. Lopsided examples make it BIASED.", got: plenty || biased },
  ];
  const learned = LEARN.filter((l) => l.got).length;

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🧠" title="Train an Image Brain" grades="Grades 4–10" topic="Machine learning · you train it" accent={ACCENT} right={`${total} examples`} />

      <Caption accent={ACCENT} active={ready}>
        {status === "on"
          ? loading
            ? "Loading the embedding model… (first time downloads a few MB)"
            : ready
              ? "🧠 It's predicting from what YOU taught! Add more examples (new angles, lighting) to whichever it gets wrong, and watch its bars climb."
              : "① Name your things below. ② Show one to the camera and tap its button ~8 times. ③ Do the others, then watch it predict."
          : "Turn on the camera and train your OWN image classifier — no coding, just examples."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={{ current: null }} status={status} error={error} accent={ACCENT} onStart={start} />

      {/* ① Name your things */}
      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">① NAME YOUR THINGS · pick 2–3 (e.g. “Me”, “My hand”, “Empty”)</p>
      <div className="flex flex-wrap gap-1.5">
        {IDS.map((id) => (
          <input
            key={id}
            value={labels[id]}
            onChange={(e) => setLabels((l) => ({ ...l, [id]: e.target.value.slice(0, 16) }))}
            placeholder="name it…"
            className="w-32 rounded-lg border bg-[#0f1420] px-2.5 py-1.5 font-mono text-[11px] text-[#e8eefc] outline-none"
            style={{ borderColor: "#2a3550" }}
          />
        ))}
      </div>

      {/* ② Teach + ③ predict (shared trainer UI) */}
      <TrainerClasses classes={classes} counts={counts} accent={ACCENT} onAdd={onAdd} onReset={reset} disabled={status !== "on" || loading} />
      <PredictionBars classes={classes} pred={pred} accent={ACCENT} ready={ready} />

      {ready && (
        <p className="mt-2 font-mono text-[10px] text-[#9fb0d0]">
          ✅ Trained! Now show each thing — does it guess right? If it gets one wrong, teach it a few more examples of that one.
        </p>
      )}

      {/* What you learned */}
      <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: learned ? `${ACCENT}55` : "#1e2738", background: "#0f1420" }}>
        <p className="mb-2 font-mono text-[10px] tracking-wide" style={{ color: ACCENT }}>🧠 WHAT YOU LEARNED · {learned}/{LEARN.length}</p>
        <div className="space-y-1.5">
          {LEARN.map((l) => (
            <div key={l.id} className="flex items-start gap-2 font-mono text-[11px] leading-relaxed transition-opacity duration-300" style={{ opacity: l.got ? 1 : 0.4 }}>
              <span className="shrink-0">{l.got ? "✅" : "🔒"}</span>
              <span style={{ color: l.got ? "#e8eefc" : "#9fb0d0" }}>{l.text}</span>
            </div>
          ))}
        </div>
      </div>

      <Footer accent={ACCENT}>
        This is <Hi accent={ACCENT}>machine learning</Hi> you can feel: you give labelled examples, the model turns each
        image into numbers (an <Hi accent={ACCENT}>embedding</Hi>) and remembers the average per class; new images get
        the closest label. Too few or too-similar examples → shaky, <Hi accent={ACCENT}>biased</Hi> predictions. That's
        why real datasets are huge and carefully balanced.
      </Footer>
    </div>
  );
}
