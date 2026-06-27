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
    <div className="px-2 py-2 sm:px-3 sm:py-3 lg:h-[100svh] lg:overflow-hidden">
      <ScratchStudio />
    </div>
  );
}
