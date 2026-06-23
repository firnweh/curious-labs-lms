import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client bound to the request cookies — used for ADULT (teacher /
 * parent) auth via Supabase Auth. Reads/writes the sb-* auth cookies through
 * Next's async cookie store. Kids never use this (they have the custom PIN
 * session); adults get password reset, verification, OAuth-later for free.
 */
export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase auth env not configured");

  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // setAll called from a Server Component render — safe to ignore;
          // the session is refreshed by the next action/route handler.
        }
      },
    },
  });
}
