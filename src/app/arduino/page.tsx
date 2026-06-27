import type { Metadata } from "next";
import { ArduinoStudio } from "@/components/ArduinoStudio";

export const metadata: Metadata = {
  title: "Chip Studio — Curious Labs",
  description:
    "Program Arduino and ESP boards with code blocks — drag blocks, get real Arduino/C++ code. A block + text studio powered by Physics Wallah.",
};

export default function ArduinoStudioPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-tech text-neon-cyan">CHIP STUDIO · BLOCKS → BOARDS</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">Chip Studio 🔌</h1>
        <p className="mt-2 max-w-2xl text-ink-dim">
          Program Arduino &amp; ESP boards with blocks. Drag from Pins, Output, Input, Control,
          Serial and Wi-Fi — and watch real{" "}
          <span className="text-neon-green">Arduino/C++ code</span> build itself on the right.
          Pick your board, then copy or download the <code className="text-neon-cyan">.ino</code>.
        </p>
        <p className="mt-2 font-mono text-[11px] tracking-tech text-ink-faint">
          CURIOUS<span className="text-neon-cyan">LABS</span> · POWERED BY PHYSICS WALLAH
        </p>
      </header>
      <ArduinoStudio />
    </div>
  );
}
