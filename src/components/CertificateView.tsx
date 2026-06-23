"use client";

import Link from "next/link";
import { SUBJECT_MAP } from "@/lib/subjects";
import { activitiesBySubject } from "@/lib/activities/registry";
import { useProgress, useMounted } from "@/lib/progress";
import { useName } from "@/lib/name";
import type { SubjectId } from "@/lib/activities/types";
import { Stars } from "@/components/ui";

export function CertificateView({ subjectId }: { subjectId: SubjectId }) {
  const s = SUBJECT_MAP[subjectId];
  const { store } = useProgress();
  const mounted = useMounted();
  const [name, setName] = useName();

  const labs = activitiesBySubject(subjectId);
  const done = labs.filter((l) => store[l.id]).length;
  const stars = labs.reduce((n, l) => n + (store[l.id]?.stars ?? 0), 0);
  const complete = mounted && done === labs.length && labs.length > 0;
  const avgStars = labs.length ? Math.round(stars / labs.length) : 0;
  const today = mounted
    ? new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="no-print mb-5 flex items-center justify-between">
        <Link href="/profile" className="text-sm text-ink-dim hover:text-ink">
          ← Back to progress
        </Link>
        {complete && (
          <button
            onClick={() => window.print()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[#05070d]"
            style={{ background: s.accent }}
          >
            🖨️ Print / Save PDF
          </button>
        )}
      </div>

      {!complete ? (
        <div className="panel p-8 text-center">
          <p className="text-4xl">{s.emoji}</p>
          <h1 className="mt-3 font-display text-2xl font-bold text-ink">Almost there!</h1>
          <p className="mt-2 text-ink-dim">
            Finish all {labs.length} {s.name} labs to unlock your certificate.
            {mounted ? ` You've done ${done}.` : ""}
          </p>
          <Link
            href={`/subjects/${subjectId}`}
            className="mt-5 inline-block rounded-lg px-5 py-2.5 font-medium text-[#05070d]"
            style={{ background: s.accent }}
          >
            Continue {s.name} →
          </Link>
        </div>
      ) : (
        <>
          {/* name field (screen only) */}
          <div className="no-print mb-4">
            <label className="font-mono text-xs text-ink-faint">Your name (shown on the certificate)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type your name…"
              className="mt-1 w-full rounded-lg border border-line bg-panel/60 px-3 py-2 text-ink outline-none focus:border-neon-cyan/60"
              maxLength={40}
            />
          </div>

          {/* the certificate */}
          <div
            className="certificate relative overflow-hidden rounded-2xl p-8 text-center sm:p-12"
            style={{
              background: "linear-gradient(160deg, #0b1020, #11182f)",
              border: `2px solid ${s.accent}`,
              boxShadow: `0 0 40px -10px ${s.accent}`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-3 rounded-xl"
              style={{ border: `1px solid ${s.accent}55` }}
            />
            <p className="font-mono text-xs tracking-tech" style={{ color: s.accent }}>
              CURIOUS<span className="text-ink">LABS</span> · CERTIFICATE OF ACHIEVEMENT
            </p>
            <div className="mt-6 text-5xl">{s.emoji}</div>
            <p className="mt-6 text-sm text-ink-dim">This certifies that</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
              {name.trim() || "Young Maker"}
            </p>
            <p className="mt-4 text-ink-dim">
              has successfully completed the{" "}
              <span className="font-semibold" style={{ color: s.accent }}>
                {s.name}
              </span>{" "}
              track — mastering {labs.length} hands-on experiments.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <Stars value={avgStars} size={22} />
            </div>
            <div className="mt-8 flex items-end justify-between">
              <div className="text-left">
                <p className="font-mono text-[11px] text-ink-faint">DATE</p>
                <p className="text-sm text-ink">{today}</p>
              </div>
              <div
                className="grid h-16 w-16 place-items-center rounded-full text-2xl"
                style={{ border: `2px solid ${s.accent}`, color: s.accent }}
              >
                ✦
              </div>
              <div className="text-right">
                <p className="font-mono text-[11px] text-ink-faint">CURIOUS LABS</p>
                <p className="text-sm text-ink">STEM Education</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
