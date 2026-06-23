"use client";

import Link from "next/link";
import { useSession } from "@/components/SessionProvider";
import { useCosmetics } from "@/lib/cosmetics";

/**
 * Right-side header state. Signed out → Login. Signed in → a chip linking to the
 * right home for the role (learner → profile, teacher → /teacher, parent →
 * /parent) plus a sign-out control.
 */
export function HeaderAuth() {
  const { principal, loading, signOut } = useSession();
  const cos = useCosmetics();

  if (loading) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-line/30" aria-hidden />;
  }

  if (!principal) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-neon-cyan/50 bg-neon-cyan/10 px-5 py-2 font-mono text-sm font-semibold tracking-tech text-neon-cyan transition-colors hover:border-neon-cyan hover:bg-neon-cyan/20"
      >
        Login
      </Link>
    );
  }

  let href = "/profile";
  let glyph = cos.equipped.avatar.value;
  let label: string;
  if (principal.kind === "student") {
    label = (principal.student.displayName || principal.student.name).trim().split(/\s+/)[0];
  } else if (principal.kind === "teacher") {
    href = "/teacher";
    glyph = "🧑‍🏫";
    label = (principal.account.name || "Teacher").trim().split(/\s+/)[0];
  } else {
    href = "/parent";
    glyph = "👪";
    label = (principal.account.name || "Parent").trim().split(/\s+/)[0];
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={href}
        className="flex items-center gap-2 rounded-full border border-line bg-panel/60 py-1.5 pl-2 pr-3.5 transition-colors hover:border-neon-cyan/50"
        title={principal.kind === "student" ? "Your profile" : "Your dashboard"}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-neon-cyan/10 text-base">{glyph}</span>
        <span className="max-w-[7rem] truncate text-sm font-medium text-ink">{label}</span>
      </Link>
      <button
        onClick={() => signOut()}
        title="Sign out"
        aria-label="Sign out"
        className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-dim transition-colors hover:border-neon-violet/50 hover:text-neon-violet"
      >
        ⎋
      </button>
    </div>
  );
}
