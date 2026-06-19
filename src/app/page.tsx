import Link from "next/link";
import { HomeTrackCards } from "@/components/HomeTrackCards";
import { GradePickerSlide } from "@/components/GradePickerSlide";
import { ClassBandCards } from "@/components/ClassBandCards";
import MakerspaceStats from "@/components/MakerspaceStats";
import { SampleLabPlayer } from "@/components/SampleLabPlayer";
import { CosmosFX } from "@/components/CosmosFX";
import { CinematicHero } from "@/components/CinematicHero";
import { CosmicCarousel } from "@/components/CosmicCarousel";

// 7 tight slides, grades pulled forward (they're the headline now: 100 labs,
// Grades 1–10). Labels/sectors stay index-aligned with the children below.
const SLIDE_LABELS = ["Home", "Stats", "Grades", "Sample Lab", "Tracks", "Class Bands", "Get Started"];
const SLIDE_SECTORS = ["LAUNCH PAD", "TELEMETRY", "STAR CHART", "SIMULATION BAY", "PROGRAM DECK", "CADET TIERS", "DOCKING BAY"];

export default function Home() {
  return (
    <>
      <CosmosFX />
      <CosmicCarousel labels={SLIDE_LABELS} sectors={SLIDE_SECTORS}>
        {/* 1 — Hero */}
        <CinematicHero />

        {/* 2 — Makerspace stats (live from the registry) */}
        <MakerspaceStats />

        {/* 3 — Pick your grade — the curriculum is the headline */}
        <GradePickerSlide />

        {/* 4 — Sample lab — play one right here */}
        <section id="samples">
          <div className="mb-4 text-center">
            <div className="section-label reveal">Interactive Lab</div>
            <h2 className="section-title reveal">Try a sample lab</h2>
          </div>
          <SampleLabPlayer />
        </section>

        {/* 5 — The four tracks */}
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

        {/* 6 — Grade bands */}
        <section id="bands">
          <div className="mb-8 text-center">
            <div className="section-label reveal">Pitched for every age</div>
            <h2 className="section-title reveal">Three class bands</h2>
            <p className="section-sub reveal mx-auto mt-3 max-w-xl">The same track, tuned to how each age group thinks and plays.</p>
          </div>
          <ClassBandCards />
        </section>

        {/* 7 — Launch CTA */}
        <section id="launch">
          <div className="panel reveal relative overflow-hidden p-12 text-center">
            <div className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-neon-violet/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-16 -bottom-16 h-52 w-52 rounded-full bg-neon-cyan/20 blur-3xl" />
            <div className="relative">
              <h2 className="font-orbitron text-3xl font-bold text-ink neon-text">Ready to start making?</h2>
              <p className="mx-auto mt-3 max-w-md text-ink-dim">
                Pick a grade, pick a track, and run your first experiment in seconds.
              </p>
              <Link href="/tracks" className="btn-primary mt-8">🚀 Enter the Labs</Link>
            </div>
          </div>
        </section>
      </CosmicCarousel>
    </>
  );
}
