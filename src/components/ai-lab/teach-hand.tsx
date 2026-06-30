"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { loadHandLandmarker, HAND_CONNECTIONS } from "@/lib/ai/vision";
import { landmarksToVector } from "@/lib/ai/knn";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";
import { PredictionBars, TrainerClasses, useTeachable, type TeachClass } from "./_teach";

/**
 * Neural Lab — "Gesture Trainer" (teachable hand-gesture classifier).
 *
 * Make up your own hand signs and teach them: the AI learns them from the 21
 * hand keypoints. PictoBlox's Hand-Pose-Classifier idea as an on-device KNN —
 * unlike the built-in Gesture Reader, here the classes are whatever the kid
 * invents.
 */

const ACCENT = "#22d3ee";
const CLASSES: TeachClass[] = [
  { id: "g1", label: "Sign 1" },
  { id: "g2", label: "Sign 2" },
  { id: "g3", label: "Sign 3" },
];

export default function GestureTrainer() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<HandLandmarker | null>(null);
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
      for (const [a, b] of HAND_CONNECTIONS) {
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
    loadHandLandmarker()
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
      <LabHeader emoji="🖐️" title="Gesture Trainer" grades="Grades 4–10" topic="Machine learning" accent={ACCENT} right={`${total} examples`} />

      <Caption accent={ACCENT} active={ready}>
        {status === "on"
          ? loading
            ? "Loading the hand model…"
            : ready
              ? "🖐️ It learned YOUR signs! Make each one — the bars show its confidence. Confused between two? Add more examples of the loser."
              : "Invent 2–3 hand signs. Hold one to the camera, tap its button ~8 times, then teach the next."
          : "Turn on the camera and teach the AI your very own hand signs."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} />

      <TrainerClasses classes={CLASSES} counts={counts} accent={ACCENT} onAdd={onAdd} onReset={reset} disabled={status !== "on" || loading} />
      <PredictionBars classes={CLASSES} pred={pred} accent={ACCENT} ready={ready} />

      <Footer accent={ACCENT}>
        Same recipe as the pose trainer, smaller canvas: turn 21 hand points into a <Hi accent={ACCENT}>shape vector</Hi>,
        store an average per sign, match live. This is exactly how custom sign-language and gesture-control models are
        bootstrapped — start with a handful of examples, add more where it slips.
      </Footer>
    </div>
  );
}
