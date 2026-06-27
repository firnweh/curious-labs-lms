"use client";

import Link from "next/link";
import { Stars } from "@/components/ui";
import { titleCase, type PassportData } from "@/lib/passportData";
import { SUBJECT_MAP } from "@/lib/subjects";
import type { SubjectId } from "@/lib/activities/types";

/**
 * Presentational Skill Passport — renders purely from a `data` view-model so
 * the live passport and the public verified passport look identical. `banner`
 * sits above the card (e.g. the verification result); `actions` is the button
 * row at the bottom.
 */
export function PassportContent({
  data,
  banner,
  actions,
}: {
  data: PassportData;
  banner?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      {banner}

      {/* ── The credential card ───────────────────────────── */}
      <section className="passport-card panel relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(130% 120% at 100% -10%, rgba(168,85,247,.20), transparent 46%), radial-gradient(130% 120% at -10% 110%, rgba(34,211,238,.18), transparent 46%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[11px] tracking-tech text-neon-cyan">
              CURIOUS LABS · SKILL PASSPORT
            </p>
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neon-green/50 bg-neon-green/10 px-3 py-1 font-mono text-[10px] font-bold tracking-tech text-neon-green"
              title="Issued & verified by Physics Wallah"
            >
              <span aria-hidden>✓</span> PW-VERIFIED
            </span>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <div
              className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-4xl"
              style={{
                background: "rgba(56,189,248,.12)",
                border: "2px solid rgba(56,189,248,.55)",
                boxShadow: "0 0 26px -8px rgba(56,189,248,.8)",
              }}
            >
              {data.avatar}
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[11px] tracking-tech text-ink-faint">PASSPORT HOLDER</p>
              <h1 className="truncate font-display text-2xl font-bold text-ink sm:text-3xl">
                {data.holderName}
              </h1>
              <p className="mt-0.5 text-sm text-ink-dim">
                {data.classLine ?? "Independent learner"} ·{" "}
                <span className="text-ink">
                  {data.level.emoji} {data.level.title}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Meta label="Passport ID" value={data.passportId} mono />
            <Meta label="Member since" value={data.since} />
            <Meta label="Experience" value={`${data.xp} XP`} />
            <Meta label="Level" value={String(data.level.index)} />
          </div>
        </div>
      </section>

      {/* ── Headline stats ────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat emoji="🧠" value={data.totalSkills} label="Skills mastered" accent="#22d3ee" />
        <BigStat emoji="🛠️" value={data.labsBuilt} label="Labs built" accent="#34d399" />
        <BigStat emoji="🎓" value={data.certCount} label="Certificates" accent="#a855f7" />
        <BigStat emoji="🏅" value={data.badgeCount} label="Badges" accent="#f59e0b" />
      </div>

      {/* ── Skills mastered ───────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold text-ink">Skills mastered</h2>
          <span className="font-mono text-xs text-ink-faint">{data.totalSkills} skills</span>
        </div>
        {data.skillGroups.length > 0 ? (
          <div className="mt-4 space-y-4">
            {data.skillGroups.map(({ subject, skills }) => (
              <div key={subject.id} className="panel p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">{subject.emoji}</span>
                  <h3 className="font-display text-sm font-semibold text-ink">{subject.name}</h3>
                  <span className="font-mono text-[11px] text-ink-faint">{skills.length}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border px-3 py-1 text-xs font-medium"
                      style={{
                        color: subject.accent,
                        borderColor: `${subject.accent}55`,
                        background: `${subject.accent}14`,
                      }}
                    >
                      {titleCase(s)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="panel mt-4 p-5 text-center text-sm text-ink-dim">
            Complete labs to start mastering skills — each one you finish adds to your passport.
          </p>
        )}
      </section>

      {/* ── Labs built by track ───────────────────────────── */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-ink">What&rsquo;s been built</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.perSubject.map((ps) => {
            const s = data.certs.find((c) => c.id === ps.id);
            const accent = subjectAccent(ps.id);
            const complete = ps.done === ps.total && ps.total > 0;
            return (
              <div key={ps.id} className="panel p-4" style={{ color: accent }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{subjectEmoji(ps.id)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-ink">{subjectName(ps.id)}</h3>
                      <span className="font-mono text-[11px] text-ink-faint">
                        {ps.done}/{ps.total}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${ps.pct}%`, background: accent, boxShadow: `0 0 8px ${accent}` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Stars value={Math.round(ps.stars / Math.max(ps.total, 1))} size={13} />
                  {complete ? (
                    <span className="font-mono text-[11px]" style={{ color: accent }}>
                      ✓ Track complete{s ? "" : ""}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-ink-faint">{ps.pct}% complete</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Certificates ──────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold text-ink">Certificates</h2>
          <span className="font-mono text-xs text-ink-faint">{data.certCount} of 4</span>
        </div>
        {data.certs.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.certs.map((s) => (
              <Link
                key={s.id}
                href={`/certificate/${s.id}`}
                className="panel flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
                style={{ borderColor: `${s.accent}66` }}
              >
                <span className="text-3xl" aria-hidden>🎓</span>
                <div className="min-w-0">
                  <p className="font-display font-semibold text-ink">{s.name}</p>
                  <p className="font-mono text-[11px]" style={{ color: s.accent }}>
                    Certificate of Achievement →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="panel mt-4 p-5 text-center text-sm text-ink-dim">
            Finish every lab in a track to earn its certificate.
          </p>
        )}
      </section>

      {/* ── Badges ────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold text-ink">Badges</h2>
          <span className="font-mono text-xs text-ink-faint">{data.badgeCount} earned</span>
        </div>
        {data.earnedBadges.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.earnedBadges.map((b) => (
              <div key={b.id} className="panel flex items-center gap-3 p-3.5" style={{ borderColor: "#f59e0b55" }}>
                <span className="text-2xl" aria-hidden>{b.emoji}</span>
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold text-ink">{b.name}</p>
                  <p className="truncate text-[11px] text-ink-faint">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="panel mt-4 p-5 text-center text-sm text-ink-dim">
            Earn badges by completing labs, mastering concepts and keeping a streak.
          </p>
        )}
      </section>

      {actions}

      <p className="mt-6 text-center font-mono text-[11px] tracking-tech text-ink-faint">
        Verified by Physics Wallah · curiouslabs.online
      </p>
    </div>
  );
}

// Subject lookups kept local so PassportContent stays a pure view of `data`.
const subjectAccent = (id: SubjectId) => SUBJECT_MAP[id]?.accent ?? "#22d3ee";
const subjectEmoji = (id: SubjectId) => SUBJECT_MAP[id]?.emoji ?? "🧪";
const subjectName = (id: SubjectId) => SUBJECT_MAP[id]?.name ?? id;

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-panel/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-tech text-ink-faint">{label}</p>
      <p className={`mt-0.5 truncate font-semibold text-ink ${mono ? "font-mono text-sm" : "text-base"}`}>
        {value}
      </p>
    </div>
  );
}

function BigStat({ emoji, value, label, accent }: { emoji: string; value: number; label: string; accent: string }) {
  return (
    <div className="panel p-4 text-center" style={{ borderColor: `${accent}44` }}>
      <div className="text-xl" aria-hidden>{emoji}</div>
      <div className="mt-1 font-display text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-tech text-ink-faint">{label}</div>
    </div>
  );
}
