"use client";

import dynamic from "next/dynamic";

/**
 * Lazy wrappers for the studio-intro slides. HeroIntro.jsx is ~2.2k lines, and
 * these are carousel slides 2–5 (not the first thing on screen), so we split
 * them into their own chunk loaded after the initial paint — shrinking the
 * homepage's first-load JS. ssr:false keeps them out of the server HTML too.
 */
function Loading() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <span className="font-mono text-xs tracking-tech text-ink-faint">loading…</span>
    </div>
  );
}

export const HeroIntro3D = dynamic(() => import("@/components/HeroIntro").then((m) => m.HeroIntro3D), { ssr: false, loading: Loading });
export const HeroIntroRobotics = dynamic(() => import("@/components/HeroIntro").then((m) => m.HeroIntroRobotics), { ssr: false, loading: Loading });
export const HeroIntroAI = dynamic(() => import("@/components/HeroIntro").then((m) => m.HeroIntroAI), { ssr: false, loading: Loading });
export const HeroIntroWeb = dynamic(() => import("@/components/HeroIntro").then((m) => m.HeroIntroWeb), { ssr: false, loading: Loading });
