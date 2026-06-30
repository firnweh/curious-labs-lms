"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { loadFaceLandmarker } from "@/lib/ai/vision";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Face Mesh" (live face landmarks + expression reading).
 *
 * MediaPipe's FaceLandmarker pins a 478-point mesh to your face and outputs
 * "blendshape" scores (how smiley, how open the mouth, etc.). We turn those
 * into an expression read-out + make-this-face goals. Deliberately teaches
 * expressions (a real signal) rather than guessing age/gender — a good moment
 * to mention what AI should and shouldn't try to read from a face.
 */

const ACCENT = "#22d3ee";

const score = (cats: { categoryName: string; score: number }[], name: string) =>
  cats.find((c) => c.categoryName === name)?.score ?? 0;

interface Goal { id: string; label: string; test: (b: { categoryName: string; score: number }[]) => boolean }
const GOALS: Goal[] = [
  { id: "smile", label: "😀 Big smile", test: (b) => (score(b, "mouthSmileLeft") + score(b, "mouthSmileRight")) / 2 > 0.4 },
  { id: "open", label: "😮 Open mouth", test: (b) => score(b, "jawOpen") > 0.4 },
  { id: "brows", label: "🤨 Raise eyebrows", test: (b) => score(b, "browInnerUp") > 0.4 },
  { id: "wink", label: "😉 Wink one eye", test: (b) => Math.abs(score(b, "eyeBlinkLeft") - score(b, "eyeBlinkRight")) > 0.5 },
];

export default function FaceMesh() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState("—");
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
    const mesh = res.faceLandmarks?.[0];
    if (mesh) {
      ctx.fillStyle = `${ACCENT}cc`;
      for (const p of mesh) {
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const blends = res.faceBlendshapes?.[0]?.categories ?? [];
    if (blends.length) {
      const smile = (score(blends, "mouthSmileLeft") + score(blends, "mouthSmileRight")) / 2;
      const open = score(blends, "jawOpen");
      setMood(smile > 0.4 ? "smiling 😀" : open > 0.4 ? "surprised 😮" : "neutral 😐");
      setDone((prev) => {
        let next = prev;
        for (const g of GOALS) {
          if (!prev[g.id] && g.test(blends)) {
            next = next === prev ? { ...prev } : next;
            next[g.id] = true;
          }
        }
        return next;
      });
    } else {
      setMood("—");
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadFaceLandmarker()
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
      <LabHeader emoji="🕸️" title="Face Mesh" grades="Grades 4–9" topic="Computer vision" accent={ACCENT} right={`${doneCount}/${GOALS.length} faces`} />

      <Caption accent={ACCENT} active={allDone}>
        {allDone
          ? "✨ You drove all four expressions! The AI fits a 478-point mesh to your face and measures how 'smiley' or 'open' it is — these are real, useful signals. Notice it reads expressions, not who you are or your age — faces are sensitive, so good AI is careful about what it claims to know."
          : status === "on"
            ? loading
              ? "Loading the face-mesh model…"
              : `Reading expression: ${mood}`
            : "Turn on the camera to wrap a live mesh around your face and read your expression."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} />

      <div className="mt-3 rounded-xl border border-[#1e2738] bg-[#0f1420] px-3 py-3 text-center">
        <div className="font-mono text-xl font-semibold" style={{ color: ACCENT }}>{mood}</div>
        <div className="font-mono text-[9px] tracking-wide text-[#5b6b8c]">478 mesh points · expression read on-device</div>
      </div>

      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">MAKE THESE FACES</p>
      <div className="flex flex-wrap gap-1.5">
        {GOALS.map((g) => {
          const ok = done[g.id];
          return (
            <span key={g.id} className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]" style={{ borderColor: ok ? ACCENT : "#1e2738", background: ok ? `${ACCENT}1a` : "transparent", color: ok ? ACCENT : "#9fb0d0" }}>
              {ok ? "✓ " : ""}{g.label}
            </span>
          );
        })}
      </div>

      <Footer accent={ACCENT}>
        A face mesh tracks hundreds of <Hi accent={ACCENT}>landmark points</Hi> and turns them into
        “blendshape” scores — how open the mouth is, how raised the brows are. Apps use this for AR masks,
        avatars and accessibility. Reading an <Hi accent={ACCENT}>expression</Hi> is fair game; guessing age,
        gender or mood-as-truth from a face is unreliable and best avoided.
      </Footer>
    </div>
  );
}
