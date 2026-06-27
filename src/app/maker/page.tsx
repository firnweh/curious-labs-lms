import type { Metadata } from "next";
import { MakerLab } from "@/components/MakerLab";

export const metadata: Metadata = {
  title: "Maker Lab — Curious Labs",
  description:
    "Wire up a circuit and program the chip in one place — drag parts, snap wires, and build Arduino/ESP code with blocks. Powered by Physics Wallah.",
};

export default function MakerLabPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4">
        <p className="font-mono text-xs tracking-tech text-neon-cyan">MAKER LAB · WIRE IT &amp; CODE IT</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">Maker Lab 🔧</h1>
        <p className="mt-2 max-w-2xl text-ink-dim">
          Build the circuit up top, write the code below — drag the divider to give the code more
          room, or hide it to focus on wiring. Pick your board, then copy, download or flash the{" "}
          <code className="text-neon-cyan">.ino</code>.
        </p>
      </header>
      <MakerLab />
    </div>
  );
}
