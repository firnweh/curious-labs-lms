"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GestureRecognizer } from "@mediapipe/tasks-vision";
import { loadGestureRecognizer, HAND_CONNECTIONS } from "@/lib/ai/vision";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Gesture Reader" (live hand-gesture recognition).
 *
 * On top of hand landmarks, MediaPipe's GestureRecognizer names a gesture from
 * a small trained set. The lab is a "do every gesture" checklist, showing the
 * winning label + score live, and teaching that a gesture classifier just maps
 * hand shapes to a fixed list of names with confidences.
 */

const ACCENT = "#eab308";
interface Pt { x: number; y: number }

interface Goal { id: string; emoji: string; label: string }
const GOALS: Goal[] = [
  { id: "Thumb_Up", emoji: "👍", label: "Thumbs up" },
  { id: "Victory", emoji: "✌️", label: "Victory" },
  { id: "Open_Palm", emoji: "✋", label: "Open palm" },
  { id: "Pointing_Up", emoji: "☝️", label: "Point up" },
  { id: "Closed_Fist", emoji: "✊", label: "Fist" },
];
const PRETTY: Record<string, string> = { ILoveYou: "I love you", Thumb_Down: "Thumbs down" };
const pretty = (s: string) => PRETTY[s] ?? s.replace(/_/g, " ");

export default function GestureReader() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<GestureRecognizer | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState<{ name: string; score: number } | null>(null);
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

    const res = det.recognizeForVideo(video, performance.now());
    const lm = res.landmarks?.[0] as Pt[] | undefined;
    if (lm) {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 4;
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * W, lm[a].y * H);
        ctx.lineTo(lm[b].x * W, lm[b].y * H);
        ctx.stroke();
      }
    }
    const g = res.gestures?.[0]?.[0];
    if (g && g.categoryName !== "None") {
      setLive({ name: g.categoryName, score: g.score });
      if (g.score > 0.6) {
        setDone((prev) => (prev[g.categoryName] ? prev : { ...prev, [g.categoryName]: true }));
      }
    } else {
      setLive(null);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadGestureRecognizer()
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

  const doneCount = GOALS.filter((g) => done[g.id]).length;
  const allDone = doneCount === GOALS.length;

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🤙" title="Gesture Reader" grades="Grades 3–7" topic="Computer vision" accent={ACCENT} right={`${doneCount}/${GOALS.length} gestures`} />

      <Caption accent={ACCENT} active={allDone}>
        {allDone
          ? "🎯 You performed the whole gesture set! The AI watched your hand dots and matched the shape to the closest name on its list — with a confidence score. That's exactly how touch-free controls and sign shortcuts work."
          : status === "on"
            ? loading
              ? "Loading the gesture model…"
              : live
                ? `Reading: ${pretty(live.name)} (${Math.round(live.score * 100)}%)`
                : "Hold a hand up and try the gestures below."
            : "Turn on the camera and the AI will name your hand gestures in real time."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} />

      <div className="mt-3 rounded-xl border border-[#1e2738] bg-[#0f1420] px-3 py-3 text-center">
        <div className="font-mono text-xl font-semibold" style={{ color: ACCENT }}>
          {live ? pretty(live.name) : "—"}
        </div>
        <div className="font-mono text-[9px] tracking-wide text-[#5b6b8c]">
          {live ? `${Math.round(live.score * 100)}% sure` : "no gesture detected"}
        </div>
      </div>

      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">PERFORM EACH ONE</p>
      <div className="flex flex-wrap gap-1.5">
        {GOALS.map((g) => {
          const ok = done[g.id];
          return (
            <span key={g.id} className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]" style={{ borderColor: ok ? ACCENT : "#1e2738", background: ok ? `${ACCENT}1a` : "transparent", color: ok ? ACCENT : "#9fb0d0" }}>
              {ok ? "✓ " : `${g.emoji} `}{g.label}
            </span>
          );
        })}
      </div>

      <Footer accent={ACCENT}>
        A gesture recognizer takes the <Hi accent={ACCENT}>hand landmarks</Hi> and runs a tiny classifier
        that picks the best-matching gesture from a fixed list, each with a confidence. Show it a shape it
        was never taught and it says “None” — a model only knows the classes it practised.
      </Footer>
    </div>
  );
}
