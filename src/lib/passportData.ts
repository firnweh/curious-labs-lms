"use client";

import { buildContext, computeStats, type SubjectStat } from "@/lib/gamification";
import { activitiesBySubject } from "@/lib/activities/registry";
import { SUBJECTS, SUBJECT_MAP, type Subject } from "@/lib/subjects";
import type { ProgressStore } from "@/lib/progress";

/** Title-case a concept tag: "training data" → "Training Data". */
export const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export interface PassportData {
  holderName: string;
  classLine: string | null;
  avatar: string;
  passportId: string;
  since: string;
  level: { index: number; title: string; emoji: string };
  xp: number;
  totalSkills: number;
  labsBuilt: number;
  certCount: number;
  badgeCount: number;
  skillGroups: { subject: Subject; skills: string[] }[];
  perSubject: SubjectStat[];
  certs: Subject[];
  earnedBadges: { id: string; name: string; emoji: string; desc: string }[];
}

export interface PassportIdentity {
  holderName: string;
  classLine: string | null;
  avatar: string;
  passportId: string;
  since: string;
}

/**
 * Derive the full passport view-model from a progress store. Shared by the
 * live passport (store from hooks) and the verified passport (store rebuilt
 * from a signed token), so both render identically.
 */
export function buildPassportData(
  store: ProgressStore,
  streakCurrent: number,
  identity: PassportIdentity,
): PassportData {
  const stats = computeStats(store, { current: streakCurrent, best: streakCurrent });
  const ctx = buildContext(store, streakCurrent);

  const skillGroups = SUBJECTS.map((s) => {
    const set = new Set<string>();
    for (const l of activitiesBySubject(s.id)) {
      if (store[l.id]) l.concepts.forEach((c) => set.add(c));
    }
    return { subject: s, skills: [...set].sort() };
  }).filter((g) => g.skills.length > 0);

  const certs = ctx.subjectsCompletedFully.map((id) => SUBJECT_MAP[id]);
  const earnedBadges = stats.badges
    .filter((b) => b.earned)
    .map((b) => ({ id: b.id, name: b.name, emoji: b.emoji, desc: b.desc }));

  return {
    ...identity,
    level: { index: stats.level.index, title: stats.level.title, emoji: stats.level.emoji },
    xp: stats.xp,
    totalSkills: ctx.conceptsCovered.size,
    labsBuilt: stats.completedCount,
    certCount: certs.length,
    badgeCount: earnedBadges.length,
    skillGroups,
    perSubject: stats.perSubject,
    certs,
    earnedBadges,
  };
}

/** Deterministic short passport id from a stable seed (djb2). */
export function passportId(seed: string) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  const s = h.toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
  return `CL-${s.slice(0, 3)}-${s.slice(3, 6)}`;
}
