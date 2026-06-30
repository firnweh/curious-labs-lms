"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageClassifier } from "@mediapipe/tasks-vision";
import { loadImageClassifier } from "@/lib/ai/vision";
import { CameraStage, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Image Labeler" (live whole-image classification).
 *
 * EfficientNet looks at the WHOLE frame and ranks its best guesses for what the
 * picture mostly shows, with confidences. Unlike Object Spotter it draws no
 * boxes — it answers "what is this a picture of?" not "what's where?". Goal:
 * collect 3 confident labels, teaching top-k guesses and confidence.
 */

const ACCENT = "#34d399";
const TARGET = 3;

export default function ImageLabeler() {
  const { videoRef, status, error, start, stop } = useCamera();
  const detRef = useRef<ImageClassifier | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [guesses, setGuesses] = useState<{ name: string; score: number }[]>([]);
  const [seen, setSeen] = useState<string[]>([]);

  const loop = useCallback(() => {
    const video = videoRef.current, det = detRef.current;
    if (!video || !det || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const res = det.classifyForVideo(video, performance.now());
    const cats = res.classifications[0]?.categories ?? [];
    const top = cats.slice(0, 3).map((c) => ({ name: c.categoryName || c.displayName || "?", score: c.score }));
    setGuesses(top);
    const best = top[0];
    if (best && best.score > 0.55) {
      setSeen((prev) => (prev.includes(best.name) ? prev : [...prev, best.name]));
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadImageClassifier()
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

  const allDone = seen.length >= TARGET;

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🏷️" title="Image Labeler" grades="Grades 3–7" topic="Computer vision" accent={ACCENT} right={`${seen.length}/${TARGET} labelled`} />

      <Caption accent={ACCENT} active={allDone}>
        {allDone
          ? "🎉 You filled the label board! Notice the AI always gives its TOP guesses with a confidence each — it never says 'I don't know', it just ranks what it knows. That ranked list is called top-k."
          : status === "on"
            ? loading
              ? "Loading the image model…"
              : "📷 Fill the whole frame with one thing — a face, a book, a plant — and watch its top guesses."
            : "Turn on the camera and the AI will guess what the picture shows."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={{ current: null }} status={status} error={error} accent={ACCENT} onStart={start} />

      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">TOP GUESSES</p>
      <div className="space-y-1.5">
        {guesses.length === 0 && <p className="font-mono text-[10px] text-[#5b6b8c]">— nothing yet —</p>}
        {guesses.map((g, i) => (
          <div key={`${g.name}-${i}`} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate font-mono text-[10px]" style={{ color: i === 0 ? ACCENT : "#9fb0d0" }}>{g.name}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#1e2738]">
              <div className="h-full rounded-full" style={{ width: `${Math.round(g.score * 100)}%`, background: ACCENT }} />
            </div>
            <span className="w-10 text-right font-mono text-[10px] text-[#5b6b8c]">{Math.round(g.score * 100)}%</span>
          </div>
        ))}
      </div>

      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">LABEL BOARD</p>
      <div className="flex flex-wrap gap-1.5">
        {seen.length === 0 && <span className="font-mono text-[10px] text-[#5b6b8c]">empty — show it 3 different things</span>}
        {seen.map((n) => (
          <span key={n} className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]" style={{ borderColor: ACCENT, background: `${ACCENT}1a`, color: ACCENT }}>✓ {n}</span>
        ))}
      </div>

      <Footer accent={ACCENT}>
        Image classification squashes the whole picture into one ranked list of <Hi accent={ACCENT}>labels</Hi> with
        confidences. It’s how photo apps auto-tag your gallery. Because it must pick from classes it learned, an
        unfamiliar thing still gets labelled as the closest match it knows — confidently wrong.
      </Footer>
    </div>
  );
}
