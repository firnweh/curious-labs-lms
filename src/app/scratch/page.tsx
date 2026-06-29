import type { Metadata } from "next";
import { ScratchStudio } from "@/components/ScratchStudio";

export const metadata: Metadata = {
  title: "Studio — Curious Labs",
  description:
    "Build games and animations with sprites, costumes, sounds and code blocks — a Scratch-style studio powered by Physics Wallah.",
};

export default function ScratchStudioPage() {
  // Full-screen studio: the editor fills the viewport below the top bar.
  return (
    <div
      className="px-2 py-2 sm:px-3 sm:py-3 lg:h-[100svh] lg:overflow-hidden"
      style={{
        background:
          "radial-gradient(40% 50% at 12% 16%, rgba(76,151,255,0.22), transparent 72%)," +
          "radial-gradient(42% 50% at 88% 14%, rgba(153,102,255,0.20), transparent 72%)," +
          "radial-gradient(46% 52% at 86% 88%, rgba(255,102,196,0.16), transparent 72%)," +
          "radial-gradient(46% 54% at 12% 90%, rgba(34,211,238,0.18), transparent 72%)," +
          "linear-gradient(135deg,#eef2fb,#e7edf7)",
      }}
    >
      <ScratchStudio />
    </div>
  );
}
