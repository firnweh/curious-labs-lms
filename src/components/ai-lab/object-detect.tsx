"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ObjectDetector } from "@mediapipe/tasks-vision";
import { loadObjectDetector } from "@/lib/ai/vision";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Object Spotter" (live object detection).
 *
 * MediaPipe's EfficientDet finds and *locates* everyday objects in the webcam
 * feed, drawing a labelled box + score around each. Framed as a scavenger hunt:
 * show the AI different things and fill a collection — teaching that detection
 * = "what" + "where", and that it only knows the ~80 classes it was trained on.
 */

const ACCENT = "#34d399";
const TARGET = 5;

export default function ObjectSpotter() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<ObjectDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState<{ name: string; score: number }[]>([]);
  const [seen, setSeen] = useState<string[]>([]);

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

    const res = det.detectForVideo(video, performance.now());
    const now: { name: string; score: number }[] = [];
    for (const d of res.detections) {
      const b = d.boundingBox;
      const cat = d.categories[0];
      if (!b || !cat) continue;
      now.push({ name: cat.categoryName, score: cat.score });
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 4;
      ctx.strokeRect(b.originX, b.originY, b.width, b.height);
      const label = `${cat.categoryName} ${Math.round(cat.score * 100)}%`;
      ctx.font = "bold 20px ui-monospace, monospace";
      const w = ctx.measureText(label).width;
      ctx.fillStyle = ACCENT;
      ctx.fillRect(b.originX, Math.max(0, b.originY - 26), w + 12, 26);
      ctx.fillStyle = "#06231a";
      ctx.fillText(label, b.originX + 6, Math.max(19, b.originY - 7));
    }
    setLive(now);
    if (now.length) {
      setSeen((prev) => {
        const set = new Set(prev);
        let changed = false;
        for (const o of now) if (o.score > 0.5 && !set.has(o.name)) { set.add(o.name); changed = true; }
        return changed ? [...set] : prev;
      });
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadObjectDetector()
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

  const hunted = seen.length;
  const allDone = hunted >= TARGET;

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader
        emoji="📦"
        title="Object Spotter"
        grades="Grades 3–7"
        topic="Computer vision"
        accent={ACCENT}
        right={`${hunted}/${TARGET} found`}
      />

      <Caption accent={ACCENT} active={allDone}>
        {allDone
          ? `🏆 Scavenger hunt complete — you found ${hunted} kinds of things! Detection answers TWO questions at once: WHAT it is (the label) and WHERE it is (the box). It can only name things it was trained on, though.`
          : status === "on"
            ? loading
              ? "Loading the object model…"
              : `🔎 Show the camera different objects — a cup, a book, a phone, a chair. ${hunted}/${TARGET} kinds collected.`
            : "Turn on the camera and go on an AI scavenger hunt — find 5 different objects."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} />

      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">SEEING RIGHT NOW</p>
      <div className="flex min-h-[28px] flex-wrap gap-1.5">
        {live.length === 0 && <span className="font-mono text-[10px] text-[#5b6b8c]">— nothing yet —</span>}
        {live.map((o, i) => (
          <span key={`${o.name}-${i}`} className="rounded-lg border border-[#1e2738] bg-[#0f1420] px-2 py-1 font-mono text-[10px]" style={{ color: ACCENT }}>
            {o.name} · {Math.round(o.score * 100)}%
          </span>
        ))}
      </div>

      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">COLLECTION</p>
      <div className="flex flex-wrap gap-1.5">
        {seen.length === 0 && <span className="font-mono text-[10px] text-[#5b6b8c]">empty — go find things!</span>}
        {seen.map((n) => (
          <span key={n} className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]" style={{ borderColor: ACCENT, background: `${ACCENT}1a`, color: ACCENT }}>
            ✓ {n}
          </span>
        ))}
      </div>

      <Footer accent={ACCENT}>
        Object detection slides over the image asking “is there something here, and what?”. For each hit it
        returns a <Hi accent={ACCENT}>box</Hi> (where) and a <Hi accent={ACCENT}>label</Hi> (what) with a
        confidence score. Self-checkouts, self-driving cars and photo apps all lean on it — but it can only
        spot the classes it practised on.
      </Footer>
    </div>
  );
}
