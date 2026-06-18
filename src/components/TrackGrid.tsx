"use client";

import { SUBJECTS } from "@/lib/subjects";
import { activitiesBySubjectAndBand } from "@/lib/activities/registry";
import { useBand } from "@/lib/bands";
import { useMounted } from "@/lib/progress";
import { SubjectCard } from "@/components/SubjectCard";
import { BandSelector } from "@/components/BandSelector";

export function TrackGrid() {
  const { band, info } = useBand();
  const mounted = useMounted();
  const b = mounted ? band : "explorer";

  return (
    <>
      <BandSelector />
      <p className="mx-auto mb-6 max-w-xl text-center text-sm text-ink-dim">
        <span style={{ color: info.accent }}>{info.classes}:</span> {info.thinking}
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {SUBJECTS.map((s) => (
          <SubjectCard key={s.id} subject={s} activities={activitiesBySubjectAndBand(s.id, b)} />
        ))}
      </div>
    </>
  );
}
