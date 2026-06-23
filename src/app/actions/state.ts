"use server";

import { admin } from "@/lib/server/supabaseAdmin";
import { getSessionStudentId } from "@/lib/server/session";
import type {
  CloudState,
  CloudProgressEntry,
  CloudCosmetics,
  CloudStreak,
  CloudCreation,
} from "@/lib/cloud-types";

/**
 * All learner state lives behind these actions. Each one re-checks the session
 * (actions are reachable via direct POST), so a learner can only ever read or
 * write their OWN rows — the studentId comes from the signed cookie, never the
 * client payload.
 */

const EMPTY_STREAK: CloudStreak = { current: 0, best: 0, lastDay: "" };
const EMPTY_COSMETICS: CloudCosmetics = { owned: [], equipped: {} };

/** Pull the full cloud snapshot for the signed-in learner (null if signed out). */
export async function pullState(): Promise<CloudState | null> {
  const id = await getSessionStudentId();
  if (!id) return null;
  const db = admin();

  const [student, progressRows, streakRow, cosmeticsRow, creationsRow] = await Promise.all([
    db.from("students").select("name, display_name").eq("id", id).maybeSingle(),
    db.from("progress").select("activity_id, stars, completed_at").eq("student_id", id),
    db.from("streaks").select("current, best, last_day").eq("student_id", id).maybeSingle(),
    db.from("cosmetics").select("owned, equipped").eq("student_id", id).maybeSingle(),
    db.from("creations").select("items").eq("student_id", id).maybeSingle(),
  ]);

  const progress: Record<string, CloudProgressEntry> = {};
  for (const r of progressRows.data ?? []) {
    progress[r.activity_id] = { stars: r.stars, at: new Date(r.completed_at).getTime() };
  }

  return {
    name: student.data?.display_name || student.data?.name || "",
    progress,
    streak: streakRow.data
      ? { current: streakRow.data.current, best: streakRow.data.best, lastDay: streakRow.data.last_day }
      : EMPTY_STREAK,
    cosmetics: cosmeticsRow.data
      ? { owned: cosmeticsRow.data.owned ?? [], equipped: cosmeticsRow.data.equipped ?? {} }
      : EMPTY_COSMETICS,
    creations: (creationsRow.data?.items as CloudCreation[]) ?? [],
  };
}

/** Replace the learner's progress map (idempotent upsert of each completion). */
export async function pushProgress(progress: Record<string, CloudProgressEntry>): Promise<void> {
  const id = await getSessionStudentId();
  if (!id) return;
  const rows = Object.entries(progress).map(([activity_id, p]) => ({
    student_id: id,
    activity_id,
    stars: Math.max(1, Math.min(3, p.stars)) as 1 | 2 | 3,
    completed_at: new Date(p.at || Date.now()).toISOString(),
  }));
  if (rows.length === 0) return;
  await admin().from("progress").upsert(rows, { onConflict: "student_id,activity_id" });
}

export async function pushStreak(streak: CloudStreak): Promise<void> {
  const id = await getSessionStudentId();
  if (!id) return;
  await admin()
    .from("streaks")
    .upsert(
      { student_id: id, current: streak.current, best: streak.best, last_day: streak.lastDay },
      { onConflict: "student_id" },
    );
}

export async function pushCosmetics(cos: CloudCosmetics): Promise<void> {
  const id = await getSessionStudentId();
  if (!id) return;
  await admin()
    .from("cosmetics")
    .upsert({ student_id: id, owned: cos.owned, equipped: cos.equipped }, { onConflict: "student_id" });
}

export async function pushCreations(items: CloudCreation[]): Promise<void> {
  const id = await getSessionStudentId();
  if (!id) return;
  await admin()
    .from("creations")
    .upsert({ student_id: id, items: items.slice(0, 40) }, { onConflict: "student_id" });
}

export async function setDisplayName(name: string): Promise<void> {
  const id = await getSessionStudentId();
  if (!id) return;
  const clean = name.trim().slice(0, 40);
  if (!clean) return; // never let an empty local name clobber a saved one
  await admin().from("students").update({ display_name: clean }).eq("id", id);
}

/** Wipe the learner's progress + streak (the profile "reset" button). */
export async function resetProgress(): Promise<void> {
  const id = await getSessionStudentId();
  if (!id) return;
  const db = admin();
  await Promise.all([
    db.from("progress").delete().eq("student_id", id),
    db.from("streaks").upsert({ student_id: id, current: 0, best: 0, last_day: "" }, { onConflict: "student_id" }),
  ]);
}
