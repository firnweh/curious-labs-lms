"use server";

import { admin } from "@/lib/server/supabaseAdmin";
import { verifyPin } from "@/lib/server/pin";
import { currentParentId } from "@/lib/server/principal";
import { rosterSummaries, studentDetail } from "@/lib/server/studentStats";
import type { StudentSummary, StudentDetail, SimpleResult } from "@/lib/cloud-types";

/**
 * Link a child to the signed-in parent by proving knowledge of the child's own
 * credentials (class code + name + PIN). Read-only link. A parent can link
 * several children; re-linking the same child is a harmless no-op.
 */
export async function linkChild(rawCode: string, rawName: string, pin: string): Promise<SimpleResult> {
  const parentId = await currentParentId();
  if (!parentId) return { ok: false, error: "Sign in as a parent first." };

  const code = rawCode.trim().toUpperCase();
  const name = rawName.trim();
  if (!code) return { ok: false, error: "Enter the class code." };
  if (name.length < 2) return { ok: false, error: "Enter your child's name." };
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "The PIN must be 4 digits." };

  const db = admin();
  const { data: cls } = await db.from("classes").select("id").eq("code", code).maybeSingle();
  if (!cls) return { ok: false, error: "We couldn't find that class code." };

  const key = name.toLowerCase().replace(/\s+/g, " ");
  const { data: student } = await db
    .from("students")
    .select("id, pin_hash")
    .eq("class_id", cls.id)
    .eq("name_key", key)
    .maybeSingle();
  if (!student) return { ok: false, error: "No learner with that name in that class." };
  if (!verifyPin(pin, student.pin_hash)) return { ok: false, error: "That PIN doesn't match." };

  await db.from("parent_links").upsert({ account_id: parentId, student_id: student.id }, { onConflict: "account_id,student_id" });
  return { ok: true };
}

/** Compact stats for every child linked to the signed-in parent. */
export async function getLinkedChildren(): Promise<StudentSummary[]> {
  const parentId = await currentParentId();
  if (!parentId) return [];
  const db = admin();
  const { data: links } = await db.from("parent_links").select("student_id").eq("account_id", parentId);
  const ids = (links ?? []).map((l) => l.student_id);
  if (ids.length === 0) return [];
  const { data: students } = await db
    .from("students")
    .select("id, name, display_name, last_seen")
    .in("id", ids)
    .order("name", { ascending: true });
  return rosterSummaries(students ?? []);
}

/** Full drill-down for a child — only if linked to this parent. */
export async function getStudentDetailForParent(studentId: string): Promise<StudentDetail | null> {
  const parentId = await currentParentId();
  if (!parentId) return null;
  const { data: link } = await admin()
    .from("parent_links")
    .select("student_id")
    .eq("account_id", parentId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!link) return null;
  return studentDetail(studentId);
}
