"use server";

import { admin } from "@/lib/server/supabaseAdmin";
import { currentTeacherId } from "@/lib/server/principal";
import { rosterSummaries, studentDetail } from "@/lib/server/studentStats";
import { randomInt } from "node:crypto";
import type { ClassInfo, ClassRoster, StudentDetail } from "@/lib/cloud-types";

const CODE_WORDS = [
  "SPARK", "NOVA", "ORBIT", "ROBOT", "PIXEL", "ATOM", "LASER", "COMET",
  "CIRCUIT", "QUANTUM", "ROCKET", "NEON", "CYBER", "LOGIC", "BYTE", "PULSE",
];
const genCode = () => `${CODE_WORDS[randomInt(CODE_WORDS.length)]}-${randomInt(1000, 10000)}`;

/** Create a class owned by the signed-in teacher; returns the shareable code. */
export async function createClass(
  rawName: string,
): Promise<{ ok: true; code: string; name: string } | { ok: false; error: string }> {
  const teacherId = await currentTeacherId();
  if (!teacherId) return { ok: false, error: "Sign in as a teacher first." };
  const name = rawName.trim().slice(0, 60) || "My Class";
  const db = admin();
  for (let i = 0; i < 6; i++) {
    const code = genCode();
    const { data, error } = await db
      .from("classes")
      .insert({ code, name, owner_account_id: teacherId })
      .select("code")
      .maybeSingle();
    if (data) return { ok: true, code: data.code, name };
    if (error && error.code !== "23505") return { ok: false, error: "Could not create the class." };
  }
  return { ok: false, error: "Could not generate a unique code — try again." };
}

/** All classes owned by the signed-in teacher, with student counts. */
export async function getTeacherClasses(): Promise<ClassInfo[]> {
  const teacherId = await currentTeacherId();
  if (!teacherId) return [];
  const db = admin();
  const { data: classes } = await db
    .from("classes")
    .select("id, code, name, created_at")
    .eq("owner_account_id", teacherId)
    .order("created_at", { ascending: true });
  if (!classes || classes.length === 0) return [];

  const ids = classes.map((c) => c.id);
  const { data: students } = await db.from("students").select("id, class_id").in("class_id", ids);
  const counts = new Map<string, number>();
  for (const s of students ?? []) counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1);

  return classes.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    studentCount: counts.get(c.id) ?? 0,
    createdAt: c.created_at,
  }));
}

/** Roster + per-learner stats for one class the teacher owns. */
export async function getClassRoster(classId: string): Promise<ClassRoster | null> {
  const teacherId = await currentTeacherId();
  if (!teacherId) return null;
  const db = admin();
  const { data: cls } = await db
    .from("classes")
    .select("id, code, name, owner_account_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || cls.owner_account_id !== teacherId) return null; // not yours → nothing

  const { data: students } = await db
    .from("students")
    .select("id, name, display_name, last_seen")
    .eq("class_id", classId)
    .order("name", { ascending: true });
  const summaries = await rosterSummaries(students ?? []);
  return { id: cls.id, code: cls.code, name: cls.name, students: summaries };
}

/** Full drill-down for one learner — only if they're in a class the teacher owns. */
export async function getStudentDetailForTeacher(studentId: string): Promise<StudentDetail | null> {
  const teacherId = await currentTeacherId();
  if (!teacherId) return null;
  const { data: s } = await admin()
    .from("students")
    .select("id, classes(owner_account_id)")
    .eq("id", studentId)
    .maybeSingle();
  if (!s) return null;
  const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
  if (!cls || cls.owner_account_id !== teacherId) return null;
  return studentDetail(studentId);
}
