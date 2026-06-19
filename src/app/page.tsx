import Link from "next/link";
import { GradeRail } from "@/components/GradeRail";
import { HomeTrackCards } from "@/components/HomeTrackCards";
import { SampleLabPlayer } from "@/components/SampleLabPlayer";
import { CosmosFX } from "@/components/CosmosFX";
import { CinematicHero } from "@/components/CinematicHero";
import { StellarCollapse } from "@/components/StellarCollapse";
import { CosmicCarousel } from "@/components/CosmicCarousel";

const STEPS = [
  { n: "01", t: "Pick a lab", d: "Choose a hands-on experiment from any of the four tracks." },
  { n: "02", t: "Build & run", d: "Drag, click, wire and tune — right in the browser, nothing to install." },
  { n: "03", t: "Auto-checked", d: "Each lab grades your result instantly and saves your progress." },
];

const BANDS_INFO = [
  { emoji: "🐣", classes: "Class 1–3", name: "Juniors", accent: "#34d399", thinking: "Tap, match and sort — playful, no reading needed." },
  { emoji: "🚀", classes: "Class 4–6", name: "Explorers", accent: "#22d3ee", thinking: "Use loops and logic, build circuits, train a model." },
  { emoji: "🧠", classes: "Class 7–10", name: "Innovators", accent: "#a855f7", thinking: "Variables, conditions, models and coordinates — real reasoning." },
];

const SLIDE_LABELS = ["Home", "Sample Labs", "Tracks", "Grades", "Gravity Lab", "How it works", "Class Bands", "Get Started"];
const SLIDE_SECTORS = ["LAUNCH PAD", "SIMULATION BAY", "PROGRAM DECK", "STAR CHART", "EVENT HORIZON", "MISSION BRIEF", "CADET TIERS", "DOCKING BAY"];

export default function Home() {
  return (
    <>
      <CosmosFX />
      <CosmicCarousel labels={SLIDE_LABELS} sectors={SLIDE_SECTORS}>
        {/* 1 — Hero */}
        <CinematicHero />

        {/* 2 — Sample labs — play one right here */}
        <section id="samples">
          <div className="mb-8 text-center">
            <div className="section-label reveal">Interactive Lab</div>
            <h2 className="section-title reveal">Try a sample lab</h2>
            <p className="section-sub reveal mx-auto mt-3 max-w-xl">
              Pick a track and play a real experiment right here — no sign-up, nothing to install.
            </p>
          </div>
          <SampleLabPlayer />
        </section>

        {/* 3 — The four tracks */}
        <section id="tracks">
          <div className="mb-8 text-center">
            <div className="section-label reveal">Our Programs</div>
            <h2 className="section-title reveal">Lab-First Learning Tracks</h2>
            <p className="section-sub reveal mx-auto mt-3 max-w-xl">
              Coding, Robotics, AI and 3D Modelling — each a world of hands-on making, for grades 1–10.
            </p>
          </div>
          <HomeTrackCards />
        </section>

        {/* 4 — Browse by grade (curriculum) */}
        <section id="grades">
          <div className="mb-8 text-center">
            <div className="section-label reveal">The Curriculum</div>
            <h2 className="section-title reveal">Browse by grade</h2>
            <p className="section-sub reveal mx-auto mt-3 max-w-xl">
              Each grade has its own year of hands-on projects, straight from the curriculum.
            </p>
          </div>
          <div className="reveal">
            <GradeRail />
          </div>
        </section>

        {/* 5 — Black-hole showpiece */}
        <StellarCollapse />

        {/* 6 — How it works */}
        <section id="how">
          <div className="mb-8 text-center">
            <div className="section-label reveal">How it works</div>
            <h2 className="section-title reveal">Three steps to your first build</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="panel tilt reveal p-7">
                <span className="font-orbitron text-lg text-neon-cyan">{s.n}</span>
                <h3 className="mt-2 font-orbitron text-lg font-bold text-ink">{s.t}</h3>
                <p className="mt-2 text-sm text-ink-dim">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 7 — Grade bands */}
        <section id="bands">
          <div className="mb-8 text-center">
            <div className="section-label reveal">Pitched for every age</div>
            <h2 className="section-title reveal">Three class bands</h2>
            <p className="section-sub reveal mx-auto mt-3 max-w-xl">The same track, tuned to how each age group thinks and plays.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {BANDS_INFO.map((b) => (
              <div key={b.name} className="panel tilt reveal p-7" style={{ color: b.accent }}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden>{b.emoji}</span>
                  <div className="leading-tight">
                    <h3 className="font-orbitron text-lg font-bold text-ink">{b.classes}</h3>
                    <p className="font-mono text-[11px]" style={{ color: b.accent }}>{b.name}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-ink-dim">{b.thinking}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 8 — Launch CTA */}
        <section id="launch">
          <div className="panel reveal relative overflow-hidden p-12 text-center">
            <div className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-neon-violet/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-16 -bottom-16 h-52 w-52 rounded-full bg-neon-cyan/20 blur-3xl" />
            <div className="relative">
              <h2 className="font-orbitron text-3xl font-bold text-ink neon-text">Ready to start making?</h2>
              <p className="mx-auto mt-3 max-w-md text-ink-dim">
                Pick a track, pick your class, and run your first experiment in seconds.
              </p>
              <Link href="/tracks" className="btn-primary mt-8">🚀 Enter the Labs</Link>
            </div>
          </div>
        </section>
      </CosmicCarousel>
    </>
  );
}
