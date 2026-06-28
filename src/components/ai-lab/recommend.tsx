"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Recommend-o-Bot — a "video brain" that recommends what to watch next.
 *
 * The AI scores every catalog video by tag-overlap with the viewer's watch
 * history, ranks the top 5, and shows each match score. Clicking a recommended
 * video adds it to history → the recommendations UPDATE (the feedback loop) and
 * visibly NARROW into a filter bubble (one topic takes over).
 *
 * A "Responsible mode" toggle injects variety + a learning pick and demotes a
 * clickbait video → the recommendations BROADEN again. Pure React + divs, no
 * deps, fully deterministic (no random, no Date).
 */

const ACCENT = "#fb7185";

interface Video {
  id: number;
  emoji: string;
  title: string;
  tags: string[];
  clickbait?: boolean;
}

// Tag → color, for the little tag chips.
const TAG_COLOR: Record<string, string> = {
  sport: "#34d399",
  code: "#60a5fa",
  animals: "#eab308",
  news: "#9fb0d0",
  science: "#22d3ee",
  music: "#a855f7",
  gaming: "#fb7185",
};

// The catalog the brain can pick from (12 videos). One is clickbait/extreme.
const CATALOG: Video[] = [
  { id: 1, emoji: "⚽", title: "Top 10 Goals", tags: ["sport"] },
  { id: 2, emoji: "🏀", title: "Buzzer Beaters", tags: ["sport"] },
  { id: 3, emoji: "💻", title: "Code a Game", tags: ["code", "gaming"] },
  { id: 4, emoji: "🐍", title: "Python in 10 min", tags: ["code"] },
  { id: 5, emoji: "🐶", title: "Funny Puppies", tags: ["animals"] },
  { id: 6, emoji: "🐱", title: "Cats Being Cats", tags: ["animals"] },
  { id: 7, emoji: "🎮", title: "Speedrun World Record", tags: ["gaming"] },
  { id: 8, emoji: "🔬", title: "Why is the Sky Blue?", tags: ["science"] },
  { id: 9, emoji: "🚀", title: "How Rockets Fly", tags: ["science", "code"] },
  { id: 10, emoji: "🎵", title: "Beat Drop Mix", tags: ["music"] },
  { id: 11, emoji: "📰", title: "Today's Headlines", tags: ["news"] },
  { id: 12, emoji: "😱", title: "You WON'T BELIEVE This!!!", tags: ["news", "gaming"], clickbait: true },
  // Extra same-topic videos so the feedback loop can actually snowball into a bubble.
  { id: 13, emoji: "🏏", title: "Cricket Sixes", tags: ["sport"] },
  { id: 14, emoji: "🎾", title: "Best Rallies", tags: ["sport"] },
  { id: 15, emoji: "🏐", title: "Top Spikes", tags: ["sport"] },
];

// Starting watch history: football, coding, funny animals.
const START_HISTORY = [1, 3, 5];

function Tag({ name }: { name: string }) {
  const c = TAG_COLOR[name] ?? "#5b6b8c";
  return (
    <span
      className="rounded-md px-1.5 py-0.5 font-mono text-[9px]"
      style={{ color: c, background: `${c}1a`, border: `1px solid ${c}55` }}
    >
      #{name}
    </span>
  );
}

export default function RecommendOBot() {
  const [history, setHistory] = useState<number[]>(START_HISTORY);
  const [responsible, setResponsible] = useState(false);
  const [lastPicked, setLastPicked] = useState<number | null>(null);

  // Tag tally from everything in history — the viewer's "taste profile".
  const profile = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const id of history) {
      const v = CATALOG.find((c) => c.id === id);
      if (!v) continue;
      for (const t of v.tags) tally[t] = (tally[t] ?? 0) + 1;
    }
    return tally;
  }, [history]);

  // Rank every not-yet-watched video by tag-overlap with the profile.
  const ranked = useMemo(() => {
    const seen = new Set(history);
    const scored = CATALOG.filter((v) => !seen.has(v.id)).map((v) => {
      let score = v.tags.reduce((s, t) => s + (profile[t] ?? 0), 0);
      // Responsible mode: demote clickbait, and nudge science/learning up.
      if (responsible) {
        if (v.clickbait) score -= 5;
        if (v.tags.includes("science")) score += 2;
      }
      return { v, score };
    });
    // Stable, deterministic sort: score desc, then id asc.
    scored.sort((a, b) => (b.score - a.score) || (a.v.id - b.v.id));

    let top = scored.slice(0, 5);

    // Responsible mode injects VARIETY: ensure the top 5 isn't one topic.
    // Pull in the best-scoring video whose main tag isn't already represented.
    if (responsible) {
      const topTags = new Set(top.flatMap((r) => r.v.tags));
      const fresh = scored.find(
        (r) => r.score > -5 && r.v.tags.some((t) => !topTags.has(t)),
      );
      if (fresh && !top.includes(fresh)) {
        top = [...top.slice(0, 4), fresh];
      }
    }
    return top;
  }, [history, profile, responsible]);

  // How "bubbled" is the viewer? = share of their single most-watched tag, over
  // their WATCH HISTORY (the profile). As they click similar videos this loop
  // concentrates — the actual filter-bubble effect.
  const bubble = useMemo(() => {
    const counts = Object.values(profile);
    const total = counts.reduce((s, n) => s + n, 0);
    const top = counts.length ? Math.max(...counts) : 0;
    const dominant = Object.keys(profile).find((k) => profile[k] === top) ?? "";
    return { pct: total ? Math.round((top / total) * 100) : 0, dominant };
  }, [profile]);

  // Latch the peak concentration so the FILTER-BUBBLE lesson persists even after
  // the viewer exhausts a topic and is forced to diversify — a real bubble does
  // not pop just because you ran out of favourites.
  const [peak, setPeak] = useState({ pct: 0, dominant: "" });
  useEffect(() => {
    if (!responsible && bubble.pct > peak.pct) setPeak({ pct: bubble.pct, dominant: bubble.dominant });
  }, [bubble, responsible, peak.pct]);

  const watch = (id: number) => {
    setHistory((prev) => [...prev, id]);
    setLastPicked(id);
  };

  const reset = () => {
    setHistory(START_HISTORY);
    setLastPicked(null);
    setPeak({ pct: 0, dominant: "" });
  };

  const picks = history.length - START_HISTORY.length;
  const bubbled = !responsible && peak.pct >= 55 && picks >= 1;
  const shownPct = bubbled ? peak.pct : bubble.pct;

  const teach = responsible
    ? `🛟 Responsible mode: the bot mixes in variety, adds a learning pick (science), and hides the clickbait. Aha — good recommenders balance what you like with what's safe and worth your time, not just clicks.`
    : bubbled
      ? `🫧 Whoa — ${peak.pct}% of your picks are now #${peak.dominant}. The feedback loop trapped you in a FILTER BUBBLE: you click similar videos, so the bot shows only more of the same. Try Responsible mode!`
      : picks >= 1
        ? `🔁 You watched it → it joined your history → the bot RE-RANKED. This feedback loop slowly narrows what you see. Keep clicking the top pick and watch a bubble form…`
        : `▶️ The bot scores each video by how many tags it shares with your history, then ranks the top 5. Click a recommendation to see the loop react.`;

  return (
    <div className="w-full" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span aria-hidden style={{ fontSize: 22 }}>▶️</span>
        <span className="font-mono text-sm font-semibold tracking-wide">Recommend-o-Bot</span>
        <span
          className="rounded-md px-2 py-0.5 font-mono text-[10px]"
          style={{ color: ACCENT, background: `${ACCENT}1a`, border: `1px solid ${ACCENT}55` }}
        >
          Grades 7-10
        </span>
        <span className="font-mono text-[11px] text-[#5b6b8c]">· Recommendations</span>
      </div>
      <p
        aria-live="polite"
        className="mb-4 rounded-xl border border-[#1e2738] bg-[#0f1420] p-2.5 font-mono text-[11px] leading-relaxed text-[#9fb0d0]"
      >
        {teach}
      </p>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Recommendations */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-wide text-[#5b6b8c]">
              UP NEXT — ranked by match score
            </p>
            {/* Bubble meter */}
            <div className="flex items-center gap-1.5" title="How much one topic dominates your picks">
              <span className="font-mono text-[9px] text-[#5b6b8c]">bubble</span>
              <div className="h-2 w-20 overflow-hidden rounded-full bg-[#0b1018]">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${shownPct}%`,
                    background: responsible ? "#34d399" : shownPct >= 55 ? ACCENT : "#60a5fa",
                  }}
                />
              </div>
              <span
                className="font-mono text-[9px]"
                style={{ color: responsible ? "#34d399" : shownPct >= 55 ? ACCENT : "#9fb0d0" }}
              >
                {shownPct}%
              </span>
            </div>
          </div>

          <ol className="flex flex-col gap-2">
            {ranked.map((r, i) => {
              const isPick = r.v.id === lastPicked;
              return (
                <li key={r.v.id}>
                  <button
                    onClick={() => watch(r.v.id)}
                    className="group flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors hover:border-[#fb7185]"
                    style={{
                      borderColor: i === 0 ? `${ACCENT}88` : "#1e2738",
                      background: i === 0 ? `${ACCENT}12` : "#0f1420",
                    }}
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-xs"
                      style={{ background: "#0b1018", color: "#5b6b8c" }}
                    >
                      #{i + 1}
                    </span>
                    <span aria-hidden style={{ fontSize: 26 }}>{r.v.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-mono text-[13px] text-[#e8eefc]">{r.v.title}</span>
                        {r.v.clickbait && (
                          <span className="rounded px-1 font-mono text-[8px] text-[#0b1018]" style={{ background: "#ef4444" }}>
                            CLICKBAIT
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {r.v.tags.map((t) => <Tag key={t} name={t} />)}
                      </span>
                    </span>
                    {/* Match score */}
                    <span className="shrink-0 text-right">
                      <span
                        className="block font-mono text-base font-bold"
                        style={{ color: r.score > 0 ? ACCENT : "#5b6b8c" }}
                      >
                        {r.score > 0 ? `+${r.score}` : r.score}
                      </span>
                      <span className="font-mono text-[8px] text-[#5b6b8c]">match</span>
                    </span>
                    <span
                      className="shrink-0 rounded-lg px-2 py-1 font-mono text-[10px] transition-colors group-hover:bg-[#fb7185] group-hover:text-[#0b1018]"
                      style={{ background: isPick ? ACCENT : "#0b1018", color: isPick ? "#0b1018" : "#9fb0d0" }}
                    >
                      ▶ watch
                    </span>
                  </button>
                </li>
              );
            })}
            {ranked.length === 0 && (
              <li className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-4 text-center font-mono text-[11px] text-[#5b6b8c]">
                You watched everything! Press “Start over”.
              </li>
            )}
          </ol>
        </div>

        {/* Side panel: history + controls */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[260px]">
          {/* Responsible toggle */}
          <button
            onClick={() => setResponsible((r) => !r)}
            className="flex items-center justify-between rounded-2xl border-2 p-3 transition-colors"
            style={{
              borderColor: responsible ? "#34d399" : "#1e2738",
              background: responsible ? "#34d39912" : "#0f1420",
            }}
          >
            <span className="text-left">
              <span className="block font-mono text-[12px] font-semibold" style={{ color: responsible ? "#34d399" : "#e8eefc" }}>
                🛟 Responsible mode
              </span>
              <span className="font-mono text-[9px] text-[#5b6b8c]">variety · safety · learning</span>
            </span>
            <span
              className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
              style={{ background: responsible ? "#34d399" : "#2a3550" }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-[#0b1018] transition-all"
                style={{ left: responsible ? 22 : 2 }}
              />
            </span>
          </button>

          {/* Watch history */}
          <div className="rounded-2xl border border-[#1e2738] bg-[#0f1420] p-3">
            <p className="mb-2 font-mono text-[10px] tracking-wide text-[#5b6b8c]">
              YOUR HISTORY · {history.length} watched
            </p>
            <div className="flex max-h-[180px] flex-col gap-1 overflow-auto">
              {history.map((id, i) => {
                const v = CATALOG.find((c) => c.id === id);
                if (!v) return null;
                const fresh = i >= START_HISTORY.length && id === lastPicked;
                return (
                  <div
                    key={`${id}-${i}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                    style={{ background: fresh ? `${ACCENT}1a` : "#0b1018" }}
                  >
                    <span aria-hidden style={{ fontSize: 16 }}>{v.emoji}</span>
                    <span className="truncate font-mono text-[11px] text-[#9fb0d0]">{v.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={reset}
            className="rounded-xl border border-[#2a3550] py-2 font-mono text-[11px] text-[#9fb0d0] transition-colors hover:border-[#fb7185] hover:text-[#fb7185]"
          >
            🔄 Start over
          </button>

          <p className="rounded-xl border border-[#1e2738] bg-[#0f1420] p-2.5 font-mono text-[10px] leading-relaxed text-[#5b6b8c]">
            The bot only knows your <span style={{ color: ACCENT }}>history</span>. Watch → it re-ranks → a{" "}
            <span style={{ color: ACCENT }}>filter bubble</span> forms. A{" "}
            <span className="text-[#34d399]">responsible</span> recommender adds variety, safety and learning — not just more clicks.
          </p>
        </div>
      </div>
    </div>
  );
}
