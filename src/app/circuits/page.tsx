import type { Metadata } from "next";
import { CircuitStudio } from "@/components/CircuitStudio";

export const metadata: Metadata = { title: "Circuit Studio — Curious Labs" };

export default function CircuitsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-6">
        <h1 className="font-round text-3xl font-bold text-ink sm:text-4xl">⚡ Circuit Lab</h1>
        <p className="mt-2 max-w-2xl font-round text-lg text-ink-dim">
          Grab parts, snap them together with wires, and press Play to make things light up, spin and buzz! 🎉
        </p>
      </header>
      <CircuitStudio />
    </div>
  );
}
