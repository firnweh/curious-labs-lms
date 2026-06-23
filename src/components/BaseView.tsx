"use client";

import { type ReactNode } from "react";
import { useCosmetics, type Cosmetic } from "@/lib/cosmetics";
import { useGameStats } from "@/lib/gamification";
import { useMounted } from "@/lib/progress";
import { useName } from "@/lib/name";

export function BaseView() {
  const cos = useCosmetics();
  const stats = useGameStats();
  const mounted = useMounted();
  const [name, setName] = useName();

  const accent = cos.equipped.accent.value;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {/* ── identity hero ─────────────────────────────────── */}
      <section className="panel relative overflow-hidden p-6 sm:p-8" style={{ color: accent }}>
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-20 blur-3xl" style={{ background: accent }} />
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div
            className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl text-5xl"
            style={{ background: `${accent}1a`, border: `2px solid ${accent}`, boxShadow: `0 0 24px -6px ${accent}` }}
          >
            {cos.equipped.avatar.value}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs tracking-tech" style={{ color: accent }}>
              LV {mounted ? stats.level.index : 1} · {cos.equipped.title.value.toUpperCase()}
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type your name…"
              maxLength={32}
              className="mt-1 w-full max-w-xs bg-transparent font-display text-3xl font-bold text-ink outline-none placeholder:text-ink-faint"
            />
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-3 py-1 font-mono text-sm text-neon-amber">
              🪙 {mounted ? cos.coins : 0} coins
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-dim">
          Earn coins by completing labs (10 per star), then spend them here to make this space yours.
        </p>
      </section>

      <Section title="Avatars" accent={accent} cos={cos} type="avatar" render={(c) => <span className="text-3xl">{c.value}</span>} />
      <Section
        title="Signature colour"
        accent={accent}
        cos={cos}
        type="accent"
        render={(c) => <span className="h-8 w-8 rounded-full" style={{ background: c.value, boxShadow: `0 0 10px ${c.value}` }} />}
      />
      <Section title="Titles" accent={accent} cos={cos} type="title" render={(c) => <span className="font-display text-sm font-semibold text-ink">{c.value}</span>} />
    </div>
  );
}

function Section({
  title,
  type,
  accent,
  cos,
  render,
}: {
  title: string;
  type: Cosmetic["type"];
  accent: string;
  cos: ReturnType<typeof useCosmetics>;
  render: (c: Cosmetic) => ReactNode;
}) {
  const items = cos.catalog.filter((c) => c.type === type);
  const equippedId = cos.equipped[type].id;

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((c) => {
          const owned = cos.isOwned(c);
          const equipped = equippedId === c.id;
          const levelLocked = (c.levelReq ?? 0) > cos.level;
          const tooPoor = !owned && cos.coins < c.cost;

          return (
            <div
              key={c.id}
              className="panel flex flex-col items-center gap-2 p-4 text-center"
              style={equipped ? { borderColor: accent, boxShadow: `0 0 16px -6px ${accent}` } : undefined}
            >
              <div className="grid h-12 place-items-center">{render(c)}</div>
              <p className="text-xs text-ink-dim">{c.name}</p>

              {equipped ? (
                <span className="rounded-lg px-3 py-1 text-xs font-medium" style={{ background: accent, color: "#05070d" }}>
                  Equipped
                </span>
              ) : owned ? (
                <button
                  onClick={() => cos.equip(c)}
                  className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors"
                  style={{ borderColor: `${accent}66`, color: accent }}
                >
                  Equip
                </button>
              ) : levelLocked ? (
                <span className="rounded-lg border border-line px-3 py-1 text-xs text-ink-faint">🔒 Lv {c.levelReq}</span>
              ) : (
                <button
                  onClick={() => cos.buy(c)}
                  disabled={tooPoor}
                  className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40"
                  style={{ borderColor: tooPoor ? undefined : "#f59e0b66", color: tooPoor ? undefined : "#f59e0b" }}
                  title={tooPoor ? "Not enough coins yet" : "Buy"}
                >
                  🪙 {c.cost}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
