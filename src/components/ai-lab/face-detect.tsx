"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { loadFaceDetector } from "@/lib/ai/vision";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Face Finder" (live face detection).
 *
 * Real on-device face detection: MediaPipe's BlazeFace finds face-shaped
 * patterns in the webcam feed and we draw a box + the six keypoints it locks
 * onto, with a live confidence read-out. Three little goals turn it into a
 * gradeable activity and quietly teach what detection is — and isn't (it finds
 * *a* face, it doesn't know *whose* face). All processing stays in the browser.
 */

const ACCENT = "#22d3ee";

interface Goal {
  id: string;
  label: string;
  done: (count: number) => boolean;
}
const GOALS: Goal[] = [
  { id: "one", label: "Show the AI 1 face", done: (c) => c === 1 },
  { id: "two", label: "Get 2 faces in frame", done: (c) => c >= 2 },
  { id: "zero", label: "Hide — make it see 0", done: (c) => c === 0 },
];

export default function FaceFinder() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [score, setScore] = useState(0);
  // A goal only counts once the camera has actually seen ≥1 face, so the
  // "0 faces" goal can't be satisfied before the experiment even starts.
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const draw = useCallback((count: number, best: number) => {
    setCount(count);
    setScore(best);
    if (count >= 1) setArmed(true);
    setDone((prev) => {
      let next = prev;
      for (const g of GOALS) {
        if (!prev[g.id] && (g.id !== "zero" || armed) && g.done(count)) {
          next = next === prev ? { ...prev } : next;
          next[g.id] = true;
        }
      }
      return next;
    });
  }, [armed]);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const det = detectorRef.current;
    if (!video || !canvas || !det || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    syncCanvas(canvas, video);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const res = det.detectForVideo(video, performance.now());
    let best = 0;
    for (const d of res.detections) {
      const b = d.boundingBox;
      if (!b) continue;
      const s = d.categories[0]?.score ?? 0;
      best = Math.max(best, s);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 4;
      ctx.strokeRect(b.originX, b.originY, b.width, b.height);
      // confidence tag
      ctx.font = "bold 22px ui-monospace, monospace";
      ctx.fillStyle = ACCENT;
      ctx.fillText(`${Math.round(s * 100)}%`, b.originX + 4, Math.max(22, b.originY - 8));
      // six keypoints BlazeFace locks onto (eyes, nose, mouth, ears)
      for (const k of d.keypoints ?? []) {
        ctx.beginPath();
        ctx.arc(k.x * canvas.width, k.y * canvas.height, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#e8eefc";
        ctx.fill();
      }
    }
    draw(res.detections.length, best);
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef, draw]);

  // Spin up the model + detection loop once the camera turns on.
  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadFaceDetector()
      .then((d) => {
        if (cancelled) return d.close();
        detectorRef.current = d;
        setLoading(false);
        rafRef.current = requestAnimationFrame(loop);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, [status, loop]);

  useEffect(() => () => stop(), [stop]);

  const doneCount = Object.values(done).filter(Boolean).length;
  const allDone = doneCount === GOALS.length;

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader
        emoji="🙂"
        title="Face Finder"
        grades="Grades 2–6"
        topic="Computer vision"
        accent={ACCENT}
        right={`${doneCount}/${GOALS.length} goals`}
      />

      <Caption accent={ACCENT} active={allDone}>
        {allDone
          ? "🎉 You drove a real face detector! Notice it drew a box around any face — yours, a friend's, even a photo — but never knew the name. Detecting a face and recognizing who it is are two different jobs."
          : status === "on"
            ? loading
              ? "Loading the face model… (first time downloads a few MB)"
              : count > 0
                ? `👀 Found ${count} face${count === 1 ? "" : "s"}. The box is where it thinks a face is; the dots are eyes, nose, mouth & ears.`
                : "Point the camera at a face. No face? It draws nothing."
            : "Turn on the camera to let a real AI hunt for faces — live, on your device."}
      </Caption>

      <CameraStage
        videoRef={videoRef}
        canvasRef={canvasRef}
        status={status}
        error={error}
        accent={ACCENT}
        onStart={start}
      />

      {/* Live read-out */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { k: "Faces", v: String(count) },
          { k: "Confidence", v: count ? `${Math.round(score * 100)}%` : "—" },
          { k: "Runs on", v: "your device" },
        ].map((s) => (
          <div key={s.k} className="rounded-xl border border-[#1e2738] bg-[#0f1420] px-3 py-2 text-center">
            <div className="font-mono text-lg font-semibold" style={{ color: ACCENT }}>{s.v}</div>
            <div className="font-mono text-[9px] tracking-wide text-[#5b6b8c]">{s.k}</div>
          </div>
        ))}
      </div>

      {/* Goal chips */}
      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">TRY THESE</p>
      <div className="flex flex-wrap gap-1.5">
        {GOALS.map((g) => {
          const ok = done[g.id];
          return (
            <span
              key={g.id}
              className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]"
              style={{
                borderColor: ok ? ACCENT : "#1e2738",
                background: ok ? `${ACCENT}1a` : "transparent",
                color: ok ? ACCENT : "#9fb0d0",
              }}
            >
              {ok ? "✓ " : "○ "}{g.label}
            </span>
          );
        })}
      </div>

      <Footer accent={ACCENT}>
        Face detection scans the picture for the <Hi accent={ACCENT}>pattern</Hi> of a face — two eyes,
        a nose, a mouth in the right places — and draws a box plus a few key points. It works on any
        face it has never seen, because it learned the <Hi accent={ACCENT}>shape</Hi> of faces, not
        people. Phones use it to focus the camera and place AR filters.
      </Footer>
    </div>
  );
}
