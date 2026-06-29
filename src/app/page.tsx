"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MakerspaceStats from "@/components/MakerspaceStats";
import { CosmosFX } from "@/components/CosmosFX";
import { CinematicHero } from "@/components/CinematicHero";
import { CosmicCarousel } from "@/components/CosmicCarousel";
import { HeroIntro3D, HeroIntroRobotics, HeroIntroAI, HeroIntroWeb } from "@/components/HeroIntroLazy";
import { StartQR } from "@/components/StartQR";

// 7 slides on desktop: Home, the 4 studio-intro films, Stats, and the launch CTA.
// Labels/sectors stay index-aligned with the children below.
const SLIDE_LABELS = ["Home", "3D Modelling", "Robotics", "AI", "Web Dev", "Stats", "Get Started"];
const SLIDE_SECTORS = ["LAUNCH PAD", "MODEL BAY", "ROBOTICS BAY", "NEURAL CORE", "WEB FORGE", "TELEMETRY", "DOCKING BAY"];

// On phones the 4 studio-intro films are skipped — they're fixed-coordinate
// desktop animations that don't fit a narrow screen. Mobile gets a lean
// Hero → Stats → Get Started carousel instead.
const MOBILE_LABELS = ["Home", "Stats", "Get Started"];
const MOBILE_SECTORS = ["LAUNCH PAD", "TELEMETRY", "DOCKING BAY"];

export default function Home() {
  // Default to desktop so SSR and the first client render match; switch after
  // mount once we can read the viewport.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <>
      <CosmosFX />
      <CosmicCarousel
        labels={isMobile ? MOBILE_LABELS : SLIDE_LABELS}
        sectors={isMobile ? MOBILE_SECTORS : SLIDE_SECTORS}
      >
        {/* 1 — Hero (responsive on every screen) */}
        <CinematicHero />

        {/* 2–5 — Studio intro films: desktop only */}
        {!isMobile && <HeroIntro3D />}
        {!isMobile && <HeroIntroRobotics />}
        {!isMobile && <HeroIntroAI />}
        {!isMobile && <HeroIntroWeb />}

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
                <Link href="/tracks" className="btn-primary mt-8">🚀 Explore your areas</Link>
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
