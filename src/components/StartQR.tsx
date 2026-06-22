"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * A scannable QR for the launch CTA — "open it on a tablet." Encodes the
 * current site origin (so it points to wherever the site is actually served),
 * rendered on a white card so any camera can read it.
 */
export function StartQR() {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(window.location.origin, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1020", light: "#ffffff" },
    })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl bg-white p-3 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.85)]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="QR code to open Curious Labs on your device" width={124} height={124} className="h-[124px] w-[124px] rounded-lg" />
        ) : (
          <div className="h-[124px] w-[124px] animate-pulse rounded-lg bg-line/30" />
        )}
      </div>
      <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-tech text-ink-faint">
        <span aria-hidden>📱</span> SCAN TO START ON A TABLET
      </span>
    </div>
  );
}
