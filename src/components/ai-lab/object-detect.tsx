"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ObjectDetector } from "@mediapipe/tasks-vision";
import { loadObjectDetector } from "@/lib/ai/vision";
import { CameraStage, syncCanvas, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Object Spotter" (live object detection) as a directed scavenger hunt.
 *
 * MediaPipe's EfficientDet finds and *locates* everyday objects, drawing a labelled
 * box + score around each. We give kids a real CHECKLIST of household things to
 * hunt down (they tick off as the AI spots them), surface "bonus finds", nudge them
 * to STUMP the AI with something off its ~80-class menu, and unlock a "what you
 * learned" recap — teaching detection = WHAT (label) + WHERE (box), with a confidence,
 * and only for the classes it trained on. All on-device.
 */

const ACCENT = "#34d399";

interface Hunt { name: string; emoji: string; label: string }
const HUNT: Hunt[] = [
  { name: "cup", emoji: "☕", label: "Cup" },
  { name: "bottle", emoji: "🍶", label: "Bottle" },
  { name: "book", emoji: "📖", label: "Book" },
  { name: "cell phone", emoji: "📱", label: "Phone" },
  { name: "laptop", emoji: "💻", label: "Laptop" },
  { name: "chair", emoji: "🪑", label: "Chair" },
  { name: "remote", emoji: "📺", label: "Remote" },
  { name: "keyboard", emoji: "⌨️", label: "Keyboard" },
  { name: "scissors", emoji: "✂️", label: "Scissors" },
  { name: "banana", emoji: "🍌", label: "Banana" },
];
const WIN = 6;

// Draw a label so it reads correctly over the mirrored (selfie) canvas.
function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = "bold 20px ui-monospace, monospace";
  const w = ctx.measureText(text).width + 12;
  const top = Math.max(0, y - 26);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(x, top, w, 26);
  ctx.save();
  ctx.translate(x + w / 2, top + 13);
  ctx.scale(-1, 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#06231a";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export default function ObjectSpotter() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detRef = useRef<ObjectDetector | null>(null);
  const rafRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState<{ name: string; score: number }[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [everSaw, setEverSaw] = useState(false);
  const [everConfident, setEverConfident] = useState(false);
  const sawRef = useRef(false);
  const confRef = useRef(false);

  const loop = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current, det = detRef.current;
    if (!video || !canvas || !det || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    syncCanvas(canvas, video);
    const ctx = canvas.getContext("2d");
    if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const res = det.detectForVideo(video, performance.now());
    const now: { name: string; score: number }[] = [];
    for (const d of res.detections) {
      const b = d.boundingBox;
      const cat = d.categories[0];
      if (!b || !cat) continue;
      now.push({ name: cat.categoryName, score: cat.score });
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 4;
      ctx.strokeRect(b.originX, b.originY, b.width, b.height);
      drawLabel(ctx, `${cat.categoryName} ${Math.round(cat.score * 100)}%`, b.originX, b.originY);
    }
    setLive(now);

    if (now.length) {
      if (!sawRef.current) { sawRef.current = true; setEverSaw(true); }
      if (!confRef.current && now.some((o) => o.score > 0.8)) { confRef.current = true; setEverConfident(true); }
      setSeen((prev) => {
        const set = new Set(prev);
        let changed = false;
        for (const o of now) if (o.score > 0.5 && !set.has(o.name)) { set.add(o.name); changed = true; }
        return changed ? [...set] : prev;
      });
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadObjectDetector()
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

  const found = new Set(seen);
  const huntCount = HUNT.filter((h) => found.has(h.name)).length;
  const bonus = seen.filter((n) => !HUNT.some((h) => h.name === n));
  const win = huntCount >= WIN;
  const liveStatus = status === "on";

  const LEARN = [
    { id: "whatwhere", text: "Detection finds WHAT it is (the label) and WHERE it is (the box) at the same time.", got: everSaw },
    { id: "conf", text: "It also says how SURE it is — a confidence %. Move closer/clearer and it climbs.", got: everConfident },
    { id: "hunt", text: "You hunted real objects out of your own room — not pictures the app gave you.", got: huntCount >= 3 },
    { id: "limit", text: "It only knows the ~80 kinds it trained on — show it something new and it's stumped.", got: win },
  ];
  const learned = LEARN.filter((l) => l.got).length;

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="📦" title="Object Spotter" grades="Grades 3–7" topic="Computer vision · object detection" accent={ACCENT} right={`${huntCount}/${HUNT.length} hunted`} />

      <Caption accent={ACCENT} active={win || live.length > 0}>
        {win
          ? `🏆 Great hunting — ${huntCount} of ${HUNT.length} found! Detection answered two questions at once: WHAT each thing is and WHERE it is. Now try to STUMP it with something off its ~80-class menu.`
          : !liveStatus
            ? "Turn on the camera and go on an AI scavenger hunt — find real things in your room."
            : loading
              ? "Loading the object model… (first time downloads a few MB)"
              : live.length
                ? `🔎 Spotting ${live.length} thing${live.length === 1 ? "" : "s"} — keep hunting the checklist! (Tip: show it something weird and watch it guess.)`
                : "Point the camera at things — a cup, a book, your phone. Tick off the hunt list!"}
      </Caption>

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} status={status} error={error} accent={ACCENT} onStart={start} />

      {/* Seeing right now */}
      <p className="mb-1.5 mt-3 font-mono text-[9px] tracking-wide text-[#5b6b8c]">SEEING RIGHT NOW</p>
      <div className="flex min-h-[26px] flex-wrap gap-1.5">
        {live.length === 0 && <span className="font-mono text-[10px] text-[#5b6b8c]">— nothing yet —</span>}
        {live.map((o, i) => (
          <span key={`${o.name}-${i}`} className="rounded-lg border border-[#1e2738] bg-[#0f1420] px-2 py-1 font-mono text-[10px]" style={{ color: ACCENT }}>
            {o.name} · {Math.round(o.score * 100)}%
          </span>
        ))}
      </div>

      {/* Scavenger hunt checklist */}
      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">🔎 SCAVENGER HUNT · find these</p>
      <div className="flex flex-wrap gap-1.5">
        {HUNT.map((h) => {
          const ok = found.has(h.name);
          return (
            <span key={h.name} className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]" style={{ borderColor: ok ? ACCENT : "#1e2738", background: ok ? `${ACCENT}1a` : "transparent", color: ok ? ACCENT : "#9fb0d0" }}>
              {ok ? "✓ " : ""}{h.emoji} {h.label}
            </span>
          );
        })}
      </div>

      {/* Bonus finds */}
      {bonus.length > 0 && (
        <>
          <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">⭐ BONUS FINDS · {bonus.length}</p>
          <div className="flex flex-wrap gap-1.5">
            {bonus.map((n) => (
              <span key={n} className="rounded-lg border border-[#2a3550] px-2 py-1 font-mono text-[10px] text-[#9fb0d0]">{n}</span>
            ))}
          </div>
        </>
      )}

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
        Object detection slides over the image asking “is there something here, and what?”. For each hit it
        returns a <Hi accent={ACCENT}>box</Hi> (where) and a <Hi accent={ACCENT}>label</Hi> (what) with a
        confidence score. Self-checkouts, self-driving cars and photo apps all lean on it — but it can only
        spot the ~80 classes it <Hi accent={ACCENT}>practised</Hi> on. Show it your shoe-as-a-phone and watch it guess.
      </Footer>
    </div>
  );
}
