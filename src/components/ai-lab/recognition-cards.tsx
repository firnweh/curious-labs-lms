"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GestureRecognizer } from "@mediapipe/tasks-vision";
import { loadGestureRecognizer } from "@/lib/ai/vision";
import { CameraStage, useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Sign Driver" (recognition → action).
 *
 * The classic "hold up a sign, the robot obeys" project: the AI recognises a
 * hand sign each moment, and that recognised label is turned into a COMMAND
 * that steers a little robot across a grid to the flag. Teaches the full loop —
 * sense → recognise → act — not just naming a gesture.
 */

const ACCENT = "#34d399";
const COLS = 6, ROWS = 4;
const TARGET = { x: 5, y: 0 };

type Dir = "up" | "down" | "left" | "right" | "stop";
const SIGN_TO_DIR: Record<string, Dir> = {
  Pointing_Up: "up",
  Closed_Fist: "down",
  Victory: "left",
  Thumb_Up: "right",
  Open_Palm: "stop",
};
const LEGEND: { emoji: string; sign: string; dir: Dir }[] = [
  { emoji: "☝️", sign: "Point up", dir: "up" },
  { emoji: "✊", sign: "Fist", dir: "down" },
  { emoji: "✌️", sign: "Victory", dir: "left" },
  { emoji: "👍", sign: "Thumb", dir: "right" },
  { emoji: "✋", sign: "Palm", dir: "stop" },
];

export default function SignDriver() {
  const { videoRef, status, error, start, stop } = useCamera();
  const detRef = useRef<GestureRecognizer | null>(null);
  const rafRef = useRef<number | null>(null);
  const dirRef = useRef<Dir>("stop");
  const lastMove = useRef(0);
  const [loading, setLoading] = useState(false);
  const [dir, setDir] = useState<Dir>("stop");
  const [pos, setPos] = useState({ x: 0, y: ROWS - 1 });
  const [won, setWon] = useState(false);

  const loop = useCallback((t: number) => {
    const video = videoRef.current, det = detRef.current;
    if (!video || !det || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const res = det.recognizeForVideo(video, performance.now());
    const g = res.gestures?.[0]?.[0];
    const d = g && g.score > 0.6 ? SIGN_TO_DIR[g.categoryName] ?? "stop" : "stop";
    dirRef.current = d;
    setDir(d);
    // step the robot ~ every 650ms in the current direction
    if (t - lastMove.current > 650 && d !== "stop") {
      lastMove.current = t;
      setPos((p) => {
        const n = { ...p };
        if (d === "up") n.y = Math.max(0, p.y - 1);
        if (d === "down") n.y = Math.min(ROWS - 1, p.y + 1);
        if (d === "left") n.x = Math.max(0, p.x - 1);
        if (d === "right") n.x = Math.min(COLS - 1, p.x + 1);
        if (n.x === TARGET.x && n.y === TARGET.y) setWon(true);
        return n;
      });
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    setLoading(true);
    loadGestureRecognizer()
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

  const reset = () => { setPos({ x: 0, y: ROWS - 1 }); setWon(false); };

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🤖" title="Sign Driver" grades="Grades 3–8" topic="Computer vision" accent={ACCENT} right={won ? "✓ reached flag!" : `dir: ${dir}`} />

      <Caption accent={ACCENT} active={won}>
        {won
          ? "🏁 You drove the robot home with hand signs! That's the whole AI control loop: the camera SENSES, the model RECOGNISES the sign, and your code turns it into an ACTION. Self-driving bots read road signs the same way."
          : status === "on"
            ? loading
              ? "Loading the sign model…"
              : "Make the signs below to steer the 🤖 to the 🚩. Open palm = stop."
            : "Turn on the camera and steer a robot to the flag using hand signs."}
      </Caption>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CameraStage videoRef={videoRef} canvasRef={{ current: null }} status={status} error={error} accent={ACCENT} onStart={start} />
        <div className="rounded-2xl border border-[#1e2738] bg-[#0b1018] p-2">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {Array.from({ length: ROWS * COLS }, (_, i) => {
              const x = i % COLS, y = Math.floor(i / COLS);
              const isRobot = x === pos.x && y === pos.y;
              const isTarget = x === TARGET.x && y === TARGET.y;
              return (
                <div key={i} className="grid aspect-square place-items-center rounded-md text-lg" style={{ background: "#0f1420", border: "1px solid #1e2738" }}>
                  {isRobot ? "🤖" : isTarget ? "🚩" : ""}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">SIGN COMMANDS</p>
      <div className="flex flex-wrap gap-1.5">
        {LEGEND.map((l) => (
          <span key={l.dir} className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]" style={{ borderColor: dir === l.dir ? ACCENT : "#1e2738", background: dir === l.dir ? `${ACCENT}1a` : "transparent", color: dir === l.dir ? ACCENT : "#9fb0d0" }}>
            {l.emoji} {l.sign} → {l.dir}
          </span>
        ))}
        <button type="button" onClick={reset} className="rounded-xl border border-[#2a3550] px-2.5 py-1.5 font-mono text-[10px] text-[#9fb0d0]">↺ reset</button>
      </div>

      <Footer accent={ACCENT}>
        This is the same idea as STEMpedia-style “recognition cards”: a fixed set of signs the AI was trained to
        know. Recognising the sign is only half — your program <Hi accent={ACCENT}>maps</Hi> each label to an action.
        Sense → recognise → act is the loop behind sign-reading robots and self-driving cars.
      </Footer>
    </div>
  );
}
