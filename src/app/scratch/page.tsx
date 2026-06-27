import type { Metadata } from "next";
import { ScratchStudio } from "@/components/ScratchStudio";

export const metadata: Metadata = {
  title: "Studio — Curious Labs",
  description:
    "Build games and animations with sprites, costumes, sounds and code blocks — a Scratch-style studio powered by Physics Wallah.",
};

export default function ScratchStudioPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-tech text-neon-violet">STUDIO · BUILD & PLAY</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">Studio 🎮</h1>
        <p className="mt-2 max-w-2xl text-ink-dim">
          Snap together Motion, Looks, Sound and Control blocks to build games and animations.
          Then hit the <span className="text-neon-green">🟢 green flag</span> to bring it to life.
          Add sprites, drag them on stage, animate costumes, pick a backdrop, and make it yours.
        </p>
        <p className="mt-2 font-mono text-[11px] tracking-tech text-ink-faint">
          CURIOUS<span className="text-neon-cyan">LABS</span> · POWERED BY PHYSICS WALLAH
        </p>
      </header>
      <ScratchStudio />
    </div>
  );
}
