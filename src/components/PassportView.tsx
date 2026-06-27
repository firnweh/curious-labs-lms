"use client";

import { useState } from "react";
import Link from "next/link";
import { useProgress, useStreak, useMounted, type ProgressStore } from "@/lib/progress";
import { useName } from "@/lib/name";
import { useSession } from "@/components/SessionProvider";
import { useCosmetics } from "@/lib/cosmetics";
import { buildPassportData, passportId } from "@/lib/passportData";
import { PassportContent } from "@/components/PassportContent";

function formatSince(store: ProgressStore): string {
  const ts = Object.values(store).reduce((min, e) => (e.at && e.at < min ? e.at : min), Infinity);
  return new Date(isFinite(ts) ? ts : Date.now()).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

/**
 * The learner's own Skill Passport. Reads live progress and can mint a signed,
 * shareable verification link that anyone can open to confirm the credential.
 */
export function PassportView() {
  const { store } = useProgress();
  const streak = useStreak();
  const mounted = useMounted();
  const [localName] = useName();
  const { student } = useSession();
  const cos = useCosmetics();

  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const identity = {
    holderName: (mounted && (student?.displayName || student?.name || localName)) || "Curious Cadet",
    classLine: mounted && student ? `${student.className} · ${student.classCode}` : null,
    avatar: mounted ? cos.equipped.avatar.value : "🧑‍🚀",
    passportId: mounted ? passportId(student?.id || localName || "guest") : "CL-•••-•••",
    since: mounted ? formatSince(store) : "—",
  };

  const data = buildPassportData(mounted ? store : {}, mounted ? streak.current : 0, identity);

  async function createLink() {
    setBusy(true);
    setCopied(false);
    try {
      const p: Record<string, number> = {};
      for (const [id, e] of Object.entries(store)) p[id] = e.stars;
      const res = await fetch("/api/passport/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          n: identity.holderName,
          c: identity.classLine,
          p,
          pid: identity.passportId,
          s: streak.current,
        }),
      });
      if (!res.ok) throw new Error("issue failed");
      const { token } = await res.json();
      const url = `${window.location.origin}/passport/verify?t=${token}`;
      setLink(url);
      if (navigator.share) navigator.share({ title: "My Skill Passport", url }).catch(() => {});
    } catch {
      /* leave link unset — button can be retried */
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    if (link && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  const actions = (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={createLink}
          disabled={busy}
          className="rounded-full border border-neon-cyan/50 bg-neon-cyan/10 px-5 py-2.5 font-mono text-sm font-semibold tracking-tech text-neon-cyan transition-colors hover:border-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-50"
        >
          {busy ? "Signing…" : "🔗 Create verifiable link"}
        </button>
        <button
          onClick={() => typeof window !== "undefined" && window.print()}
          className="rounded-full border border-line px-5 py-2.5 font-mono text-sm text-ink-dim transition-colors hover:border-ink/40 hover:text-ink"
        >
          🖨️ Save as PDF
        </button>
        <Link
          href="/profile"
          className="rounded-full border border-line px-5 py-2.5 font-mono text-sm text-ink-dim transition-colors hover:border-ink/40 hover:text-ink"
        >
          My dashboard →
        </Link>
      </div>

      {link && (
        <div className="mx-auto mt-4 max-w-xl panel p-4 text-center">
          <p className="font-mono text-[11px] tracking-tech text-neon-green">
            ✓ SIGNED · anyone with this link can verify your passport
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 truncate rounded-lg border border-line bg-base/60 px-3 py-2 font-mono text-xs text-ink-dim"
            />
            <button
              onClick={copyLink}
              className="shrink-0 rounded-lg border border-neon-cyan/50 px-3 py-2 font-mono text-xs text-neon-cyan transition-colors hover:bg-neon-cyan/10"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return <PassportContent data={data} actions={actions} />;
}
