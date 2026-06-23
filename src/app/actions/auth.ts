"use server";

import { admin, isBackendConfigured } from "@/lib/server/supabaseAdmin";
import { hashPin, verifyPin } from "@/lib/server/pin";
import { setSession } from "@/lib/server/session";
import { getStudentInfo } from "@/lib/server/students";
import type { AuthResult } from "@/lib/cloud-types";

function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Learner join. First join with a name CREATES the profile (and sets the PIN);
 * later joins with the same name VERIFY the PIN. Sets the kid session cookie on
 * success. Adults (teachers/parents) use the Supabase-Auth flow in accounts.ts.
 */
export async function joinClass(rawCode: string, rawName: string, pin: string): Promise<AuthResult> {
  if (!isBackendConfigured()) return { ok: false, error: "The backend isn't connected yet — add your Supabase keys to .env.local." };
  const code = rawCode.trim().toUpperCase();
  const name = rawName.trim().slice(0, 40);
  if (!code) return { ok: false, error: "Enter your class code." };
  if (name.length < 2) return { ok: false, error: "Enter your name (at least 2 letters)." };
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "Your PIN must be exactly 4 digits." };

  const db = admin();
  const { data: cls } = await db.from("classes").select("id").eq("code", code).maybeSingle();
  if (!cls) return { ok: false, error: "We couldn't find that class code." };

  const key = nameKey(name);
  const { data: existing } = await db
    .from("students")
    .select("id, pin_hash")
    .eq("class_id", cls.id)
    .eq("name_key", key)
    .maybeSingle();

  let studentId: string;
  if (existing) {
    if (!verifyPin(pin, existing.pin_hash)) {
      return { ok: false, error: "That PIN doesn't match. Try again." };
    }
    studentId = existing.id;
    await db.from("students").update({ last_seen: new Date().toISOString() }).eq("id", studentId);
  } else {
    const { data: created, error } = await db
      .from("students")
      .insert({ class_id: cls.id, name, name_key: key, display_name: name, pin_hash: hashPin(pin) })
      .select("id")
      .maybeSingle();
    if (error || !created) return { ok: false, error: "Could not create your profile. Try again." };
    studentId = created.id;
  }

  await setSession(studentId);
  const student = await getStudentInfo(studentId);
  return student ? { ok: true, student } : { ok: false, error: "Signed in, but couldn't load your profile." };
}
