import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Skill Passport — Curious Labs",
  description:
    "Your skill passport is getting a rebuild — soon it will track everything you make across Studio, Maker Lab and Neural Lab.",
};

export default function PassportPage() {
  return (
    <div className="mx-auto flex min-h-[72vh] max-w-xl flex-col items-center justify-center px-5 text-center">
      <span className="text-6xl" aria-hidden>🪪</span>
      <p className="mt-6 font-mono text-xs tracking-tech text-neon-cyan">SKILL PASSPORT</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Coming soon</h1>
      <p className="mt-3 text-ink-dim">
        Your passport is getting a rebuild. Soon it&apos;ll track everything you make across{" "}
        <span className="text-neon-cyan">Studio</span>, <span className="text-neon-green">Maker Lab</span> and{" "}
        <span className="text-neon-violet">Neural Lab</span> — skills, projects and badges, all in one place.
      </p>
      <Link href="/" className="btn-primary mt-8">← Back to home</Link>
    </div>
  );
}
