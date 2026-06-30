"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageEmbedder } from "@mediapipe/tasks-vision";
import { loadImageEmbedder } from "@/lib/ai/vision";
import { CameraStage, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";
import { PredictionBars, TrainerClasses, useTeachable, type TeachClass } from "./_teach";

/**
 * Neural Lab — "Train an Image Brain" (teachable image classification).
 *
 * The kid IS the trainer: show the camera an example, tap a class to save it.
 * Each frame is turned into an embedding (a list of numbers) by MobileNet; we
 * match new frames to the nearest class the kid taught. Live confidence bars
 * make "more examples → more confident" visible. The PictoBlox ML-Environment
 * idea, rebuilt as an on-device KNN over real embeddings.
 */

const ACCENT = "#34d399";
const CLASSES: TeachClass[] = [
  { id: "a", label: "Thing A" },
  { id: "b", label: "Thing B" },
  { id: "c", label: "Thing C" },
];

export default function TrainImageBrain() {
  const { videoRef, status, error, start, stop } = useCamera();
  const embRef = useRef<ImageEmbedder | null>(null);
  const rafRef = useRef<number | null>(null);
  const vecRef = useRef<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { addSample, classify, reset, counts, pred, ready } = useTeachable();

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

  const onAdd = (id: string) => { if (vecRef.current) addSample(id, vecRef.current); };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🧠" title="Train an Image Brain" grades="Grades 4–10" topic="Machine learning" accent={ACCENT} right={`${total} examples`} />

      <Caption accent={ACCENT} active={ready}>
        {status === "on"
          ? loading
            ? "Loading the embedding model…"
            : ready
              ? "🧠 It's predicting from what YOU taught! Add more examples (different angles, lighting) to the class it gets wrong and watch the bars improve."
              : "Pick 2–3 things (e.g. your face, your hand, an empty desk). Show one, tap its button ~8 times, repeat for the others."
          : "Turn on the camera and train your own image classifier — no coding, just examples."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={{ current: null }} status={status} error={error} accent={ACCENT} onStart={start} />

      <TrainerClasses classes={CLASSES} counts={counts} accent={ACCENT} onAdd={onAdd} onReset={reset} disabled={status !== "on" || loading} />
      <PredictionBars classes={CLASSES} pred={pred} accent={ACCENT} ready={ready} />

      <Footer accent={ACCENT}>
        This is <Hi accent={ACCENT}>machine learning</Hi> you can feel: you give labelled examples, the model turns each
        image into numbers (an <Hi accent={ACCENT}>embedding</Hi>) and remembers the average for each class. New images
        get the closest label. Too few or too-similar examples → shaky predictions. That's why real datasets are huge.
      </Footer>
    </div>
  );
}
