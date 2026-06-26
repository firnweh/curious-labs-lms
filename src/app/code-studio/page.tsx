import type { Metadata } from "next";
import { BlocklyStudio } from "@/components/BlocklyStudio";

export const metadata: Metadata = {
  title: "Code Studio — Curious Labs",
  description:
    "Drag-and-drop block coding for kids — snap blocks together to fly a rocket and draw with code. Powered by Physics Wallah.",
};

export default function CodeStudioPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-tech text-neon-amber">CODE STUDIO · BLOCK CODING</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">
          Code Studio 🚀
        </h1>
        <p className="mt-2 max-w-2xl text-ink-dim">
          Snap blocks together to fly a rocket and draw with code — loops, logic and
          maths, no typing required. Press <span className="text-neon-green">Run</span> to
          launch your program.
        </p>
        <p className="mt-2 font-mono text-[11px] tracking-tech text-ink-faint">
          CURIOUS<span className="text-neon-cyan">LABS</span> · POWERED BY PHYSICS WALLAH
        </p>
      </header>
      <BlocklyStudio />
    </div>
  );
}
