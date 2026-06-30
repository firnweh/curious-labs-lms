"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { loadFaceLandmarker } from "@/lib/ai/vision";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Face Mesh" as an interactive face-rig + expression reader.
 *
 * MediaPipe's FaceLandmarker pins a 478-point MESH to your face and outputs
 * "blendshape" scores (how smiley, how open the mouth is, etc.). We draw the real
 * wireframe mesh (toggle dots/off), show the blendshapes as LIVE bars so kids
 * watch the AI turn a face into numbers, drive an expression quest, and unlock a
 * "what you learned" recap — including the key idea that reading an EXPRESSION is
 * fair game, but guessing who you are / your age from a face is not. All on-device.
 */

const ACCENT = "#22d3ee";
type Cat = { categoryName: string; score: number };
const score = (cats: Cat[], name: string) => cats.find((c) => c.categoryName === name)?.score ?? 0;

const METERS: { id: string; label: string; emoji: string; get: (b: Cat[]) => number }[] = [
  { id: "smile", label: "Smile", emoji: "😀", get: (b) => (score(b, "mouthSmileLeft") + score(b, "mouthSmileRight")) / 2 },
  { id: "jaw", label: "Mouth open", emoji: "😮", get: (b) => score(b, "jawOpen") },
  { id: "brows", label: "Brows up", emoji: "🤨", get: (b) => score(b, "browInnerUp") },
  { id: "eyeL", label: "Left eye", emoji: "😉", get: (b) => score(b, "eyeBlinkLeft") },
  { id: "eyeR", label: "Right eye", emoji: "😜", get: (b) => score(b, "eyeBlinkRight") },
];

interface Goal { id: string; label: string; test: (b: Cat[]) => boolean }
const GOALS: Goal[] = [
  { id: "smile", label: "😀 Big smile", test: (b) => (score(b, "mouthSmileLeft") + score(b, "mouthSmileRight")) / 2 > 0.4 },
  { id: "open", label: "😮 Open wide", test: (b) => score(b, "jawOpen") > 0.5 },
  { id: "brows", label: "🤨 Raise eyebrows", test: (b) => score(b, "browInnerUp") > 0.4 },
  { id: "wink", label: "😉 Wink one eye", test: (b) => Math.abs(score(b, "eyeBlinkLeft") - score(b, "eyeBlinkRight")) > 0.5 },
  { id: "kiss", label: "😗 Kissy face", test: (b) => score(b, "mouthPucker") > 0.4 },
  { id: "wide", label: "😲 Wide eyes", test: (b) => (score(b, "eyeWideLeft") + score(b, "eyeWideRight")) / 2 > 0.35 },
  { id: "angry", label: "😠 Angry brows", test: (b) => (score(b, "browDownLeft") + score(b, "browDownRight")) / 2 > 0.4 },
  { id: "puff", label: "🐡 Puff cheeks", test: (b) => score(b, "cheekPuff") > 0.3 },
  { id: "frown", label: "🙁 Big frown", test: (b) => (score(b, "mouthFrownLeft") + score(b, "mouthFrownRight")) / 2 > 0.3 },
  { id: "sneer", label: "😤 Scrunch nose", test: (b) => (score(b, "noseSneerLeft") + score(b, "noseSneerRight")) / 2 > 0.3 },
  { id: "smirk", label: "😏 Smirk", test: (b) => Math.abs(score(b, "mouthSmileLeft") - score(b, "mouthSmileRight")) > 0.35 },
  { id: "squint", label: "😆 Squint eyes", test: (b) => (score(b, "eyeSquintLeft") + score(b, "eyeSquintRight")) / 2 > 0.4 },
  { id: "onebrow", label: "🤨 Raise ONE brow", test: (b) => Math.abs(score(b, "browOuterUpLeft") - score(b, "browOuterUpRight")) > 0.3 },
  { id: "ooo", label: "😙 Make an “ooo”", test: (b) => score(b, "mouthFunnel") > 0.4 },
];

type Conn = { start: number; end: number };
type Pt = { x: number; y: number };
type View = "mesh" | "dots" | "off";

const TESS = FaceLandmarker.FACE_LANDMARKS_TESSELATION as Conn[];
const CONTOURS: Conn[][] = [
  FaceLandmarker.FACE_LANDMARKS_FACE_OVAL as Conn[],
  FaceLandmarker.FACE_LANDMARKS_LIPS as Conn[],
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYE as Conn[],
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE as Conn[],
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW as Conn[],
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW as Conn[],
];

function strokeConns(ctx: CanvasRenderingContext2D, mesh: Pt[], conns: Conn[], W: number, H: number) {
  ctx.beginPath();
  for (const c of conns) {
    const a = mesh[c.start], b = mesh[c.end];
    if (!a || !b) continue;
    ctx.moveTo(a.x * W, a.y * H);
    ctx.lineTo(b.x * W, b.y * H);
  }
  ctx.stroke();
}

const ZERO: Record<string, number> = { smile: 0, jaw: 0, brows: 0, eyeL: 0, eyeR: 0 };

export default function FaceMesh() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("mesh");
  const [meters, setMeters] = useState<Record<string, number>>(ZERO);
  const [present, setPresent] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [everSaw, setEverSaw] = useState(false);
  const [everMoved, setEverMoved] = useState(false);

  const viewRef = useRef<View>(view);
  const liveRef = useRef<Record<string, number>>(ZERO);
  const presentRef = useRef(false);
  const sawRef = useRef(false);
  const movedRef = useRef(false);
  useEffect(() => { viewRef.current = view; }, [view]);

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
    const mesh = res.faceLandmarks?.[0] as Pt[] | undefined;

    if (mesh) {
      const v = viewRef.current;
      if (v === "mesh") {
        ctx.strokeStyle = `${ACCENT}40`;
        ctx.lineWidth = 0.6;
        strokeConns(ctx, mesh, TESS, W, H);
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.8;
        for (const c of CONTOURS) strokeConns(ctx, mesh, c, W, H);
      } else if (v === "dots") {
        ctx.fillStyle = `${ACCENT}cc`;
        for (const p of mesh) {
          ctx.beginPath();
          ctx.arc(p.x * W, p.y * H, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!sawRef.current) { sawRef.current = true; setEverSaw(true); }
    }

    const blends = (res.faceBlendshapes?.[0]?.categories ?? []) as Cat[];
    if (blends.length) {
      const vals: Record<string, number> = {};
      for (const m of METERS) vals[m.id] = m.get(blends);
      liveRef.current = vals;
      if (!presentRef.current) { presentRef.current = true; setPresent(true); }
      const moved = vals.smile > 0.4 || vals.jaw > 0.4 || vals.brows > 0.4 || vals.eyeL > 0.6 || vals.eyeR > 0.6;
      if (moved && !movedRef.current) { movedRef.current = true; setEverMoved(true); }
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
    } else if (presentRef.current) {
      presentRef.current = false;
      setPresent(false);
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

  // Push live meter values to state ~11×/s for smooth bars (decoupled from 60fps detection).
  useEffect(() => {
    if (status !== "on") return;
    const id = setInterval(() => setMeters({ ...liveRef.current }), 90);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => () => stop(), [stop]);

  const doneCount = Object.values(done).filter(Boolean).length;
  const allDone = doneCount === GOALS.length;
  const live = status === "on";
  const mood = present
    ? meters.smile > 0.4 ? "smiling 😀" : meters.jaw > 0.4 ? "surprised 😮" : meters.brows > 0.4 ? "curious 🤨" : "neutral 😐"
    : "—";

  const LEARN = [
    { id: "mesh", text: "The AI pins a 478-point MESH to your face — that's the wireframe you see.", got: everSaw },
    { id: "nums", text: "It turns your face into NUMBERS (“blendshapes”) — like “smile 80%”, “mouth 40%”.", got: everMoved },
    { id: "quest", text: "You hit every expression target — by moving real face muscles, not typing.", got: allDone },
    { id: "ethics", text: "It reads your EXPRESSION, not WHO you are or your age — and stays on your device.", got: everMoved },
  ];
  const learned = LEARN.filter((l) => l.got).length;

  const VIEWS: { id: View; label: string; emoji: string }[] = [
    { id: "mesh", label: "Mesh", emoji: "🕸️" },
    { id: "dots", label: "Dots", emoji: "•" },
    { id: "off", label: "Off", emoji: "🚫" },
  ];

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🕸️" title="Face Mesh" grades="Grades 4–9" topic="Computer vision · face landmarks" accent={ACCENT} right={`${doneCount}/${GOALS.length} faces`} />

      <Caption accent={ACCENT} active={allDone || present}>
        {allDone
          ? "✨ You drove a 478-point face rig! The AI measured your expression as numbers — but never your identity or age. Faces are sensitive, so good AI only claims what it can actually read."
          : !live
            ? "Turn on the camera to wrap a live 478-point mesh around your face and watch it read your expression."
            : loading
              ? "Loading the face-mesh model… (first time downloads a few MB)"
              : present
                ? `Reading expression: ${mood} — pull faces and watch the bars move!`
                : "Show your face to the camera to fit the mesh."}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} />

      {/* Mesh view toggle */}
      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-[9px] tracking-wide text-[#5b6b8c]">SHOW</span>
        {VIEWS.map((vw) => {
          const on = view === vw.id;
          return (
            <button
              key={vw.id}
              type="button"
              onClick={() => setView(vw.id)}
              className="rounded-xl border-2 px-3 py-1.5 font-mono text-[11px] transition-colors"
              style={{ borderColor: on ? ACCENT : "#1e2738", background: on ? `${ACCENT}1a` : "transparent", color: on ? ACCENT : "#9fb0d0" }}
            >
              {vw.emoji} {vw.label}
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[10px] text-[#5b6b8c]">478 points · on your device</span>
      </div>

      {/* Live blendshape bars */}
      <div className="mt-3 rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
        <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">📊 WHAT THE AI FEELS · live</p>
        <div className="space-y-1.5">
          {METERS.map((m) => {
            const pct = Math.round(Math.min(1, meters[m.id] ?? 0) * 100);
            return (
              <div key={m.id} className="flex items-center gap-2">
                <span style={{ width: 16 }}>{m.emoji}</span>
                <span className="w-[68px] shrink-0 font-mono text-[10px] text-[#9fb0d0]">{m.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#0b1018]">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT, transition: "width .1s linear" }} />
                </div>
                <span className="w-9 text-right font-mono text-[10px]" style={{ color: pct > 40 ? ACCENT : "#5b6b8c" }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expression quest */}
      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">MAKE THESE FACES</p>
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
        A face mesh tracks hundreds of <Hi accent={ACCENT}>landmark points</Hi> and turns them into
        “blendshape” numbers — how open the mouth is, how raised the brows are. Apps use it for AR masks,
        avatars (like Memoji) and accessibility. Reading an <Hi accent={ACCENT}>expression</Hi> is fair game;
        guessing age, gender or “true feelings” from a face is unreliable and best avoided.
      </Footer>
    </div>
  );
}
