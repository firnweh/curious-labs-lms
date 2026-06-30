"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { loadFaceDetector } from "@/lib/ai/vision";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Peekaboo" (junior face detection, ages 4–7).
 *
 * The gentlest possible take on Face Finder: a big friendly emoji rides on top
 * of the face the AI finds and grows with it; a giant number shows how many
 * faces are seen. Two playful goals (show your face, hide → 0) — almost no text,
 * no jargon. Same on-device BlazeFace model, kindergarten skin.
 */

const ACCENT = "#f472b6";

export default function Peekaboo() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<FaceDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [armed, setArmed] = useState(false);
  const [sawFace, setSawFace] = useState(false);
  const [peekaboo, setPeekaboo] = useState(false);

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
    for (const d of res.detections) {
      const b = d.boundingBox;
      if (!b) continue;
      // big emoji sitting on the face, drawn un-mirrored (canvas is flipped in CSS)
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      const size = b.width * 1.2;
      ctx.font = `${size}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("😄", canvas.width - (b.originX + b.width / 2), b.originY + b.height / 2);
      ctx.restore();
    }
    const n = res.detections.length;
    setCount(n);
    if (n >= 1) { setArmed(true); setSawFace(true); }
    if (n === 0 && armed) setPeekaboo(true);
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef, armed]);

  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadFaceDetector()
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

  const won = sawFace && peekaboo;

  return (
    <div className="mx-auto w-full max-w-[560px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🫣" title="Peekaboo" grades="Ages 4–7" topic="Computer vision" accent={ACCENT} right={won ? "✓ you win!" : ""} />

      <Caption accent={ACCENT} active={won}>
        {won
          ? "🎉 Yay! The smiley jumps onto your face when the computer SEES you, and disappears when you hide. The computer is looking for faces!"
          : status === "on"
            ? loading
              ? "Getting ready…"
              : count > 0
                ? "I see you! 😄  Now HIDE your face…"
                : "Show me your face! 👋"
            : "Tap the button to play peekaboo with the computer!"}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} hint="A grown-up can help turn on the camera. It stays on your computer." />

      <div className="mt-3 grid place-items-center rounded-2xl border border-[#1e2738] bg-[#0f1420] py-4">
        <div className="font-mono text-5xl font-bold" style={{ color: ACCENT }}>{count}</div>
        <div className="font-mono text-[11px] text-[#9fb0d0]">{count === 1 ? "face found" : "faces found"}</div>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        <span className="rounded-xl border-2 px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: sawFace ? ACCENT : "#1e2738", background: sawFace ? `${ACCENT}1a` : "transparent", color: sawFace ? ACCENT : "#9fb0d0" }}>{sawFace ? "✓ " : "○ "}Show your face</span>
        <span className="rounded-xl border-2 px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: won ? ACCENT : "#1e2738", background: won ? `${ACCENT}1a` : "transparent", color: won ? ACCENT : "#9fb0d0" }}>{won ? "✓ " : "○ "}Now hide!</span>
      </div>

      <Footer accent={ACCENT}>
        The computer looks for the <Hi accent={ACCENT}>shape of a face</Hi> — two eyes, a nose, a mouth. When it
        finds one, our smiley hops on top. Cover your face and it can’t find one any more. That’s “face detection”!
      </Footer>
    </div>
  );
}
