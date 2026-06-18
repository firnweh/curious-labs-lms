"use client";

import Link from "next/link";
import { useGameStats } from "@/lib/gamification";
import { useCosmetics } from "@/lib/cosmetics";
import { useProgress, useMounted } from "@/lib/progress";
import { SUBJECT_MAP } from "@/lib/subjects";
import { Stars } from "@/components/ui";

export function ProfileView() {
  const stats = useGameStats();
  const cos = useCosmetics();
  const { reset } = useProgress();
  const mounted = useMounted();
  const level = stats.level;
  const accent = cos.equipped.accent.value;

  function confirmReset() {
    if (window.confirm("Reset all your progress, XP and badges? This can't be undone.")) {
      reset();
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {/* ── Hero: level + XP ─────────────────────────────── */}
      <section className="panel relative overflow-hidden p-6 sm:p-8" style={{ color: accent }}>
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-20 blur-3xl" style={{ background: accent }} />
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div
            className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-4xl"
            style={{ background: `${accent}1a`, border: `2px solid ${accent}`, boxShadow: `0 0 22px -6px ${accent}` }}
          >
            {mounted ? cos.equipped.avatar.value : "🧑‍🚀"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs tracking-tech" style={{ color: accent }}>
              LEVEL {mounted ? level.index : 1} · {mounted ? cos.equipped.title.value.toUpperCase() : "MAKER"}
            </p>
            <h1 className="font-display text-3xl font-bold text-ink">{level.title}</h1>
            <Link href="/base" className="mt-1 inline-block font-mono text-xs hover:underline" style={{ color: accent }}>
              ✨ Customize my Base →
            </Link>
            <div className="mt-3">
              <div className="h-2.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet transition-all"
                  style={{ width: `${mounted ? level.pct : 0}%`, boxShadow: "0 0 12px #22d3ee" }}
                />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-ink-faint">
                {!mounted
                  ? "—"
                  : level.isMax
                    ? `${stats.xp} XP · top level reached! 🎉`
                    : `${stats.xp} XP · ${level.xpForLevel - level.xpIntoLevel} XP to ${level.nextTitle}`}
              </p>
            </div>
          </div>
        </div>

        {/* stat chips */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Day streak" value={mounted ? stats.streak : 0} sub={`best ${mounted ? stats.bestStreak : 0}`} emoji="🔥" />
          <Stat label="Total stars" value={mounted ? stats.totalStars : 0} emoji="⭐" />
          <Stat label="Labs done" value={`${mounted ? stats.completedCount : 0}/${stats.totalLabs}`} emoji="✅" />
          <Stat label="Badges" value={`${mounted ? stats.earnedCount : 0}/${stats.badges.length}`} emoji="🏅" />
        </div>
      </section>

      {/* ── Per-subject progress ─────────────────────────── */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-ink">Your tracks</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {stats.perSubject.map((ps) => {
            const s = SUBJECT_MAP[ps.id];
            const complete = ps.done === ps.total && ps.total > 0;
            return (
              <div key={ps.id} className="panel p-4" style={{ color: s.accent }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-ink">{s.name}</h3>
                      <span className="font-mono text-[11px] text-ink-faint">
                        {mounted ? ps.done : 0}/{ps.total}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${mounted ? ps.pct : 0}%`, background: s.accent, boxShadow: `0 0 8px ${s.accent}` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Stars value={mounted ? Math.round(ps.stars / Math.max(ps.total, 1)) : 0} size={13} />
                  {complete && mounted ? (
                    <Link href={`/certificate/${ps.id}`} className="font-mono text-xs hover:underline" style={{ color: s.accent }}>
                      🎓 Certificate →
                    </Link>
                  ) : (
                    <Link href={`/subjects/${ps.id}`} className="font-mono text-xs text-ink-dim hover:text-ink">
                      Continue →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Badges ───────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold text-ink">Badges</h2>
          <span className="font-mono text-xs text-ink-faint">
            {mounted ? stats.earnedCount : 0} of {stats.badges.length} earned
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {stats.badges.map((b) => {
            const earned = mounted && b.earned;
            return (
              <div
                key={b.id}
                className={`panel flex items-center gap-3 p-3.5 transition-opacity ${earned ? "" : "opacity-45"}`}
                style={earned ? { borderColor: "#f59e0b66" } : undefined}
              >
                <span className={`text-2xl ${earned ? "animate-float" : "grayscale"}`} aria-hidden>
                  {earned ? b.emoji : "🔒"}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold text-ink">{b.name}</p>
                  <p className="truncate text-[11px] text-ink-faint">{b.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Reset ────────────────────────────────────────── */}
      <div className="mt-10 flex justify-center">
        <button
          onClick={confirmReset}
          className="rounded-lg border border-line px-4 py-2 text-xs text-ink-faint transition-colors hover:border-neon-red/50 hover:text-neon-red"
        >
          Reset all progress
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, emoji }: { label: string; value: string | number; sub?: string; emoji: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel/50 p-3 text-center">
      <div className="text-lg" aria-hidden>{emoji}</div>
      <div className="mt-0.5 font-display text-xl font-bold text-ink">{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-tech text-ink-faint">
        {label}
        {sub ? ` · ${sub}` : ""}
      </div>
    </div>
  );
}
