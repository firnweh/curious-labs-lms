import "server-only";
import { admin, isBackendConfigured } from "./supabaseAdmin";
import { supabaseServer } from "./supabaseServer";
import { getSessionStudentId } from "./session";
import { getStudentInfo } from "./students";
import type { Principal } from "@/lib/cloud-types";

/**
 * The single source of truth for "who is this request?". Checks the adult
 * Supabase-Auth session first, then falls back to the kid PIN cookie. Used by
 * getPrincipal() (the client-facing action) and by every teacher/parent action
 * for authorization — so identity is always server-verified, never trusted
 * from the client.
 */
export async function resolvePrincipal(): Promise<Principal | null> {
  if (!isBackendConfigured()) return null;

  // Adult (teacher / parent) — Supabase Auth.
  try {
    const sb = await supabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (user) {
      const { data: acct } = await admin()
        .from("accounts")
        .select("id, email, name, role")
        .eq("id", user.id)
        .maybeSingle();
      if (acct && (acct.role === "teacher" || acct.role === "parent")) {
        return {
          kind: acct.role,
          account: { id: acct.id, email: acct.email || user.email || "", name: acct.name || "", role: acct.role },
        };
      }
    }
  } catch {
    // no adult session — fall through to the student check
  }

  // Learner — custom PIN cookie.
  const sid = await getSessionStudentId();
  if (sid) {
    const student = await getStudentInfo(sid);
    if (student) return { kind: "student", student };
  }
  return null;
}

/** Account id iff the caller is a signed-in teacher (else null). */
export async function currentTeacherId(): Promise<string | null> {
  const p = await resolvePrincipal();
  return p?.kind === "teacher" ? p.account.id : null;
}

/** Account id iff the caller is a signed-in parent (else null). */
export async function currentParentId(): Promise<string | null> {
  const p = await resolvePrincipal();
  return p?.kind === "parent" ? p.account.id : null;
}
