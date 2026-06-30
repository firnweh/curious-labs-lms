"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { useCamera } from "./_camera";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "QR Scanner" (live QR decoding).
 *
 * Reads QR codes from the webcam with jsQR: each frame becomes a grid of
 * pixels, the finder-patterns (the three big corner squares) are located, and
 * the black/white modules are decoded into text. We outline the code and show
 * its data. Teaches that a QR code is a tiny printed data file — and that you
 * should look before you trust a link.
 */

const ACCENT = "#60a5fa";
const W = 420, H = 315;

export default function QRScanner() {
  const { videoRef, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [value, setValue] = useState<string | null>(null);
  const [scanned, setScanned] = useState(0);

  const loop = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(video, 0, 0, W, H);
      const img = ctx.getImageData(0, 0, W, H);
      const code = jsQR(img.data, W, H, { inversionAttempts: "dontInvert" });
      if (code) {
        const loc = code.location;
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(loc.topLeftCorner.x, loc.topLeftCorner.y);
        ctx.lineTo(loc.topRightCorner.x, loc.topRightCorner.y);
        ctx.lineTo(loc.bottomRightCorner.x, loc.bottomRightCorner.y);
        ctx.lineTo(loc.bottomLeftCorner.x, loc.bottomLeftCorner.y);
        ctx.closePath();
        ctx.stroke();
        setValue((prev) => {
          if (prev !== code.data) setScanned((n) => n + 1);
          return code.data;
        });
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (status !== "on") return;
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [status, loop]);

  useEffect(() => () => stop(), [stop]);

  const live = status === "on";
  const isUrl = value ? /^https?:\/\//i.test(value.trim()) : false;

  return (
    <div className="mx-auto w-full max-w-[560px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🔳" title="QR Scanner" grades="Grades 3–8" topic="Computer vision" accent={ACCENT} right={`${scanned} scanned`} />

      <Caption accent={ACCENT} active={!!value}>
        {value
          ? "✅ Decoded! Those three big corner squares are 'finder patterns' — they tell the scanner where the code is and which way up. The black & white squares are the actual data."
          : live
            ? "Hold any QR code up to the camera — on a product, a poster, or another screen."
            : "Turn on the camera and scan a QR code to see the data hidden inside it."}
      </Caption>

      <div className="relative mx-auto aspect-[4/3] w-full max-w-[420px] overflow-hidden rounded-2xl border" style={{ borderColor: live ? `${ACCENT}66` : "#1e2738", background: "#060912" }}>
        <video ref={videoRef} playsInline muted className="hidden" />
        <canvas ref={canvasRef} width={W} height={H} className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
        {!live && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            <div className="flex flex-col items-center gap-3">
              <span aria-hidden style={{ fontSize: 40 }}>🔳</span>
              {error && <p className="max-w-[260px] font-mono text-[11px] text-[#fb7185]">{error}</p>}
              <button type="button" onClick={start} className="rounded-xl border-2 px-4 py-2 font-mono text-xs font-semibold" style={{ borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` }}>
                {error ? "Try again" : "▶ Turn on camera"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-[#1e2738] bg-[#0f1420] px-3 py-3">
        <div className="font-mono text-[9px] tracking-wide text-[#5b6b8c]">DECODED DATA</div>
        <div className="mt-1 break-all font-mono text-[12px]" style={{ color: value ? ACCENT : "#5b6b8c" }}>
          {value ?? "— point the camera at a QR code —"}
        </div>
        {isUrl && (
          <div className="mt-1 font-mono text-[9px] text-[#eab308]">
            ⚠ This is a link. We won’t open it — always check where a QR link goes before tapping it.
          </div>
        )}
      </div>

      <Footer accent={ACCENT}>
        A QR code is a tiny printed <Hi accent={ACCENT}>data file</Hi>. The scanner finds the three corner squares,
        straightens the image, then reads the grid of black & white squares as bits. Handy — but a code can hide any
        link, so good scanners <Hi accent={ACCENT}>show you the address first</Hi>.
      </Footer>
    </div>
  );
}
