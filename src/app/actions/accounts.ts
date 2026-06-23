"use server";

import { admin, isBackendConfigured } from "@/lib/server/supabaseAdmin";
import { supabaseServer } from "@/lib/server/supabaseServer";
import { resolvePrincipal } from "@/lib/server/principal";
import { clearSession } from "@/lib/server/session";
import type { Principal, AdultRole } from "@/lib/cloud-types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Teacher / parent sign-up. Creates a confirmed Supabase-Auth user via the
 * admin API (so it works without configuring SMTP — flip to verified e-mail
 * later in the dashboard), records the app-level role in `accounts`, then
 * establishes the session.
 */
export async function signUpAdult(
  email: string,
  password: string,
  name: string,
  role: AdultRole,
): Promise<{ ok: true; role: AdultRole } | { ok: false; error: string }> {
  if (!isBackendConfigured()) return { ok: false, error: "The backend isn't connected yet." };
  email = email.trim().toLowerCase();
  name = name.trim().slice(0, 60);
  if (role !== "teacher" && role !== "parent") return { ok: false, error: "Pick teacher or parent." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < 8) return { ok: false, error: "Use a password of at least 8 characters." };
  if (name.length < 2) return { ok: false, error: "Enter your name." };

  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });
  if (error || !data.user) {
    const dup = (error?.message || "").toLowerCase().includes("already");
    return { ok: false, error: dup ? "That email already has an account — sign in instead." : "Could not create the account." };
  }

  await admin().from("accounts").upsert({ id: data.user.id, email, name, role }, { onConflict: "id" });

  const sb = await supabaseServer();
  const { error: signErr } = await sb.auth.signInWithPassword({ email, password });
  if (signErr) return { ok: false, error: "Account created — please sign in." };
  return { ok: true, role };
}

/** Teacher / parent sign-in. */
export async function signInAdult(
  email: string,
  password: string,
): Promise<{ ok: true; role: AdultRole } | { ok: false; error: string }> {
  if (!isBackendConfigured()) return { ok: false, error: "The backend isn't connected yet." };
  email = email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, error: "Wrong email or password." };

  const { data: acct } = await admin().from("accounts").select("role").eq("id", data.user.id).maybeSingle();
  return { ok: true, role: (acct?.role as AdultRole) ?? "teacher" };
}

/** Who's signed in (student | teacher | parent | null). Client-facing. */
export async function getPrincipal(): Promise<Principal | null> {
  return resolvePrincipal();
}

/** Sign out of whichever session is active (adult and/or kid). */
export async function signOutAll(): Promise<void> {
  try {
    const sb = await supabaseServer();
    await sb.auth.signOut();
  } catch {
    // no adult session
  }
  try {
    await clearSession();
  } catch {
    // no kid session
  }
}
