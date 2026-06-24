"use client";

import Link from "next/link";
import MakerspaceStats from "@/components/MakerspaceStats";
import { CosmosFX } from "@/components/CosmosFX";
import { CinematicHero } from "@/components/CinematicHero";
import { CosmicCarousel } from "@/components/CosmicCarousel";
import { HeroIntro3D, HeroIntroRobotics, HeroIntroAI, HeroIntroWeb } from "@/components/HeroIntroLazy";
import { StartQR } from "@/components/StartQR";

// 7 slides: Home, the 4 studio-intro sections, Stats, and the launch CTA.
// Labels/sectors stay index-aligned with the children below.
const SLIDE_LABELS = ["Home", "3D Modelling", "Robotics", "AI", "Web Dev", "Stats", "Get Started"];
const SLIDE_SECTORS = ["LAUNCH PAD", "MODEL BAY", "ROBOTICS BAY", "NEURAL CORE", "WEB FORGE", "TELEMETRY", "DOCKING BAY"];

export default function Home() {
  return (
    <>
      <CosmosFX />
      <CosmicCarousel labels={SLIDE_LABELS} sectors={SLIDE_SECTORS}>
        {/* 1 — Hero */}
        <CinematicHero />

        {/* 2–5 — Studio intro: one looping slide per section, transparent over the home cosmos */}
        <HeroIntro3D />
        <HeroIntroRobotics />
        <HeroIntroAI />
        <HeroIntroWeb />

        {/* 6 — Makerspace stats (live from the registry) */}
        <MakerspaceStats />

        {/* 7 — Launch CTA */}
        <section id="launch">
          <div className="panel relative overflow-hidden p-12 text-center">
            <div className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-neon-violet/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-16 -bottom-16 h-52 w-52 rounded-full bg-neon-cyan/20 blur-3xl" />
            <div className="relative flex flex-col items-center gap-10 sm:flex-row sm:justify-center sm:gap-14">
              <div className="text-center sm:text-left">
                <h2 className="font-orbitron text-3xl font-bold text-ink neon-text">Ready to start making?</h2>
                <p className="mx-auto mt-3 max-w-md text-ink-dim sm:mx-0">
                  Pick a grade, pick a track, and run your first experiment in seconds.
                </p>
                <Link href="/tracks" className="btn-primary mt-8">🚀 Enter the Labs</Link>
              </div>
              <div className="hidden h-32 w-px bg-line/50 sm:block" aria-hidden />
              <StartQR />
            </div>
          </div>
        </section>
      </CosmicCarousel>
    </>
  );
}
