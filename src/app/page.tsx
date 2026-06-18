import Link from "next/link";
import { SUBJECTS } from "@/lib/subjects";
import { ACTIVITIES } from "@/lib/activities/registry";
import { TrackGrid } from "@/components/TrackGrid";
import { HomeBackground } from "@/components/HomeBackground";
import { Pill } from "@/components/ui";

export default function Home() {
  const steps = [
    { n: "01", t: "Pick a lab", d: "Choose a hands-on experiment from any of the four tracks." },
    { n: "02", t: "Build & run", d: "Drag, click, wire and tune — right in the browser, nothing to install." },
    { n: "03", t: "Auto-checked", d: "Each lab grades your result instantly and saves your progress." },
  ];

  return (
    <div className="relative mx-auto max-w-6xl px-5">
      <HomeBackground />

      <div className="relative z-10">
        {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative pt-20 pb-16 sm:pt-28">
        <div className="flex flex-col items-center text-center">
          <Pill>
            <span className="text-neon-green">●</span> Learn by doing · grades 1–10
          </Pill>
          <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.15] text-[#dfe6f2] sm:text-6xl [text-shadow:0_0_22px_rgba(124,108,240,0.18)]">
            Build robots, code,
            <br />
            and teach machines to think.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-dim">
            A hands-on lab for young makers. No textbooks — just experiments you run
            in your browser across coding, robotics, AI and 3D modelling.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#tracks"
              className="rounded-xl bg-[#3fd8d4] px-6 py-3 font-semibold text-base text-[#060810] transition-transform hover:scale-[1.03] shadow-[0_0_30px_rgba(63,216,212,0.16)]"
            >
              Start experimenting →
            </Link>
            <Link
              href="#how"
              className="rounded-xl border border-line bg-panel/60 px-6 py-3 font-medium text-ink-dim transition-colors hover:text-ink"
            >
              How it works
            </Link>
          </div>
          <p className="mt-6 font-mono text-xs tracking-tech text-ink-faint">
            {ACTIVITIES.length} LIVE LABS · {SUBJECTS.length} TRACKS · 0 INSTALLS
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link href="/create" className="rounded-full border border-line bg-panel/60 px-4 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink">
              🎨 Create
            </Link>
            <Link href="/base" className="rounded-full border border-line bg-panel/60 px-4 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink">
              ✨ My Base
            </Link>
            <Link href="/profile" className="rounded-full border border-line bg-panel/60 px-4 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink">
              🏅 Progress
            </Link>
          </div>
        </div>
      </section>

      {/* ── Tracks ───────────────────────────────────────── */}
      <section id="tracks" className="scroll-mt-20 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">Choose your track</h2>
            <p className="mt-1 text-ink-dim">Pick your class, then dive into a world of making.</p>
          </div>
        </div>
        <TrackGrid />
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how" className="scroll-mt-20 py-12">
        <h2 className="font-display text-2xl font-bold text-ink">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="panel p-6">
              <span className="font-mono text-sm text-neon-cyan">{s.n}</span>
              <h3 className="mt-2 font-display text-lg font-semibold text-ink">{s.t}</h3>
              <p className="mt-1.5 text-sm text-ink-dim">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}
