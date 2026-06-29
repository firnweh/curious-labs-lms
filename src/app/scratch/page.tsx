import type { Metadata } from "next";
import { ScratchStudio } from "@/components/ScratchStudio";

export const metadata: Metadata = {
  title: "Studio — Curious Labs",
  description:
    "Build games and animations with sprites, costumes, sounds and code blocks — a Scratch-style studio powered by Physics Wallah.",
};

export default function ScratchStudioPage() {
  // Full-screen dark "neon" studio: drifting gradient blobs behind the editor.
  return (
    <div className="relative px-2 py-2 sm:px-3 sm:py-3 lg:h-[100svh] lg:overflow-hidden" style={{ background: "#070b1a" }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="sb-blob" style={{ background: "#4C97FF", top: "-14%", left: "-6%", animationDelay: "0s" }} />
        <span className="sb-blob" style={{ background: "#9966FF", top: "-10%", right: "-8%", animationDelay: "-7s" }} />
        <span className="sb-blob" style={{ background: "#22d3ee", bottom: "-14%", left: "10%", animationDelay: "-13s" }} />
        <span className="sb-blob" style={{ background: "#ff66c4", bottom: "-10%", right: "4%", animationDelay: "-4s" }} />
      </div>
      <div className="relative z-10 lg:h-full">
        <ScratchStudio />
      </div>
      <style>{`
        .sb-blob { position:absolute; width:46vw; height:46vw; border-radius:9999px; filter: blur(90px); opacity:0.40; will-change: transform; animation: sbFloat 22s ease-in-out infinite; }
        @keyframes sbFloat {
          0%,100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(6vw,4vh) scale(1.12); }
          66% { transform: translate(-5vw,-3vh) scale(0.95); }
        }
        @media (prefers-reduced-motion: reduce) { .sb-blob { animation: none; } }
      `}</style>
    </div>
  );
}
