import type { Metadata } from "next";
import { SUBJECTS } from "@/lib/subjects";
import { ACTIVITIES } from "@/lib/activities/registry";
import { TrackGrid } from "@/components/TrackGrid";
import { HomeBackground } from "@/components/HomeBackground";

export const metadata: Metadata = {
  title: "Tracks — Curious Labs",
  description:
    "Pick your class level and dive into coding, robotics, AI or 3D modelling — hands-on browser labs for grades 1–10.",
};

export default function TracksPage() {
  return (
    <div className="relative mx-auto max-w-6xl px-5 py-10">
      <HomeBackground />

      <div className="relative z-10">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs tracking-tech text-ink-faint">EXPLORE THE LABS</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl neon-text">
            Choose your track
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-ink-dim">
            Pick your class, then dive into a world of making — {ACTIVITIES.length} live labs
            across {SUBJECTS.length} tracks.
          </p>
        </div>

        <TrackGrid />
      </div>
    </div>
  );
}
