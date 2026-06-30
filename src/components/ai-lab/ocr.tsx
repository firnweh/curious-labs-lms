"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraStage, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Text Reader" (OCR).
 *
 * Snap a photo of printed text and Tesseract.js turns the pixels back into
 * characters — Optical Character Recognition. Loads the OCR engine + English
 * data on first use, then runs fully in the browser. Teaches that the AI sees
 * shapes of letters, not "words", and that messy / blurry text trips it up.
 */

const ACCENT = "#eab308";

export default function TextReader() {
  const { videoRef, status, error, start, stop } = useCamera();
  const photoRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState<string | null>(null);
  const [reads, setReads] = useState(0);

  useEffect(() => () => stop(), [stop]);

  const read = useCallback(async () => {
    const video = videoRef.current, canvas = photoRef.current;
    if (!video || !canvas || video.readyState < 2 || busy) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    setBusy(true);
    setProgress(0);
    setText(null);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(canvas, "eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const clean = data.text.trim();
      setText(clean || "(no readable text found)");
      if (clean) setReads((n) => n + 1);
    } catch {
      setText("Couldn't read this one — try clearer, bigger text.");
    } finally {
      setBusy(false);
    }
  }, [videoRef, busy]);

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🔠" title="Text Reader" grades="Grades 4–9" topic="Computer vision" accent={ACCENT} right={`${reads} read`} />

      <Caption accent={ACCENT} active={!!text && reads > 0}>
        {busy
          ? `Reading the letters… ${progress}%`
          : text
            ? "📖 The AI turned a picture of text back into characters you can copy. It recognises the SHAPE of each letter — so neat, big, well-lit print works best; wonky handwriting is much harder."
            : status === "on"
              ? "Hold some printed text steady (a book, a label) and tap “Read text”."
              : "Turn on the camera, point it at printed words, and the AI will read them out as text."}
      </Caption>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CameraStage videoRef={videoRef} canvasRef={{ current: null }} status={status} error={error} accent={ACCENT} onStart={start} />
        <div className="flex flex-col rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
          <div className="font-mono text-[9px] tracking-wide text-[#5b6b8c]">EXTRACTED TEXT</div>
          <div className="mt-1 max-h-[180px] flex-1 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px]" style={{ color: text ? "#e8eefc" : "#5b6b8c" }}>
            {text ?? "— nothing read yet —"}
          </div>
          <canvas ref={photoRef} className="hidden" />
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={read}
          disabled={status !== "on" || busy}
          className="rounded-xl border-2 px-4 py-2 font-mono text-xs font-semibold transition-colors disabled:opacity-40"
          style={{ borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` }}
        >
          {busy ? `Reading… ${progress}%` : "🔠 Read text"}
        </button>
      </div>

      <Footer accent={ACCENT}>
        <Hi accent={ACCENT}>OCR</Hi> (optical character recognition) matches the shapes in an image to letters, then
        groups them into words. It digitises books, reads number plates and scans receipts. Because it works from
        shapes, clear printed text is easy and messy handwriting is hard — exactly where it makes mistakes.
      </Footer>
    </div>
  );
}
