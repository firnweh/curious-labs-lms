import type { ActivityMeta, Band, SubjectId } from "./types";

/**
 * Metadata for every activity. This is plain data (server-safe) so route
 * pages can list/sort activities without pulling in the client-only
 * component bundles. The actual interactive components are wired in
 * `componentMap.ts` and loaded lazily, client-side only.
 */
export const ACTIVITIES: ActivityMeta[] = [];

export const ACTIVITY_IDS = ACTIVITIES.map((a) => a.id);

export function getActivityMeta(id: string): ActivityMeta | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}

export function activitiesBySubject(subject: SubjectId): ActivityMeta[] {
  return ACTIVITIES.filter((a) => a.subject === subject);
}

export function activitiesBySubjectAndBand(subject: SubjectId, band: Band): ActivityMeta[] {
  return ACTIVITIES.filter((a) => a.subject === subject && a.band === band);
}

export function activitiesByBand(band: Band): ActivityMeta[] {
  return ACTIVITIES.filter((a) => a.band === band);
}

export function bandHasContent(band: Band): boolean {
  return ACTIVITIES.some((a) => a.band === band);
}

/** Activities tied to a specific curriculum grade (1–10), in project order. */
export function activitiesByGrade(grade: number): ActivityMeta[] {
  return ACTIVITIES.filter((a) => a.grade === grade).sort(
    (a, b) => (a.projectNo ?? 0) - (b.projectNo ?? 0),
  );
}

/** Sorted list of grades (1–10) that currently have curriculum labs built. */
export function gradesWithContent(): number[] {
  const set = new Set<number>();
  for (const a of ACTIVITIES) if (typeof a.grade === "number") set.add(a.grade);
  return [...set].sort((x, y) => x - y);
}
