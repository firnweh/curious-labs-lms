"use client";

import { SUBJECT_MAP } from "@/lib/subjects";
import type { StudentSummary, StudentDetail } from "@/lib/cloud-types";

export function fmtAgo(iso: string | null): string {
  if (!iso) return "no activity yet";
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < 0) return "just now";
  if (diff < 3_600_000) return "active recently";
  if (diff < day) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function MiniStats({ s }: { s: StudentSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-dim">
      <span>✅ {s.labsDone}/{s.totalLabs}</span>
      <span>⭐ {s.totalStars}</span>
      <span>🔥 {s.streakCurrent}</span>
      <span className="text-ink-faint">· {fmtAgo(s.lastActive)}</span>
    </div>
  );
}

export function SubjectBars({ detail }: { detail: StudentDetail }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {detail.perSubject.map((p) => {
        const accent = SUBJECT_MAP[p.subject]?.accent ?? "#22d3ee";
        const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
        return (
          <div key={p.subject} className="rounded-lg border border-line bg-panel/40 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink">{p.name}</span>
              <span className="font-mono text-xs text-ink-dim">{p.done}/{p.total}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/40">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DetailPanel({ detail, onClose }: { detail: StudentDetail; onClose?: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-bold text-ink">{detail.displayName}</h3>
          <p className="text-xs text-ink-faint">
            {detail.className ? `${detail.className} · ` : ""}{fmtAgo(detail.lastActive)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 font-mono text-sm text-ink-dim">
            <span title="Labs done">✅ {detail.labsDone}</span>
            <span title="Total stars">⭐ {detail.totalStars}</span>
            <span title="Day streak">🔥 {detail.streakCurrent}</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="rounded-full border border-line px-3 py-1 text-xs text-ink-dim hover:text-ink" aria-label="Close">
              ✕
            </button>
          )}
        </div>
      </div>

      <SubjectBars detail={detail} />

      <div>
        <p className="mb-2 font-mono text-xs tracking-tech text-ink-faint">RECENT ACTIVITY</p>
        {detail.recent.length === 0 ? (
          <p className="text-sm text-ink-faint">No labs completed yet.</p>
        ) : (
          <ul className="space-y-1">
            {detail.recent.map((r) => (
              <li key={r.activityId} className="flex items-center justify-between rounded-lg border border-line/60 bg-panel/30 px-3 py-2 text-sm">
                <span className="truncate text-ink">{r.title}</span>
                <span className="ml-3 shrink-0 font-mono text-xs text-neon-amber">{"★".repeat(r.stars)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
