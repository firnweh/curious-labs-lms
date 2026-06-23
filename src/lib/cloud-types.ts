/**
 * Shared shapes for cloud sync. No "use client"/"use server" directive so both
 * the server actions and the client bridge can import these types freely.
 * Mirrors the localStorage stores in progress.ts / cosmetics.ts / creations.ts.
 */
import type { SubjectId } from "@/lib/activities/types";

export interface CloudProgressEntry {
  stars: number;
  at: number; // ms epoch
}

export interface CloudCreation {
  id: string;
  name: string;
  kind: "pixel";
  w: number;
  h: number;
  palette: string[];
  cells: number[];
  at: number;
}

export interface CloudStreak {
  current: number;
  best: number;
  lastDay: string; // 'YYYY-MM-DD'
}

export interface CloudCosmetics {
  owned: string[];
  equipped: Record<string, string>;
}

/** Everything that syncs for one learner. */
export interface CloudState {
  name: string;
  progress: Record<string, CloudProgressEntry>;
  streak: CloudStreak;
  cosmetics: CloudCosmetics;
  creations: CloudCreation[];
}

/** Public info about the signed-in learner (safe to send to the client). */
export interface StudentInfo {
  id: string;
  name: string;
  displayName: string;
  classCode: string;
  className: string;
}

/** Result of a join/login attempt. */
export type AuthResult =
  | { ok: true; student: StudentInfo }
  | { ok: false; error: string };

/* ── Roles: teachers & parents (adults, via Supabase Auth) ─────────────── */

export type AdultRole = "teacher" | "parent";

export interface AccountInfo {
  id: string;
  email: string;
  name: string;
  role: AdultRole;
}

/** Who's signed in — a learner, a teacher, or a parent. */
export type Principal =
  | { kind: "student"; student: StudentInfo }
  | { kind: "teacher"; account: AccountInfo }
  | { kind: "parent"; account: AccountInfo };

export type SimpleResult = { ok: true } | { ok: false; error: string };

/** A class as seen by its owning teacher. */
export interface ClassInfo {
  id: string;
  code: string;
  name: string;
  studentCount: number;
  createdAt: string;
}

/** Compact per-learner stats for rosters / child cards. */
export interface StudentSummary {
  id: string;
  name: string;
  displayName: string;
  labsDone: number;
  totalLabs: number;
  totalStars: number;
  streakCurrent: number;
  lastActive: string | null; // ISO timestamp
}

export interface SubjectProgress {
  subject: SubjectId;
  name: string;
  done: number;
  total: number;
  stars: number;
}

/** Full drill-down for one learner (teacher/parent detail view). */
export interface StudentDetail extends StudentSummary {
  className: string;
  classCode: string;
  perSubject: SubjectProgress[];
  recent: { activityId: string; title: string; subject: SubjectId; stars: number; at: string }[];
}

/** A class plus its roster (teacher view). */
export interface ClassRoster {
  id: string;
  code: string;
  name: string;
  students: StudentSummary[];
}
