"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { loadPoseLandmarker, POSE_CONNECTIONS } from "@/lib/ai/vision";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Pose Tracker" as a "Copy Me" pose quest.
 *
 * MediaPipe's PoseLandmarker maps 33 body keypoints; we draw the live skeleton.
 * The AI calls out a target pose and the kid must match it to advance — all the
 * matching is just MATH on where the dots landed (is each wrist above its
 * shoulder? are the hands together?). Teaches that the AI tracks DOTS, not "you",
 * and a "what you learned" recap surfaces the lesson. On-device; nothing uploaded.
 */

const ACCENT = "#a855f7";
const NOSE = 0, L_SH = 11, R_SH = 12, L_WR = 15, R_WR = 16, L_HIP = 23, R_HIP = 24;

interface Pt { x: number; y: number }
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

interface Pose { id: string; emoji: string; name: string; hint: string; test: (l: Pt[]) => boolean }
const POSES: Pose[] = [
  { id: "hands", emoji: "🙌", name: "Hands up!", hint: "Raise both hands above your shoulders.", test: (l) => l[L_WR].y < l[L_SH].y && l[R_WR].y < l[R_SH].y },
  { id: "tpose", emoji: "🧍", name: "T-pose", hint: "Arms straight out to the sides.", test: (l) => Math.abs(l[L_WR].y - l[L_SH].y) < 0.13 && Math.abs(l[R_WR].y - l[R_SH].y) < 0.13 && dist(l[L_WR], l[R_WR]) > 0.5 },
  { id: "head", emoji: "🙆", name: "Touch your head", hint: "Put a hand up by your head.", test: (l) => dist(l[L_WR], l[NOSE]) < 0.14 || dist(l[R_WR], l[NOSE]) < 0.14 },
  { id: "one", emoji: "🤚", name: "Just ONE hand up", hint: "Raise only one hand.", test: (l) => (l[L_WR].y < l[L_SH].y) !== (l[R_WR].y < l[R_SH].y) },
  { id: "star", emoji: "⭐", name: "Star pose", hint: "Both hands up AND spread wide!", test: (l) => l[L_WR].y < l[L_SH].y && l[R_WR].y < l[R_SH].y && dist(l[L_WR], l[R_WR]) > 0.45 },
  { id: "clap", emoji: "👏", name: "Clap!", hint: "Bring both hands together in front.", test: (l) => dist(l[L_WR], l[R_WR]) < 0.13 && l[L_WR].y < l[L_HIP].y },
  { id: "hips", emoji: "🕺", name: "Hands on hips", hint: "Put both hands on your hips.", test: (l) => dist(l[L_WR], l[L_HIP]) < 0.18 && dist(l[R_WR], l[R_HIP]) < 0.18 },
  { id: "bighead", emoji: "🙆‍♀️", name: "Both hands on head", hint: "Both hands up by your head.", test: (l) => dist(l[L_WR], l[NOSE]) < 0.18 && dist(l[R_WR], l[NOSE]) < 0.18 },
];

export default function PoseTracker() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [idx, setIdx] = useState(0);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState(false);
  const [everTracked, setEverTracked] = useState(false);

  const idxRef = useRef(0);
  const cooldownRef = useRef(0);
  const trackRef = useRef(false);
  useEffect(() => { idxRef.current = idx; }, [idx]);

  const loop = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current, det = detRef.current;
    if (!video || !canvas || !det || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    syncCanvas(canvas, video);
    const ctx = canvas.getContext("2d");
    if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const res = det.detectForVideo(video, performance.now());
    const lm = res.landmarks[0] as Pt[] | undefined;
    if (!!lm !== trackRef.current) { trackRef.current = !!lm; setTracking(!!lm); }

    if (lm) {
      if (!everTracked) setEverTracked(true);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 4;
      for (const [a, b] of POSE_CONNECTIONS) {
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
      const now = performance.now();
      const i = idxRef.current;
      if (i < POSES.length && now > cooldownRef.current && POSES[i].test(lm)) {
        cooldownRef.current = now + 1000;
        const id = POSES[i].id;
        setMatched((s) => { const n = new Set(s); n.add(id); return n; });
        setIdx((v) => v + 1);
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef, everTracked]);

  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadPoseLandmarker()
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

  // brief "nice!" flash whenever a pose is cleared
  useEffect(() => {
    if (idx === 0) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 850);
    return () => clearTimeout(id);
  }, [idx]);

  const skip = () => setIdx((v) => Math.min(POSES.length, v + 1));
  const again = () => { setIdx(0); setMatched(new Set()); };

  const done = idx >= POSES.length;
  const cur = done ? null : POSES[idx];
  const score = matched.size;
  const live = status === "on";

  const LEARN = [
    { id: "skeleton", text: "The AI maps 33 KEYPOINTS on your body and joins them into a skeleton.", got: everTracked },
    { id: "math", text: "It isn't “seeing you” — your code does MATH on the dots (is each wrist above its shoulder?).", got: score >= 1 },
    { id: "game", text: "You copied poses by matching the dots — exactly how dance & fitness games score you.", got: score >= 4 },
    { id: "live", text: "It runs live, on your device, many times a second to keep up as you move.", got: done },
  ];
  const learned = LEARN.filter((l) => l.got).length;

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🤸" title="Pose Tracker" grades="Grades 3–8" topic="Computer vision · pose" accent={ACCENT} right={`${score}/${POSES.length} moves`} />

      <Caption accent={ACCENT} active={done || flash}>
        {!live
          ? "Turn on the camera and let the AI track your body as a moving skeleton — then play Copy Me."
          : loading
            ? "Loading the pose model… (first time downloads a few MB)"
            : !tracking
              ? "Step back so your whole upper body (and arms) fit in the frame."
              : done
                ? `🏆 You cleared ${score} of ${POSES.length} moves! The AI never saw “you” — it tracked 33 dots and your code checked where they landed.`
                : flash
                  ? "✓ Nice! Next pose…"
                  : "🦴 That's your skeleton! Copy the pose the AI calls out."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} hint="Step back a bit so your arms fit in the frame. Video stays on your device." />

      {/* Copy Me card */}
      <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: flash ? ACCENT : `${ACCENT}55`, background: flash ? `${ACCENT}1a` : "#0f1420" }}>
        {done ? (
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-sm" style={{ color: ACCENT }}>🎉 Quest complete — {score}/{POSES.length} matched!</span>
            <button type="button" onClick={again} className="rounded-xl border-2 px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: ACCENT, color: ACCENT }}>↺ Play again</button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span aria-hidden style={{ fontSize: 34 }}>{cur!.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[9px] tracking-wide text-[#5b6b8c]">COPY ME · {idx + 1} of {POSES.length}</div>
              <div className="font-mono text-sm font-semibold" style={{ color: ACCENT }}>{cur!.name}</div>
              <div className="font-mono text-[10px] text-[#9fb0d0]">{cur!.hint}</div>
            </div>
            <button type="button" onClick={skip} className="shrink-0 rounded-lg border border-[#2a3550] px-2.5 py-1.5 font-mono text-[10px] text-[#9fb0d0] transition-colors hover:border-[#a855f7] hover:text-[#a855f7]">skip ⤼</button>
          </div>
        )}
      </div>

      {/* Pose checklist */}
      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">THE MOVES</p>
      <div className="flex flex-wrap gap-1.5">
        {POSES.map((p, i) => {
          const ok = matched.has(p.id);
          const now = i === idx && !done;
          return (
            <span key={p.id} className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]" style={{ borderColor: ok ? ACCENT : now ? `${ACCENT}aa` : "#1e2738", background: ok ? `${ACCENT}1a` : "transparent", color: ok ? ACCENT : now ? "#e8eefc" : "#9fb0d0" }}>
              {ok ? "✓ " : now ? "▸ " : "○ "}{p.emoji} {p.name}
            </span>
          );
        })}
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
        Pose estimation places <Hi accent={ACCENT}>keypoints</Hi> on shoulders, elbows, wrists, hips, knees
        and ankles, then connects them into a skeleton. Your program reads the dot positions to know what
        your body is doing — the basis of motion games, sign-language tools and physiotherapy apps.
      </Footer>
    </div>
  );
}
