"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageEmbedder } from "@mediapipe/tasks-vision";
import { loadImageEmbedder } from "@/lib/ai/vision";
import { CameraStage, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";
import { PredictionBars, TrainerClasses, useTeachable, type TeachClass } from "./_teach";

/**
 * Neural Lab — "Sorting Robot" (teachable object sorting).
 *
 * Train a vision model to sort objects into bins (recycle / trash / compost) by
 * example, then hold things up and watch it call the bin. Same embedding-KNN
 * engine as the image trainer, but framed as a real job — the PictoBlox
 * "Object Detection (ML)" idea, recast as a sorter you teach.
 */

const ACCENT = "#34d399";
const CLASSES: TeachClass[] = [
  { id: "recycle", label: "♻️ Recycle" },
  { id: "trash", label: "🗑️ Trash" },
  { id: "compost", label: "🌱 Compost" },
];

export default function SortingRobot() {
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
    if (v) { vecRef.current = Array.from(v); classify(vecRef.current); }
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
  const binLabel = pred && ready ? CLASSES.find((c) => c.id === pred.label)?.label : null;

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🦾" title="Sorting Robot" grades="Grades 4–10" topic="Machine learning" accent={ACCENT} right={`${total} examples`} />

      <Caption accent={ACCENT} active={ready}>
        {status === "on"
          ? loading
            ? "Loading the vision model…"
            : ready
              ? "🦾 Your sorter is running! Hold an item up — it calls a bin. Got one wrong? Add a few more examples of that item to its correct bin."
              : "Hold up some recyclable items (bottle, can) and tap ♻️ a few times; rubbish → 🗑️; food scraps → 🌱."
          : "Turn on the camera and train a robot to sort waste into the right bin."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={{ current: null }} status={status} error={error} accent={ACCENT} onStart={start} />

      {binLabel && (
        <div className="mt-3 grid place-items-center rounded-2xl border-2 py-3" style={{ borderColor: ACCENT, background: `${ACCENT}1a` }}>
          <div className="font-mono text-[9px] tracking-wide text-[#5b6b8c]">SORT INTO</div>
          <div className="font-mono text-2xl font-semibold" style={{ color: ACCENT }}>{binLabel}</div>
        </div>
      )}

      <TrainerClasses classes={CLASSES} counts={counts} accent={ACCENT} onAdd={onAdd} onReset={reset} disabled={status !== "on" || loading} />
      <PredictionBars classes={CLASSES} pred={pred} accent={ACCENT} ready={ready} />

      <Footer accent={ACCENT}>
        Real recycling plants use cameras + ML to sort waste at speed. You just built a tiny version: teach by example,
        and the model sorts new items into the <Hi accent={ACCENT}>class</Hi> they most resemble. Bias warning — if you
        only show clean bottles, dirty ones may fool it. Diverse examples matter.
      </Footer>
    </div>
  );
}
