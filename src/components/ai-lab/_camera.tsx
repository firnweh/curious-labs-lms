"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared webcam plumbing for the Neural Lab's live experiments. `useCamera`
 * owns the MediaStream lifecycle; `CameraStage` renders the framed video with a
 * pixel-perfect overlay canvas on top plus the permission / error states, all
 * in the lab's dark house style. Each experiment runs its own rAF loop reading
 * the <video> and drawing on the <canvas>.
 */

export type CamStatus = "idle" | "starting" | "on" | "error";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CamStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't open a camera.");
      setStatus("error");
      return;
    }
    setStatus("starting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      setStatus("on");
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera blocked — allow access in your browser, then try again."
          : name === "NotFoundError"
            ? "No camera found on this device."
            : "Couldn't start the camera.",
      );
      setStatus("error");
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, status, error, start, stop };
}

export function CameraStage({
  videoRef,
  canvasRef,
  status,
  error,
  accent,
  onStart,
  hint = "We never upload your video — everything runs on your device.",
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  status: CamStatus;
  error: string | null;
  accent: string;
  onStart: () => void;
  hint?: string;
}) {
  const live = status === "on";
  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border"
      style={{ borderColor: live ? `${accent}66` : "#1e2738", background: "#060912" }}
    >
      {/* Mirror the feed so it reads like a mirror; overlay matches it. */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: "scaleX(-1)", opacity: live ? 1 : 0 }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ transform: "scaleX(-1)" }}
      />

      {!live && (
        <div className="absolute inset-0 grid place-items-center p-4 text-center">
          {status === "starting" ? (
            <p className="font-mono text-xs text-[#9fb0d0]">Starting camera…</p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span aria-hidden style={{ fontSize: 40 }}>📷</span>
              {error && (
                <p className="max-w-[260px] font-mono text-[11px] leading-relaxed text-[#fb7185]">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={onStart}
                className="rounded-xl border-2 px-4 py-2 font-mono text-xs font-semibold transition-colors"
                style={{ borderColor: accent, color: accent, background: `${accent}1a` }}
              >
                {error ? "Try again" : "▶ Turn on camera"}
              </button>
              <p className="max-w-[260px] font-mono text-[9px] leading-relaxed text-[#5b6b8c]">
                {hint}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Size a canvas's backing store to match the video frame, once it's known. */
export function syncCanvas(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
