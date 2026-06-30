"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { loadPoseLandmarker, POSE_CONNECTIONS } from "@/lib/ai/vision";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Pose Tracker" (live body-pose estimation).
 *
 * MediaPipe's PoseLandmarker maps 33 body keypoints from the webcam and we draw
 * a live skeleton. Three move-your-body goals (hands up, T-pose, touch head)
 * read those keypoint coordinates to teach that the AI doesn't "see a person" —
 * it tracks a set of dots and we do the geometry.
 */

const ACCENT = "#a855f7";
const NOSE = 0, L_SH = 11, R_SH = 12, L_WR = 15, R_WR = 16;

interface Pt { x: number; y: number }
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

interface Goal { id: string; label: string; test: (lm: Pt[]) => boolean }
const GOALS: Goal[] = [
  { id: "hands", label: "Raise both hands", test: (l) => l[L_WR].y < l[L_SH].y && l[R_WR].y < l[R_SH].y },
  {
    id: "tpose",
    label: "Make a T-pose",
    test: (l) =>
      Math.abs(l[L_WR].y - l[L_SH].y) < 0.12 && Math.abs(l[R_WR].y - l[R_SH].y) < 0.12 &&
      dist(l[L_WR], l[R_WR]) > 0.55,
  },
  { id: "head", label: "Touch your head", test: (l) => dist(l[L_WR], l[NOSE]) < 0.12 || dist(l[R_WR], l[NOSE]) < 0.12 },
];

export default function PoseTracker() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

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
    setTracking(!!lm);
    if (lm) {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 4;
      for (const [a, b] of POSE_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * W, lm[a].y * H);
        ctx.lineTo(lm[b].x * W, lm[b].y * H);
        ctx.stroke();
      }
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#e8eefc";
        ctx.fill();
      }
      setDone((prev) => {
        let next = prev;
        for (const g of GOALS) {
          if (!prev[g.id] && g.test(lm as Pt[])) {
            next = next === prev ? { ...prev } : next;
            next[g.id] = true;
          }
        }
        return next;
      });
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

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

  const doneCount = Object.values(done).filter(Boolean).length;
  const allDone = doneCount === GOALS.length;

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🤸" title="Pose Tracker" grades="Grades 3–8" topic="Computer vision" accent={ACCENT} right={`${doneCount}/${GOALS.length} moves`} />

      <Caption accent={ACCENT} active={allDone}>
        {allDone
          ? "💪 Nailed every move! The AI never saw 'you' — it tracked 33 dots on your body. Hands-up, T-pose and head-touch were just maths on where those dots landed. That's how dance games and fitness apps work."
          : status === "on"
            ? loading
              ? "Loading the pose model…"
              : tracking
                ? "🦴 That's your skeleton! Strike each pose to tick it off."
                : "Step back so your upper body is in frame."
            : "Turn on the camera and let the AI track your body as a moving skeleton."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} hint="Step back a bit so your arms fit in the frame. Video stays on your device." />

      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">STRIKE A POSE</p>
      <div className="flex flex-wrap gap-1.5">
        {GOALS.map((g) => {
          const ok = done[g.id];
          return (
            <span key={g.id} className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]" style={{ borderColor: ok ? ACCENT : "#1e2738", background: ok ? `${ACCENT}1a` : "transparent", color: ok ? ACCENT : "#9fb0d0" }}>
              {ok ? "✓ " : "○ "}{g.label}
            </span>
          );
        })}
      </div>

      <Footer accent={ACCENT}>
        Pose estimation places <Hi accent={ACCENT}>keypoints</Hi> on shoulders, elbows, wrists, hips, knees
        and ankles, then connects them into a skeleton. Your program reads the dot positions to know what
        your body is doing — the basis of motion games, sign-language tools and physiotherapy apps.
      </Footer>
    </div>
  );
}
