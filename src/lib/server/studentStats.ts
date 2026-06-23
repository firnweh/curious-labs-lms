import "server-only";
import { admin } from "./supabaseAdmin";
import { ACTIVITIES } from "@/lib/activities/registry";
import { SUBJECT_MAP } from "@/lib/subjects";
import type { SubjectId } from "@/lib/activities/types";
import type { StudentSummary, StudentDetail, SubjectProgress } from "@/lib/cloud-types";

// Built once at module load from the static registry — server-safe data only.
const META = new Map(ACTIVITIES.map((a) => [a.id, { subject: a.subject, title: a.title }]));
const TOTAL_LABS = ACTIVITIES.length;
const SUBJECT_IDS = Object.keys(SUBJECT_MAP) as SubjectId[];
const SUBJECT_TOTALS: Record<string, number> = {};
for (const a of ACTIVITIES) SUBJECT_TOTALS[a.subject] = (SUBJECT_TOTALS[a.subject] ?? 0) + 1;

type ProgRow = { student_id?: string; activity_id: string; stars: number; completed_at: string };
type StudentRow = { id: string; name: string; display_name: string | null; last_seen: string | null };

/** Compact stats for many learners at once (rosters / child cards) — 2 queries. */
export async function rosterSummaries(students: StudentRow[]): Promise<StudentSummary[]> {
  if (students.length === 0) return [];
  const ids = students.map((s) => s.id);
  const db = admin();
  const [{ data: prog }, { data: streaks }] = await Promise.all([
    db.from("progress").select("student_id, activity_id, stars, completed_at").in("student_id", ids),
    db.from("streaks").select("student_id, current").in("student_id", ids),
  ]);

  const agg = new Map<string, { done: number; stars: number; last: string | null }>();
  for (const r of (prog as ProgRow[]) ?? []) {
    const a = agg.get(r.student_id!) ?? { done: 0, stars: 0, last: null };
    a.done += 1;
    a.stars += r.stars;
    if (!a.last || r.completed_at > a.last) a.last = r.completed_at;
    agg.set(r.student_id!, a);
  }
  const streakMap = new Map((streaks ?? []).map((s) => [s.student_id, s.current]));

  return students.map((s) => {
    const a = agg.get(s.id);
    return {
      id: s.id,
      name: s.name,
      displayName: s.display_name || s.name,
      labsDone: a?.done ?? 0,
      totalLabs: TOTAL_LABS,
      totalStars: a?.stars ?? 0,
      streakCurrent: streakMap.get(s.id) ?? 0,
      lastActive: a?.last ?? s.last_seen ?? null,
    };
  });
}

/** Full drill-down for one learner: per-subject breakdown + recent activity. */
export async function studentDetail(studentId: string): Promise<StudentDetail | null> {
  const db = admin();
  const { data: student } = await db
    .from("students")
    .select("id, name, display_name, last_seen, classes(code, name)")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return null;

  const [{ data: prog }, { data: streak }] = await Promise.all([
    db.from("progress").select("activity_id, stars, completed_at").eq("student_id", studentId),
    db.from("streaks").select("current").eq("student_id", studentId).maybeSingle(),
  ]);
  const rows = (prog as ProgRow[]) ?? [];

  const perSubject: SubjectProgress[] = SUBJECT_IDS.map((id) => ({
    subject: id,
    name: SUBJECT_MAP[id].name,
    done: 0,
    total: SUBJECT_TOTALS[id] ?? 0,
    stars: 0,
  }));
  const bySubject = new Map(perSubject.map((p) => [p.subject, p]));

  let totalStars = 0;
  let last: string | null = null;
  for (const r of rows) {
    totalStars += r.stars;
    if (!last || r.completed_at > last) last = r.completed_at;
    const m = META.get(r.activity_id);
    if (m) {
      const p = bySubject.get(m.subject);
      if (p) {
        p.done += 1;
        p.stars += r.stars;
      }
    }
  }

  const recent = [...rows]
    .sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1))
    .slice(0, 8)
    .map((r) => {
      const m = META.get(r.activity_id);
      return {
        activityId: r.activity_id,
        title: m?.title ?? r.activity_id,
        subject: (m?.subject ?? "coding") as SubjectId,
        stars: r.stars,
        at: r.completed_at,
      };
    });

  const cls = Array.isArray(student.classes) ? student.classes[0] : student.classes;
  return {
    id: student.id,
    name: student.name,
    displayName: student.display_name || student.name,
    labsDone: rows.length,
    totalLabs: TOTAL_LABS,
    totalStars,
    streakCurrent: streak?.current ?? 0,
    lastActive: last ?? student.last_seen ?? null,
    className: cls?.name ?? "",
    classCode: cls?.code ?? "",
    perSubject,
    recent,
  };
}
