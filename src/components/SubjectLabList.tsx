"use client";

import { activitiesBySubjectAndBand } from "@/lib/activities/registry";
import { useBand } from "@/lib/bands";
import { useMounted } from "@/lib/progress";
import { ActivityCard } from "@/components/ActivityCard";
import { BandSelector } from "@/components/BandSelector";
import type { SubjectId } from "@/lib/activities/types";

export function SubjectLabList({ subject }: { subject: SubjectId }) {
  const { band, info } = useBand();
  const mounted = useMounted();
  const b = mounted ? band : "explorer";
  const labs = activitiesBySubjectAndBand(subject, b);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs tracking-tech text-ink-faint">
          {info.classes.toUpperCase()} · {labs.length} LAB{labs.length === 1 ? "" : "S"}
        </p>
        <BandSelector compact />
      </div>

      {labs.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-4xl">✨</p>
          <p className="mt-3 font-display text-lg text-ink">New labs coming soon for {info.classes}</p>
          <p className="mt-1 text-sm text-ink-faint">Pick another class level above to keep exploring.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {labs.map((meta, i) => (
            <ActivityCard key={meta.id} meta={meta} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
