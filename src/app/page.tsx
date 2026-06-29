"use client";

import { useEffect, useState } from "react";
import MakerspaceStats from "@/components/MakerspaceStats";
import { CosmosFX } from "@/components/CosmosFX";
import { CinematicHero } from "@/components/CinematicHero";
import { CosmicCarousel } from "@/components/CosmicCarousel";
import { HeroIntro3D, HeroIntroRobotics, HeroIntroAI, HeroIntroWeb } from "@/components/HeroIntroLazy";
import { MissionConsole } from "@/components/MissionConsole";

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

        {/* 7 — Mission-launch console */}
        <MissionConsole />
      </CosmicCarousel>
    </>
  );
}
