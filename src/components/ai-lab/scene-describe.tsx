"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageClassifier } from "@mediapipe/tasks-vision";
import { loadImageClassifier } from "@/lib/ai/vision";
import { CameraStage, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Scene Describer" (snapshot → description).
 *
 * Take a still photo; the AI labels it and we compose a one-line description
 * ("This looks like a ___, and maybe a ___"). The teaching twist: naming a
 * specific celebrity, logo or landmark (what cloud vision APIs do) needs a huge
 * model that lives on a server — which is why those features run online, while
 * this on-device model only knows everyday categories.
 */

const ACCENT = "#22d3ee";

export default function SceneDescriber() {
  const { videoRef, status, error, start, stop } = useCamera();
  const photoRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<ImageClassifier | null>(null);
  const [loading, setLoading] = useState(false);
  const [shots, setShots] = useState(0);
  const [tags, setTags] = useState<{ name: string; score: number }[]>([]);
  const [hasPhoto, setHasPhoto] = useState(false);

  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadImageClassifier("IMAGE")
      .then((d) => {
        if (cancelled) return d.close();
        detRef.current = d;
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
      detRef.current?.close();
      detRef.current = null;
    };
  }, [status]);

  useEffect(() => () => stop(), [stop]);

  const capture = useCallback(() => {
    const video = videoRef.current, canvas = photoRef.current, det = detRef.current;
    if (!video || !canvas || !det || video.readyState < 2) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.scale(-1, 1); // un-mirror so the saved photo reads naturally
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    const res = det.classify(canvas);
    const cats = (res.classifications[0]?.categories ?? []).slice(0, 3);
    setTags(cats.map((c) => ({ name: c.categoryName || c.displayName || "?", score: c.score })));
    setHasPhoto(true);
    setShots((n) => n + 1);
  }, [videoRef]);

  const sentence = tags.length
    ? `This looks like ${tags[0].name} (${Math.round(tags[0].score * 100)}% sure)${tags[1] ? `, and maybe a ${tags[1].name}` : ""}.`
    : "";

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🖼️" title="Scene Describer" grades="Grades 4–8" topic="Computer vision" accent={ACCENT} right={`${shots} photos`} />

      <Caption accent={ACCENT} active={shots >= 3}>
        {shots >= 3
          ? "📸 Nice gallery! On-device AI named the everyday stuff. To recognise a SPECIFIC person, brand logo or famous landmark you'd need a giant model on a server — that's why those 'cloud vision' features need internet."
          : status === "on"
            ? loading
              ? "Loading the vision model…"
              : "Point at something and tap “Take photo” to get a description."
            : "Turn on the camera, snap a photo, and let the AI describe it."}
      </Caption>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CameraStage videoRef={videoRef} canvasRef={{ current: null }} status={status} error={error} accent={ACCENT} onStart={start} />
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#1e2738] bg-[#060912]">
          <canvas ref={photoRef} className="absolute inset-0 h-full w-full object-cover" />
          {!hasPhoto && <div className="absolute inset-0 grid place-items-center font-mono text-[10px] text-[#5b6b8c]">your photo appears here</div>}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={capture}
          disabled={status !== "on" || loading}
          className="rounded-xl border-2 px-4 py-2 font-mono text-xs font-semibold transition-colors disabled:opacity-40"
          style={{ borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` }}
        >
          📸 Take photo
        </button>
        {sentence && <p className="font-mono text-[11px]" style={{ color: ACCENT }}>{sentence}</p>}
      </div>

      {tags.length > 0 && (
        <>
          <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">TAGS</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, i) => (
              <span key={`${t.name}-${i}`} className="rounded-lg border border-[#1e2738] bg-[#0f1420] px-2 py-1 font-mono text-[10px]" style={{ color: ACCENT }}>
                {t.name} · {Math.round(t.score * 100)}%
              </span>
            ))}
          </div>
        </>
      )}

      <Footer accent={ACCENT}>
        “Describing” an image is just classification turned into words. Small models run <Hi accent={ACCENT}>on your
        device</Hi> and know everyday categories; recognising a named celebrity or landmark needs a huge model in the
        <Hi accent={ACCENT}> cloud</Hi>. That trade-off — privacy & speed vs power — is a real engineering choice.
      </Footer>
    </div>
  );
}
