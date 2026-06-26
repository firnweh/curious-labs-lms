import type { Metadata } from "next";
import { SUBJECTS } from "@/lib/subjects";
import { ACTIVITIES } from "@/lib/activities/registry";
import { TrackGrid } from "@/components/TrackGrid";
import { TracksIntro } from "@/components/TracksIntro";
import { HomeBackground } from "@/components/HomeBackground";
import { BandAmbiance } from "@/components/BandAmbiance";

export const metadata: Metadata = {
  title: "Tracks — Curious Labs",
  description:
    "Pick your class level and dive into coding, robotics, AI or 3D modelling — hands-on browser labs for grades 1–10.",
};

export default function TracksPage() {
  return (
    <div className="relative mx-auto max-w-6xl px-5 py-10">
      <HomeBackground />
      <BandAmbiance />

      <div className="relative z-10">
        <TracksIntro labs={ACTIVITIES.length} tracks={SUBJECTS.length} />

        <TrackGrid />
      </div>
    </div>
  );
}
