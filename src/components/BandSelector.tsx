"use client";

import { BANDS, useBand } from "@/lib/bands";
import { bandHasContent } from "@/lib/activities/registry";
import { useMounted } from "@/lib/progress";

export function BandSelector({ compact = false }: { compact?: boolean }) {
  const { band, setBand } = useBand();
  const mounted = useMounted();
  const current = mounted ? band : "explorer";

  return (
    <div className={compact ? "" : "mb-6"}>
      {!compact && (
        <p className="mb-3 text-center font-mono text-xs tracking-tech text-ink-faint">
          PICK YOUR CLASS
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {BANDS.map((b) => {
          const active = current === b.id;
          const ready = bandHasContent(b.id);
          return (
            <button
              key={b.id}
              onClick={() => setBand(b.id)}
              className={`panel relative flex items-center gap-3 px-4 py-3 text-left transition-all ${
                compact ? "" : "min-w-[150px]"
              } ${active ? "" : "opacity-70 hover:opacity-100"}`}
              style={active ? { borderColor: b.accent, boxShadow: `0 0 18px -6px ${b.accent}` } : undefined}
              aria-pressed={active}
            >
              <span className="text-2xl" aria-hidden>{b.emoji}</span>
              <span className="leading-tight">
                <span className="block font-display text-sm font-bold text-ink">{b.classes}</span>
                <span className="block font-mono text-[11px]" style={{ color: active ? b.accent : undefined }}>
                  {active ? b.name : ready ? b.name : "soon"}
                </span>
              </span>
              {active && (
                <span
                  className="absolute right-2 top-2 h-2 w-2 rounded-full"
                  style={{ background: b.accent, boxShadow: `0 0 8px ${b.accent}` }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
