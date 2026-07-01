"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageClassifier } from "@mediapipe/tasks-vision";
import { loadImageClassifier } from "@/lib/ai/vision";
import { CameraStage, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Image Labeler": show it ANYTHING and it guesses what it is.
 *
 * EfficientNet ranks its best guesses for what the whole frame mostly shows
 * (~1000 ImageNet classes), with confidences. Kids hold things up and watch the
 * top-3; they JUDGE the top guess (👍/👎 — the AI isn't always right), try to
 * STUMP it (make its top guess drop below 40% — it never says "I don't know"),
 * and learn that it only knows the classes it trained on → bridge to Teach the
 * Machine. All on-device.
 */

const ACCENT = "#34d399";

export default function ImageLabeler() {
  const { videoRef, status, error, start, stop } = useCamera();
  const detRef = useRef<ImageClassifier | null>(null);
  const rafRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [guesses, setGuesses] = useState<{ name: string; score: number }[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [everSaw, setEverSaw] = useState(false);
  const [everConfident, setEverConfident] = useState(false);
  const [stumped, setStumped] = useState(false);
  const [judgedWrong, setJudgedWrong] = useState(false);
  const [verdict, setVerdict] = useState<"right" | "wrong" | null>(null);
  const sawRef = useRef(false), confRef = useRef(false), stumpRef = useRef(false);

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
    if (best) {
      if (!sawRef.current) { sawRef.current = true; setEverSaw(true); }
      if (!confRef.current && best.score > 0.7) { confRef.current = true; setEverConfident(true); }
      if (!stumpRef.current && best.score < 0.4) { stumpRef.current = true; setStumped(true); }
      if (best.score > 0.55) setSeen((prev) => (prev.includes(best.name) ? prev : [...prev, best.name]));
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

  const judge = (v: "right" | "wrong") => {
    setVerdict(v);
    if (v === "wrong") setJudgedWrong(true);
  };

  const live = status === "on";
  const top = guesses[0];
  const topPct = top ? Math.round(top.score * 100) : 0;

  const LEARN = [
    { id: "topk", text: "It always gives its TOP guesses, ranked, each with a confidence % — that's “top-k”.", got: everSaw },
    { id: "many", text: "It knows ~1,000 things — far more than Object Spotter's ~80 — so it names lots of stuff.", got: everConfident },
    { id: "stump", text: "It NEVER says “I don't know” — even unsure it just guesses. You stumped it under 40%!", got: stumped },
    { id: "judge", text: "AI isn't always right — YOU caught it being confidently wrong. Always double-check it.", got: judgedWrong },
  ];
  const learned = LEARN.filter((l) => l.got).length;

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🏷️" title="Image Labeler" grades="Grades 3–7" topic="Computer vision · classification" accent={ACCENT} right={`${seen.length} labelled`} />

      <Caption accent={ACCENT} active={!!top}>
        {!live
          ? "Turn on the camera and the AI will guess what you show it — out of the ~1,000 things it knows."
          : loading
            ? "Loading the image model… (first time downloads a few MB)"
            : top
              ? `${top.score > 0.6 ? "🟢 Pretty sure" : "🟡 Just guessing"}: “${top.name}” (${topPct}%). Is it right? Judge it — or try to stump it!`
              : "Fill the frame with ONE thing — a face, a book, a plant, your shoe — and watch its guesses."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={{ current: null }} status={status} error={error} accent={ACCENT} onStart={start} />

      {/* Top guesses */}
      <p className="mb-1.5 mt-3 font-mono text-[9px] tracking-wide text-[#5b6b8c]">TOP GUESSES</p>
      <div className="space-y-1.5">
        {guesses.length === 0 && <p className="font-mono text-[10px] text-[#5b6b8c]">— nothing yet —</p>}
        {guesses.map((g, i) => (
          <div key={`${g.name}-${i}`} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate font-mono text-[10px]" style={{ color: i === 0 ? ACCENT : "#9fb0d0" }}>{g.name}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#1e2738]">
              <div className="h-full rounded-full" style={{ width: `${Math.round(g.score * 100)}%`, background: ACCENT, transition: "width .1s linear" }} />
            </div>
            <span className="w-10 text-right font-mono text-[10px] text-[#5b6b8c]">{Math.round(g.score * 100)}%</span>
          </div>
        ))}
      </div>

      {/* You be the judge */}
      {top && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#1e2738] bg-[#0f1420] px-3 py-2">
          <span className="font-mono text-[10px] text-[#9fb0d0]">🧑‍⚖️ Is “{top.name}” right?</span>
          <button type="button" onClick={() => judge("right")} className="rounded-lg border-2 px-2.5 py-1 font-mono text-[10px] transition-colors" style={{ borderColor: verdict === "right" ? ACCENT : "#2a3550", color: verdict === "right" ? ACCENT : "#9fb0d0" }}>👍 Right</button>
          <button type="button" onClick={() => judge("wrong")} className="rounded-lg border-2 px-2.5 py-1 font-mono text-[10px] transition-colors" style={{ borderColor: verdict === "wrong" ? "#fb7185" : "#2a3550", color: verdict === "wrong" ? "#fb7185" : "#9fb0d0" }}>👎 Wrong</button>
          {verdict && (
            <span className="font-mono text-[10px]" style={{ color: verdict === "right" ? ACCENT : "#fb7185" }}>
              {verdict === "right" ? "Nice — the AI nailed it!" : "Good catch! Even confident AI gets it wrong."}
            </span>
          )}
        </div>
      )}

      {/* Label board */}
      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">🏷️ LABEL BOARD · things it named</p>
      <div className="flex flex-wrap gap-1.5">
        {seen.length === 0 && <span className="font-mono text-[10px] text-[#5b6b8c]">empty — show it different things</span>}
        {seen.map((n) => (
          <span key={n} className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]" style={{ borderColor: ACCENT, background: `${ACCENT}1a`, color: ACCENT }}>✓ {n}</span>
        ))}
      </div>

      {/* Bridge to Teach the Machine */}
      <div className="mt-3 rounded-xl border border-[#2a3550] bg-[#0b1018] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#9fb0d0]">
        🎓 It doesn't know <Hi accent={ACCENT}>your</Hi> exact toy or pet? It only learned ~1,000 general things —
        head to <Hi accent={ACCENT}>Teach the Machine</Hi> and train it on your own!
      </div>

      {/* What you learned */}
      <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: learned ? `${ACCENT}55` : "#1e2738", background: "#0f1420" }}>
        <p className="mb-2 font-mono text-[10px] tracking-wide" style={{ color: ACCENT }}>🧠 WHAT YOU LEARNED · {learned}/{LEARN.length}</p>
        <div className="space-y-1.5">
          {LEARN.map((l) => (
            <div key={l.id} className="flex items-start gap-2 font-mono text-[11px] leading-relaxed transition-opacity duration-300" style={{ opacity: l.got ? 1 : 0.4 }}>
              <span className="shrink-0">{l.got ? "✅" : "🔒"}</span>
              <span style={{ color: l.got ? "#e8eefc" : "#9fb0d0" }}>{l.text}</span>
            </div>
          ))}
        </div>
      </div>

      <Footer accent={ACCENT}>
        Image classification squashes the whole picture into one ranked list of <Hi accent={ACCENT}>labels</Hi> with
        confidences — how photo apps auto-tag your gallery. Because it must pick from the classes it learned, an
        unfamiliar thing still gets the closest match it knows — often <Hi accent={ACCENT}>confidently wrong</Hi>.
      </Footer>
    </div>
  );
}
