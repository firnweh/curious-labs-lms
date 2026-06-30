"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { loadFaceDetector } from "@/lib/ai/vision";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Face Finder" as a live AR FILTER BOOTH.
 *
 * MediaPipe's BlazeFace finds faces in the webcam and locks onto six keypoints
 * (eyes, nose, mouth, ears). We pin fun stickers to those points — sunglasses on
 * the eyes, a crown above, a puppy over the face — so the filter tracks your face
 * every frame, exactly like Snapchat/Instagram. A "Show the AI" toggle reveals the
 * detection box + keypoints underneath, teaching that an AR filter is just
 * detection + a sticker glued to the keypoints. All on-device; nothing uploaded.
 */

const ACCENT = "#22d3ee";

type Anchor = "eyes" | "aboveEyes" | "leftEye" | "rightEye" | "nose";
interface Sticker { emoji: string; anchor: Anchor; scale: number }
interface Filter { id: string; name: string; emoji: string; stickers: Sticker[] }

const FILTERS: Filter[] = [
  { id: "shades", name: "Cool", emoji: "🕶️", stickers: [{ emoji: "🕶️", anchor: "eyes", scale: 2.2 }] },
  { id: "crown", name: "Royal", emoji: "👑", stickers: [{ emoji: "👑", anchor: "aboveEyes", scale: 2.4 }] },
  { id: "hat", name: "Top Hat", emoji: "🎩", stickers: [{ emoji: "🎩", anchor: "aboveEyes", scale: 2.7 }] },
  { id: "love", name: "Heart Eyes", emoji: "😍", stickers: [{ emoji: "❤️", anchor: "leftEye", scale: 1.05 }, { emoji: "❤️", anchor: "rightEye", scale: 1.05 }] },
  { id: "stars", name: "Star Eyes", emoji: "🤩", stickers: [{ emoji: "⭐", anchor: "leftEye", scale: 0.95 }, { emoji: "⭐", anchor: "rightEye", scale: 0.95 }] },
  { id: "disguise", name: "Disguise", emoji: "🥸", stickers: [{ emoji: "🥸", anchor: "nose", scale: 3.1 }] },
  { id: "clown", name: "Clown Nose", emoji: "🤡", stickers: [{ emoji: "🔴", anchor: "nose", scale: 0.85 }] },
  { id: "dog", name: "Puppy", emoji: "🐶", stickers: [{ emoji: "🐶", anchor: "nose", scale: 3.3 }] },
  { id: "party", name: "Party", emoji: "🥳", stickers: [{ emoji: "🥳", anchor: "nose", scale: 3.1 }] },
];

interface Goal { id: string; label: string }
const GOALS: Goal[] = [
  { id: "wear", label: "Put a filter on your face" },
  { id: "three", label: "Try 3 different filters" },
  { id: "snap", label: "Take a snapshot" },
];

// Draw an emoji centred at (x,y). The whole canvas is CSS-mirrored, so we flip
// the glyph locally (scale -1) — after the mirror it reads the right way round.
function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-1, 1);
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
}

export default function FaceFinder() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const rafRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [filter, setFilter] = useState<Filter | null>(FILTERS[0]);
  const [showAI, setShowAI] = useState(false);
  const [used, setUsed] = useState<Set<string>>(new Set(FILTERS[0] ? [FILTERS[0].id] : []));
  const [photo, setPhoto] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  // Loop reads live values via refs so it never has to be re-created.
  const filterRef = useRef<Filter | null>(filter);
  const showAIRef = useRef(showAI);
  const countRef = useRef(0);
  useEffect(() => { filterRef.current = filter; }, [filter]);
  useEffect(() => { showAIRef.current = showAI; }, [showAI]);

  const pick = useCallback((f: Filter | null) => {
    setFilter(f);
    if (f) setUsed((s) => (s.has(f.id) ? s : new Set(s).add(f.id)));
  }, []);

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
    if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const res = det.detectForVideo(video, performance.now());
    const active = filterRef.current;

    for (const d of res.detections) {
      const kps = d.keypoints ?? [];
      if (kps.length >= 4) {
        const pt = (i: number) => ({ x: kps[i].x * W, y: kps[i].y * H });
        const eR = pt(0), eL = pt(1), nose = pt(2);
        const eyeMid = { x: (eR.x + eL.x) / 2, y: (eR.y + eL.y) / 2 };
        const eyeDist = Math.hypot(eR.x - eL.x, eR.y - eL.y) || W * 0.08;
        const at = (a: Anchor) =>
          a === "eyes" ? eyeMid
            : a === "aboveEyes" ? { x: eyeMid.x, y: eyeMid.y - eyeDist * 1.5 }
              : a === "leftEye" ? eL
                : a === "rightEye" ? eR
                  : nose;
        if (active) {
          for (const st of active.stickers) {
            const p = at(st.anchor);
            drawEmoji(ctx, st.emoji, p.x, p.y, Math.max(18, eyeDist * st.scale));
          }
        }
      }
      if (showAIRef.current) {
        const b = d.boundingBox;
        if (b) {
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 3;
          ctx.strokeRect(b.originX, b.originY, b.width, b.height);
        }
        for (const k of d.keypoints ?? []) {
          ctx.beginPath();
          ctx.arc(k.x * W, k.y * H, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#e8eefc";
          ctx.fill();
        }
      }
    }

    if (res.detections.length !== countRef.current) {
      countRef.current = res.detections.length;
      setCount(res.detections.length);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

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

  // Goals.
  useEffect(() => {
    setDone((prev) => {
      const next = { ...prev };
      if (filter && count >= 1) next.wear = true;
      if (used.size >= 3) next.three = true;
      if (photo) next.snap = true;
      return next;
    });
  }, [filter, count, used, photo]);

  const snap = useCallback(() => {
    const video = videoRef.current, overlay = canvasRef.current;
    if (!video || !overlay) return;
    const w = overlay.width, h = overlay.height;
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const c = off.getContext("2d");
    if (!c) return;
    c.save();
    c.translate(w, 0);
    c.scale(-1, 1); // mirror to match the on-screen (selfie) view
    c.drawImage(video, 0, 0, w, h);
    c.drawImage(overlay, 0, 0);
    c.restore();
    setPhoto(off.toDataURL("image/png"));
  }, [videoRef]);

  const doneCount = Object.values(done).filter(Boolean).length;
  const allDone = doneCount === GOALS.length;
  const live = status === "on";

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader
        emoji="🎭"
        title="Face Finder"
        grades="Grades 2–6"
        topic="Computer vision · AR filters"
        accent={ACCENT}
        right={`${doneCount}/${GOALS.length} goals`}
      />

      <Caption accent={ACCENT} active={allDone || count > 0}>
        {allDone
          ? "🎉 You ran a real AR filter booth! The AI never knew WHO you are — it just found a face-shaped pattern and you pinned stickers to its eyes & nose. That's exactly how Snapchat filters work."
          : !live
            ? "Turn on the camera, then pick a filter — a real AI will find your face and stick it on, live."
            : loading
              ? "Loading the face model… (first time downloads a few MB)"
              : count > 0
                ? `😎 Found ${count} face${count === 1 ? "" : "s"}! Move around — the ${filter ? filter.name + " filter" : "sticker"} follows the eyes & nose. Tap “Show the AI” to see how.`
                : "Point the camera at a face. No face → nothing to stick to."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} />

      {/* Filter picker */}
      <p className="mb-1.5 mt-3 font-mono text-[9px] tracking-wide text-[#5b6b8c]">PICK A FILTER</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => pick(null)}
          className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 px-2.5 py-1.5 transition-colors"
          style={{ borderColor: filter === null ? ACCENT : "#1e2738", background: filter === null ? `${ACCENT}1a` : "transparent" }}
        >
          <span style={{ fontSize: 20 }}>🚫</span>
          <span className="font-mono text-[8px] text-[#9fb0d0]">None</span>
        </button>
        {FILTERS.map((f) => {
          const on = filter?.id === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => pick(f)}
              className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 px-2.5 py-1.5 transition-colors"
              style={{ borderColor: on ? ACCENT : "#1e2738", background: on ? `${ACCENT}1a` : "transparent" }}
            >
              <span style={{ fontSize: 20 }}>{f.emoji}</span>
              <span className="font-mono text-[8px]" style={{ color: on ? ACCENT : "#9fb0d0" }}>{f.name}</span>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowAI((v) => !v)}
          className="rounded-xl border-2 px-3 py-2 font-mono text-[11px] font-semibold transition-colors"
          style={{ borderColor: showAI ? ACCENT : "#2a3550", color: showAI ? ACCENT : "#9fb0d0", background: showAI ? `${ACCENT}1a` : "transparent" }}
        >
          🔬 {showAI ? "Hiding the box" : "Show the AI"}
        </button>
        <button
          type="button"
          onClick={snap}
          disabled={!live}
          className="rounded-xl border-2 px-3 py-2 font-mono text-[11px] font-semibold transition-colors disabled:opacity-40"
          style={{ borderColor: "#2a3550", color: "#e8eefc" }}
        >
          📸 Snapshot
        </button>
        <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-[#9fb0d0]">
          <span>👤 <span style={{ color: ACCENT }}>{count}</span> face{count === 1 ? "" : "s"}</span>
          <span className="text-[#5b6b8c]">· on your device</span>
        </div>
      </div>

      {/* Snapshot */}
      {photo && (
        <div className="mt-3 rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wide text-[#5b6b8c]">YOUR SNAPSHOT</span>
            <div className="flex gap-2">
              <a
                href={photo}
                download="face-finder.png"
                className="rounded-lg border border-[#2a3550] px-2 py-1 font-mono text-[10px] text-[#9fb0d0] transition-colors hover:border-[#22d3ee] hover:text-[#22d3ee]"
              >
                ⬇ Save
              </a>
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="rounded-lg border border-[#2a3550] px-2 py-1 font-mono text-[10px] text-[#9fb0d0] transition-colors hover:border-[#fb7185] hover:text-[#fb7185]"
              >
                ↺ Retake
              </button>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Face Finder snapshot" className="w-full rounded-xl" />
        </div>
      )}

      {/* Goal chips */}
      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">TRY THESE</p>
      <div className="flex flex-wrap gap-1.5">
        {GOALS.map((g) => {
          const ok = done[g.id];
          return (
            <span
              key={g.id}
              className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]"
              style={{ borderColor: ok ? ACCENT : "#1e2738", background: ok ? `${ACCENT}1a` : "transparent", color: ok ? ACCENT : "#9fb0d0" }}
            >
              {ok ? "✓ " : "○ "}{g.label}
            </span>
          );
        })}
      </div>

      <Footer accent={ACCENT}>
        An AR filter is just face <Hi accent={ACCENT}>detection</Hi> + a sticker glued to the{" "}
        <Hi accent={ACCENT}>keypoints</Hi>. The AI finds your eyes, nose & mouth every frame; the app
        pins the glasses there. It works on <Hi accent={ACCENT}>any</Hi> face it has never seen, because
        it learned the <Hi accent={ACCENT}>shape</Hi> of faces — not who you are. Finding a face and
        knowing whose face it is are two different jobs.
      </Footer>
    </div>
  );
}
