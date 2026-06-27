"use client";

import { useMemo } from "react";
import { ACTIVITIES, activitiesBySubject } from "@/lib/activities/registry";
import { SUBJECTS } from "@/lib/subjects";
import type { SubjectId } from "@/lib/activities/types";
import { useProgress, useStreak, type ProgressStore } from "@/lib/progress";

export const XP_PER_STAR = 100;

/** Kid-friendly level ladder. Finishing all current labs (3★ each) reaches the top. */
export const LEVELS = [
  { min: 0, title: "Spark", emoji: "✨" },
  { min: 150, title: "Tinkerer", emoji: "🔧" },
  { min: 400, title: "Maker", emoji: "🛠️" },
  { min: 700, title: "Builder", emoji: "🧱" },
  { min: 1100, title: "Inventor", emoji: "💡" },
  { min: 1500, title: "Engineer", emoji: "⚙️" },
  { min: 2000, title: "Innovator", emoji: "🚀" },
  { min: 2400, title: "Mastermind", emoji: "🧠" },
] as const;

export interface LevelInfo {
  index: number; // 1-based level number
  title: string;
  emoji: string;
  xpIntoLevel: number;
  xpForLevel: number; // span of the current level (0 if maxed)
  pct: number; // 0–100 progress to next level
  isMax: boolean;
  nextTitle: string | null;
}

export function levelForXp(xp: number): LevelInfo {
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k].min) i = k;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  const isMax = !next;
  const span = isMax ? 0 : next.min - cur.min;
  const into = xp - cur.min;
  return {
    index: i + 1,
    title: cur.title,
    emoji: cur.emoji,
    xpIntoLevel: into,
    xpForLevel: span,
    pct: isMax ? 100 : Math.min(100, Math.round((into / span) * 100)),
    isMax,
    nextTitle: next?.title ?? null,
  };
}

export interface GameContext {
  store: ProgressStore;
  completedIds: string[];
  fullStarCount: number;
  subjectsTouched: SubjectId[];
  subjectsCompletedFully: SubjectId[];
  conceptsCovered: Set<string>;
  streak: number;
}

export function buildContext(store: ProgressStore, streakCurrent: number): GameContext {
  const completedIds = Object.keys(store);
  const completed = new Set(completedIds);
  const fullStarCount = completedIds.filter((id) => store[id].stars >= 3).length;

  const conceptsCovered = new Set<string>();
  for (const a of ACTIVITIES) {
    if (completed.has(a.id)) a.concepts.forEach((c) => conceptsCovered.add(c));
  }

  const subjectsTouched: SubjectId[] = [];
  const subjectsCompletedFully: SubjectId[] = [];
  for (const s of SUBJECTS) {
    const labs = activitiesBySubject(s.id);
    const done = labs.filter((l) => completed.has(l.id)).length;
    if (done > 0) subjectsTouched.push(s.id);
    if (labs.length > 0 && done === labs.length) subjectsCompletedFully.push(s.id);
  }

  return { store, completedIds, fullStarCount, subjectsTouched, subjectsCompletedFully, conceptsCovered, streak: streakCurrent };
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  test: (c: GameContext) => boolean;
}

export const BADGES: Badge[] = [
  { id: "first-steps", name: "First Steps", emoji: "🌟", desc: "Complete your first lab", test: (c) => c.completedIds.length >= 1 },
  { id: "explorer", name: "Explorer", emoji: "🧭", desc: "Try all four subjects", test: (c) => c.subjectsTouched.length >= 4 },
  { id: "loop-wizard", name: "Loop Wizard", emoji: "🌀", desc: "Master loops in code", test: (c) => c.conceptsCovered.has("loops") },
  { id: "circuit-smith", name: "Circuit Smith", emoji: "⚡", desc: "Build a working circuit", test: (c) => c.conceptsCovered.has("circuits") },
  { id: "data-trainer", name: "Data Trainer", emoji: "🧪", desc: "Train an AI model", test: (c) => c.conceptsCovered.has("training data") || c.conceptsCovered.has("classification") },
  { id: "coding-master", name: "Code Master", emoji: "💻", desc: "Finish every Coding lab", test: (c) => c.subjectsCompletedFully.includes("coding") },
  { id: "robotics-master", name: "Robo Master", emoji: "🤖", desc: "Finish every Robotics lab", test: (c) => c.subjectsCompletedFully.includes("robotics") },
  { id: "ai-master", name: "AI Master", emoji: "🧠", desc: "Finish every AI lab", test: (c) => c.subjectsCompletedFully.includes("ai") },
  { id: "threed-master", name: "3D Master", emoji: "🧊", desc: "Finish every 3D lab", test: (c) => c.subjectsCompletedFully.includes("threed") },
  { id: "perfectionist", name: "Perfectionist", emoji: "⭐", desc: "Earn 3 stars on 5 labs", test: (c) => c.fullStarCount >= 5 },
  { id: "streak-3", name: "On Fire", emoji: "🔥", desc: "Practise 3 days in a row", test: (c) => c.streak >= 3 },
  { id: "streak-7", name: "Unstoppable", emoji: "☄️", desc: "Practise 7 days in a row", test: (c) => c.streak >= 7 },
  { id: "completionist", name: "Completionist", emoji: "🏆", desc: "Complete every lab", test: (c) => c.completedIds.length >= ACTIVITIES.length },
];

/** Returns the set of earned badge ids. Pure — used for before/after diffing. */
export function earnedBadgeIds(store: ProgressStore, streakCurrent: number): Set<string> {
  const ctx = buildContext(store, streakCurrent);
  return new Set(BADGES.filter((b) => b.test(ctx)).map((b) => b.id));
}

export interface SubjectStat {
  id: SubjectId;
  total: number;
  done: number;
  stars: number;
  maxStars: number;
  pct: number;
}

export interface GameStats {
  xp: number;
  totalStars: number;
  completedCount: number;
  totalLabs: number;
  level: LevelInfo;
  streak: number;
  bestStreak: number;
  perSubject: SubjectStat[];
  badges: (Badge & { earned: boolean })[];
  earnedCount: number;
}

export function computeStats(store: ProgressStore, streak: { current: number; best: number }): GameStats {
  const completedIds = Object.keys(store);
  const totalStars = completedIds.reduce((n, id) => n + (store[id]?.stars ?? 0), 0);
  const xp = totalStars * XP_PER_STAR;
  const ctx = buildContext(store, streak.current);
  const earned = new Set(BADGES.filter((b) => b.test(ctx)).map((b) => b.id));

  const perSubject: SubjectStat[] = SUBJECTS.map((s) => {
    const labs = activitiesBySubject(s.id);
    const mine = labs.filter((l) => store[l.id]);
    const stars = mine.reduce((n, l) => n + store[l.id].stars, 0);
    const maxStars = labs.length * 3;
    return {
      id: s.id,
      total: labs.length,
      done: mine.length,
      stars,
      maxStars,
      pct: labs.length ? Math.round((mine.length / labs.length) * 100) : 0,
    };
  });

  return {
    xp,
    totalStars,
    completedCount: completedIds.length,
    totalLabs: ACTIVITIES.length,
    level: levelForXp(xp),
    streak: streak.current,
    bestStreak: streak.best,
    perSubject,
    badges: BADGES.map((b) => ({ ...b, earned: earned.has(b.id) })),
    earnedCount: earned.size,
  };
}

/** Reactive game stats derived from the local progress + streak stores. */
export function useGameStats(): GameStats {
  const { store } = useProgress();
  const streak = useStreak();
  return useMemo(() => computeStats(store, streak), [store, streak]);
}
