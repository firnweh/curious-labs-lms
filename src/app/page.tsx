import Link from "next/link";
import { HomeTrackCards } from "@/components/HomeTrackCards";
import { GradePickerSlide } from "@/components/GradePickerSlide";
import { ClassBandCards } from "@/components/ClassBandCards";
import MakerspaceStats from "@/components/MakerspaceStats";
import LabsInAction from "@/components/LabsInAction";
import StudentShowcase from "@/components/StudentShowcase";
import ParentsTeachers from "@/components/ParentsTeachers";
import AchievementsPreview from "@/components/AchievementsPreview";
import SupernovaBurst from "@/components/SupernovaBurst";
import { SampleLabPlayer } from "@/components/SampleLabPlayer";
import { CosmosFX } from "@/components/CosmosFX";
import { CinematicHero } from "@/components/CinematicHero";
import { CosmicCarousel } from "@/components/CosmicCarousel";

const STEPS = [
  { n: "01", t: "Pick a lab", d: "Choose a hands-on experiment from any of the four tracks." },
  { n: "02", t: "Build & run", d: "Drag, click, wire and tune — right in the browser, nothing to install." },
  { n: "03", t: "Auto-checked", d: "Each lab grades your result instantly and saves your progress." },
];

// NOTE: candidate slides for review. Labels/sectors stay index-aligned with the
// children below — keep them in sync if you add/remove a slide.
const SLIDE_LABELS = ["Home", "Stats", "Sample Labs", "Labs in Action", "Tracks", "Grades", "Supernova", "How it works", "Showcase", "Rewards", "Class Bands", "Educators", "Get Started"];
const SLIDE_SECTORS = ["LAUNCH PAD", "TELEMETRY", "SIMULATION BAY", "OBSERVATION DECK", "PROGRAM DECK", "STAR CHART", "EVENT HORIZON", "MISSION BRIEF", "GALLERY BAY", "MEDAL BAY", "CADET TIERS", "COMMAND DECK", "DOCKING BAY"];

export default function Home() {
  return (
    <>
      <CosmosFX />
      <CosmicCarousel labels={SLIDE_LABELS} sectors={SLIDE_SECTORS}>
        {/* 1 — Hero */}
        <CinematicHero />

        {/* 2 — Makerspace stats (NEW) */}
        <MakerspaceStats />

        {/* 3 — Sample labs — play one right here */}
        <section id="samples">
          <div className="mb-4 text-center">
            <div className="section-label reveal">Interactive Lab</div>
            <h2 className="section-title reveal">Try a sample lab</h2>
          </div>
          <SampleLabPlayer />
        </section>

        {/* 4 — Labs in action / demo reel (NEW) */}
        <LabsInAction />

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

        {/* 6 — Pick your grade (NEW — re-adds grade entry point) */}
        <GradePickerSlide />

        {/* 7 — Supernova showpiece (NEW — replaces black hole) */}
        <SupernovaBurst />

        {/* 8 — How it works */}
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

        {/* 9 — Student showcase (NEW) */}
        <StudentShowcase />

        {/* 10 — Achievements & certificates (NEW) */}
        <AchievementsPreview />

        {/* 11 — Grade bands */}
        <section id="bands">
          <div className="mb-8 text-center">
            <div className="section-label reveal">Pitched for every age</div>
            <h2 className="section-title reveal">Three class bands</h2>
            <p className="section-sub reveal mx-auto mt-3 max-w-xl">The same track, tuned to how each age group thinks and plays.</p>
          </div>
          <ClassBandCards />
        </section>

        {/* 12 — For parents & teachers (NEW) */}
        <ParentsTeachers />

        {/* 13 — Launch CTA */}
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
