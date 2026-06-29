"use client";

import { SUBJECTS } from "@/lib/subjects";
import { useBand } from "@/lib/bands";
import { SubjectCard } from "@/components/SubjectCard";
import { BandSelector } from "@/components/BandSelector";

export function TrackGrid() {
  const { info } = useBand();

  return (
    <>
      <BandSelector />
      <p className="mx-auto mb-6 max-w-xl text-center text-sm text-ink-dim">
        <span style={{ color: info.accent }}>{info.classes}:</span> {info.thinking}
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {SUBJECTS.map((s, i) => (
          <SubjectCard key={s.id} subject={s} index={i} />
        ))}
      </div>
    </>
  );
}
