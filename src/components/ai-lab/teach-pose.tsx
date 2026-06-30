"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { loadPoseLandmarker, POSE_CONNECTIONS } from "@/lib/ai/vision";
import { landmarksToVector } from "@/lib/ai/knn";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";
import { PredictionBars, TrainerClasses, useTeachable, type TeachClass } from "./_teach";

/**
 * Neural Lab — "Pose Trainer" (teachable body-pose classifier).
 *
 * Strike a pose, label it; the AI learns to tell your poses apart from the 33
 * body keypoints (recentred so where you stand doesn't matter — only the shape
 * does). PictoBlox's Pose-Classifier idea as an on-device KNN.
 */

const ACCENT = "#a855f7";
const CLASSES: TeachClass[] = [
  { id: "p1", label: "Pose 1" },
  { id: "p2", label: "Pose 2" },
  { id: "p3", label: "Pose 3" },
];

export default function PoseTrainer() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const vecRef = useRef<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { addSample, classify, reset, counts, pred, ready } = useTeachable();

  const loop = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current, det = detRef.current;
    if (!video || !canvas || !det || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    syncCanvas(canvas, video);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width, H = canvas.height;
    const res = det.detectForVideo(video, performance.now());
    const lm = res.landmarks[0];
    if (lm) {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 4;
      for (const [a, b] of POSE_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * W, lm[a].y * H);
        ctx.lineTo(lm[b].x * W, lm[b].y * H);
        ctx.stroke();
      }
      for (const p of lm) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2); ctx.fillStyle = "#e8eefc"; ctx.fill(); }
      vecRef.current = landmarksToVector(lm);
      classify(vecRef.current);
    } else {
      vecRef.current = null;
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef, classify]);

  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadPoseLandmarker()
      .then((d) => {
        if (cancelled) return d.close();
        detRef.current = d;
        setLoading(false);
        rafRef.current = requestAnimationFrame(loop);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      detRef.current?.close();
      detRef.current = null;
    };
  }, [status, loop]);

  useEffect(() => () => stop(), [stop]);

  const onAdd = (id: string) => { if (vecRef.current) addSample(id, vecRef.current); };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🕺" title="Pose Trainer" grades="Grades 4–10" topic="Machine learning" accent={ACCENT} right={`${total} examples`} />

      <Caption accent={ACCENT} active={ready}>
        {status === "on"
          ? loading
            ? "Loading the pose model…"
            : ready
              ? "🕺 It can tell your poses apart! Strike each pose — the bars show how sure it is. Add more examples to fix any mix-ups."
              : "Invent 2–3 poses (e.g. arms-up, arms-out, hands-on-hips). Hold one, tap its button ~8 times, then the next."
          : "Turn on the camera and teach the AI to recognise your own poses."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} hint="Step back so your upper body fits. Video stays on your device." />

      <TrainerClasses classes={CLASSES} counts={counts} accent={ACCENT} onAdd={onAdd} onReset={reset} disabled={status !== "on" || loading} />
      <PredictionBars classes={CLASSES} pred={pred} accent={ACCENT} ready={ready} />

      <Footer accent={ACCENT}>
        The classifier never sees “you” — just the <Hi accent={ACCENT}>shape</Hi> of your 33 keypoints, recentred so
        standing left or right doesn't matter. That's how dance games score moves and fitness apps count reps: learn a
        few labelled poses, then match live.
      </Footer>
    </div>
  );
}
