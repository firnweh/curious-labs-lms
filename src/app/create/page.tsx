import type { Metadata } from "next";
import { PixelStudio } from "@/components/PixelStudio";

export const metadata: Metadata = {
  title: "Create — Curious Labs",
};

export default function CreatePage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-tech text-neon-violet">CREATIVE STUDIO</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">Pixel Art Studio 🎨</h1>
        <p className="mt-2 max-w-2xl text-ink-dim">
          No goals, no grading — just make whatever you imagine. Pick a colour, paint the grid,
          then save it to your gallery or download it to share.
        </p>
      </header>
      <PixelStudio />
    </div>
  );
}
