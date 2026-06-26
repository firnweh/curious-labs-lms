"use client";

import Link from "next/link";
import { buildPassportData, passportId as makeId } from "@/lib/passportData";
import { PassportContent } from "@/components/PassportContent";
import type { ProgressStore } from "@/lib/progress";

/** Plain shape passed from the verify page (kept local — never import the
 *  node:crypto-backed token module into a client component). */
interface VerifiedPayload {
  v: number;
  n: string;
  c: string | null;
  p: Record<string, number>;
  s: number;
  pid: string;
  iat: number;
}

/**
 * Public, read-only Skill Passport rendered from a signed token. Shows a
 * verification banner; if the signature didn't check out, shows a warning
 * instead of any credential data.
 */
export function VerifiedPassportView({
  verified,
  payload,
}: {
  verified: boolean;
  payload: VerifiedPayload | null;
}) {
  if (!verified || !payload) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <div className="text-5xl" aria-hidden>⚠️</div>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">
          Couldn&rsquo;t verify this passport
        </h1>
        <p className="mt-2 text-ink-dim">
          This link is invalid or has been altered. Ask the learner for a fresh
          verification link from their Skill Passport.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-block">
          Go home
        </Link>
      </div>
    );
  }

  const store: ProgressStore = {};
  for (const [id, stars] of Object.entries(payload.p)) store[id] = { stars, at: payload.iat };

  const issued = new Date(payload.iat).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const data = buildPassportData(store, payload.s ?? 0, {
    holderName: payload.n || "Curious Cadet",
    classLine: payload.c,
    avatar: "🧑‍🚀",
    passportId: payload.pid || makeId(payload.n),
    since: new Date(payload.iat).toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
  });

  const banner = (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-neon-green/40 bg-neon-green/10 px-4 py-3">
      <span className="text-2xl" aria-hidden>✅</span>
      <div>
        <p className="font-mono text-xs font-bold tracking-tech text-neon-green">
          VERIFIED CREDENTIAL
        </p>
        <p className="text-sm text-ink-dim">
          Cryptographically signed by Curious Labs · issued {issued}. This record
          has not been altered.
        </p>
      </div>
    </div>
  );

  const actions = (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
      <button
        onClick={() => typeof window !== "undefined" && window.print()}
        className="rounded-full border border-line px-5 py-2.5 font-mono text-sm text-ink-dim transition-colors hover:border-ink/40 hover:text-ink"
      >
        🖨️ Save as PDF
      </button>
      <Link
        href="/tracks"
        className="rounded-full border border-neon-cyan/50 bg-neon-cyan/10 px-5 py-2.5 font-mono text-sm font-semibold tracking-tech text-neon-cyan transition-colors hover:border-neon-cyan hover:bg-neon-cyan/20"
      >
        Start your own passport →
      </Link>
    </div>
  );

  return <PassportContent data={data} banner={banner} actions={actions} />;
}
