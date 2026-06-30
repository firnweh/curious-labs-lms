"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { loadHandLandmarker, HAND_CONNECTIONS } from "@/lib/ai/vision";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Hand Tracker" (live hand-landmark tracking + finger counting).
 *
 * MediaPipe's HandLandmarker returns 21 3-D points per hand; we draw the hand
 * skeleton and count raised fingers from the geometry. Goals (open hand, fist,
 * peace sign) teach that gesture reading is just measuring distances between
 * tracked dots.
 */

const ACCENT = "#22d3ee";
interface Pt { x: number; y: number }

// index/middle/ring/pinky: tip above its pip joint ⇒ finger is up.
const FINGERS: [number, number][] = [[8, 6], [12, 10], [16, 14], [20, 18]];

function countFingers(lm: Pt[]): number {
  let n = 0;
  for (const [tip, pip] of FINGERS) if (lm[tip].y < lm[pip].y) n++;
  // thumb: tip (4) extended sideways away from the palm vs its IP joint (3)
  const palmX = lm[17].x; // pinky MCP, the far side of the palm
  if (Math.abs(lm[4].x - palmX) > Math.abs(lm[3].x - palmX)) n++;
  return n;
}

interface Goal { id: string; label: string; n: number }
const GOALS: Goal[] = [
  { id: "five", label: "Open hand (5)", n: 5 },
  { id: "fist", label: "Make a fist (0)", n: 0 },
  { id: "peace", label: "Peace sign (2)", n: 2 },
];

export default function HandTracker() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fingers, setFingers] = useState<number | null>(null);
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
    const lm = res.landmarks[0] as Pt[] | undefined;
    if (lm) {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 4;
      for (const [a, b] of HAND_CONNECTIONS) {
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
      const n = countFingers(lm);
      setFingers(n);
      setDone((prev) => {
        let next = prev;
        for (const g of GOALS) {
          if (!prev[g.id] && g.n === n) {
            next = next === prev ? { ...prev } : next;
            next[g.id] = true;
          }
        }
        return next;
      });
    } else {
      setFingers(null);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

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

  const doneCount = Object.values(done).filter(Boolean).length;
  const allDone = doneCount === GOALS.length;

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="✋" title="Hand Tracker" grades="Grades 2–6" topic="Computer vision" accent={ACCENT} right={`${doneCount}/${GOALS.length} signs`} />

      <Caption accent={ACCENT} active={allDone}>
        {allDone
          ? "🖐️ You taught the computer to read your hand! It tracks 21 knuckle-and-tip dots, and counting raised fingers is just checking which tips sit above their joints. Sign-language and gesture controls start exactly here."
          : status === "on"
            ? loading
              ? "Loading the hand model…"
              : fingers === null
                ? "Hold one hand up to the camera, palm forward."
                : `Counting ${fingers} finger${fingers === 1 ? "" : "s"} up.`
            : "Turn on the camera and let the AI map the 21 points of your hand."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[#1e2738] bg-[#0f1420] px-3 py-2 text-center">
          <div className="font-mono text-2xl font-semibold" style={{ color: ACCENT }}>{fingers ?? "—"}</div>
          <div className="font-mono text-[9px] tracking-wide text-[#5b6b8c]">fingers up</div>
        </div>
        <div className="rounded-xl border border-[#1e2738] bg-[#0f1420] px-3 py-2 text-center">
          <div className="font-mono text-2xl font-semibold" style={{ color: ACCENT }}>21</div>
          <div className="font-mono text-[9px] tracking-wide text-[#5b6b8c]">points tracked</div>
        </div>
      </div>

      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">MAKE THESE SIGNS</p>
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
        Hand tracking finds <Hi accent={ACCENT}>21 landmarks</Hi> — each knuckle and fingertip — and joins
        them into a hand skeleton. Once you have the dots, a gesture is just a rule about distances and
        angles between them. This powers sign-language translation, VR hand controls and touch-free menus.
      </Footer>
    </div>
  );
}
