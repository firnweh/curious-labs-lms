"use client";
// Learning goal: collaborative filtering — find the users most similar to you
// (taste twins), then predict your rating for an unseen movie as the average of
// what those twins rated it. Everything here is deterministic & always winnable.
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

const ACCENT = "#a855f7";

/** A movie column. `q1`/`q2` are the two you (the learner) haven't seen. */
interface Movie {
  key: string;
  title: string;
  emoji: string;
}

const MOVIES: readonly Movie[] = [
  { key: "m0", title: "Star Voyage", emoji: "🚀" },
  { key: "m1", title: "Love in Rome", emoji: "💌" },
  { key: "m2", title: "Robot Wars", emoji: "🤖" },
  { key: "m3", title: "Ghost House", emoji: "👻" },
  { key: "m4", title: "Mecha Dawn", emoji: "🛸" }, // unseen #1  (the "?" cols)
  { key: "m5", title: "Star Voyage II", emoji: "🌌" }, // unseen #2
] as const;

/** Indices of the two movies YOU haven't seen. */
const UNSEEN: readonly [number, number] = [4, 5];

/** A rating row. null = blank cell (not rated). */
type Row = readonly (number | null)[];

/**
 * Fixed 5-user × 6-movie grid. "You" is the last row, with `?` (null) on the two
 * unseen movies. The other four rows are hand-tuned so cosine similarity gives a
 * clean ranking and the two taste-twins' averages land on whole-number options.
 *
 * Pre-computed similarity to YOU (cosine over co-rated movies, ×100) is fixed in
 * SIM below so the numbers are deterministic and the explanations are honest.
 */
const USERS: readonly { name: string; emoji: string; row: Row }[] = [
  { name: "Maya", emoji: "🦊", row: [5, 1, 5, 2, 4, 4] }, // twin: loves sci-fi, hates rom-com
  { name: "Leo", emoji: "🐧", row: [4, 2, 5, 1, 4, 5] }, // twin: same taste shape
  { name: "Ivy", emoji: "🦋", row: [1, 5, 2, 5, 1, 2] }, // opposite: loves rom-com
  { name: "Sam", emoji: "🐻", row: [2, 4, 1, 4, 2, 1] }, // opposite-ish
] as const;

/** YOUR ratings. UNSEEN movies are null (shown as "?"). */
const YOU: Row = [5, 1, 4, 2, null, null] as const;

/** Pre-computed cosine similarity to YOU, as a whole percent (deterministic). */
const SIM: readonly number[] = [94, 91, 38, 45] as const;

/** One-line, honest explanation per user. */
const WHY: readonly string[] = [
  "You both loved sci-fi and both disliked the rom-com.",
  "Almost the same taste shape as you across every movie.",
  "Ivy loved the rom-com you disliked — opposite taste.",
  "Sam liked what you skipped and skipped what you liked.",
] as const;

/** The two correct taste twins (highest SIM): Maya (0) and Leo (1). */
const TWINS: readonly [number, number] = [0, 1];

/**
 * Correct prediction for each unseen movie = average of the two twins' ratings,
 * rounded to a whole star. Maya & Leo both rated m4=4 → 4; m5 = (4+5)/2 = 4.5 → 5.
 */
function predictFor(movieIdx: number): number {
  const a = USERS[TWINS[0]].row[movieIdx] as number;
  const b = USERS[TWINS[1]].row[movieIdx] as number;
  return Math.round((a + b) / 2);
}

/** Three star-options per unseen movie; exactly one is the correct average. */
const OPTIONS: Record<number, readonly number[]> = {
  4: [2, 4, 5],
  5: [3, 4, 5],
};

function Stars({ n }: { n: number }): React.ReactElement {
  return (
    <span aria-hidden="true">
      {"★".repeat(n)}
      <span style={{ opacity: 0.25 }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default function MovieRecommender({ onComplete }: ActivityProps) {
  // Step state.
  const [compared, setCompared] = useState<Set<number>>(new Set());
  const [active, setActive] = useState<number | null>(null); // currently-compared user
  const [picks, setPicks] = useState<number[]>([]); // chosen twin indices (order-free, max 2)
  const [pred, setPred] = useState<Record<number, number | null>>({ 4: null, 5: null });
  const [solved, setSolved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>(
    "Tap Compare on each user to score how alike your taste is.",
  );
  const [showPop, setShowPop] = useState<boolean>(false);
  const firedRef = useRef<boolean>(false);

  const compare = useCallback(
    (i: number): void => {
      if (solved) return;
      setActive(i);
      setCompared((prev) => {
        const next = new Set(prev);
        next.add(i);
        return next;
      });
      setStatus(`${USERS[i].name}: ${SIM[i]}% match — ${WHY[i]}`);
    },
    [solved],
  );

  const togglePick = useCallback(
    (i: number): void => {
      if (solved) return;
      setPicks((prev) => {
        if (prev.includes(i)) return prev.filter((p) => p !== i);
        if (prev.length >= 2) {
          setStatus("Your twins box is full — remove one to swap.");
          return prev;
        }
        if (SIM[i] < 50) {
          setStatus(`${USERS[i].name} ${WHY[i]} Not a taste twin — try a higher match.`);
        }
        return [...prev, i];
      });
    },
    [solved],
  );

  const twinsChosen = picks.length === 2;
  const twinsCorrect = useMemo(
    () => twinsChosen && [...picks].sort().join(",") === [...TWINS].sort().join(","),
    [picks, twinsChosen],
  );

  const setPrediction = useCallback(
    (movieIdx: number, value: number): void => {
      if (solved) return;
      setPred((prev) => ({ ...prev, [movieIdx]: value }));
      setStatus(`Predicted ${value}★ for ${MOVIES[movieIdx].title}.`);
    },
    [solved],
  );

  const check = useCallback((): void => {
    if (solved) return;
    if (!twinsChosen) {
      setStatus("Pick your TOP-2 taste twins first (the two highest matches).");
      onComplete({ passed: false, detail: "Choose two taste twins to continue." });
      return;
    }
    if (!twinsCorrect) {
      const wrong = picks.find((p) => !TWINS.includes(p as 0 | 1));
      const who = wrong !== undefined ? USERS[wrong].name : "one pick";
      setStatus(`${who} is not a top match — swap in a higher % twin.`);
      onComplete({ passed: false, detail: "Those aren't the two most-similar users." });
      return;
    }
    const p4 = pred[4];
    const p5 = pred[5];
    if (p4 === null || p5 === null) {
      setStatus("Predict a rating for each ? movie using the twin average.");
      onComplete({ passed: false, detail: "Fill in both predictions." });
      return;
    }
    const ok4 = p4 === predictFor(4);
    const ok5 = p5 === predictFor(5);
    if (!ok4 || !ok5) {
      const bad = !ok4 ? 4 : 5;
      const a = USERS[TWINS[0]].row[bad] as number;
      const b = USERS[TWINS[1]].row[bad] as number;
      setStatus(
        `Recompute ${MOVIES[bad].title}: twins rated ${a}★ and ${b}★, so (${a}+${b})÷2.`,
      );
      onComplete({ passed: false, detail: "A prediction doesn't match the twin average." });
      return;
    }
    setSolved(true);
    firedRef.current = true;
    const best = predictFor(4) >= predictFor(5) ? 4 : 5;
    setStatus(`Recommended: ${MOVIES[best].title} ${MOVIES[best].emoji} — users like you loved it!`);
    onComplete({ passed: true, stars: 3, detail: "Found your taste twins and predicted both ratings." });
  }, [solved, twinsChosen, twinsCorrect, picks, pred, onComplete]);

  const reset = useCallback((): void => {
    setCompared(new Set());
    setActive(null);
    setPicks([]);
    setPred({ 4: null, 5: null });
    setSolved(false);
    setShowPop(false);
    setStatus("Tap Compare on each user to score how alike your taste is.");
  }, []);

  const allCompared = compared.size === USERS.length;
  const recMovie = predictFor(4) >= predictFor(5) ? 4 : 5;
  const popularIdx = useMemo(() => {
    // Most-rated (fewest blanks) among the unseen pair, for the personalisation toggle.
    const count = (idx: number): number =>
      USERS.reduce((n, u) => (u.row[idx] !== null ? n + 1 : n), 0);
    return count(4) >= count(5) ? 4 : 5;
  }, []);

  return (
    <div
      className="mx-auto flex w-full flex-col gap-3 font-mono text-ink"
      style={{ maxWidth: 440 }}
    >
      <style>{`
        @keyframes g10recommender-pop { 0%{transform:scale(.7);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes g10recommender-glow { 0%,100%{filter:drop-shadow(0 0 2px ${ACCENT})} 50%{filter:drop-shadow(0 0 7px ${ACCENT})} }
        .g10recommender-win { animation: g10recommender-pop 420ms ease-out both; }
        .g10recommender-pulse { animation: g10recommender-glow 1.6s ease-in-out infinite; }
      `}</style>

      {/* Ratings grid */}
      <div
        className="panel overflow-x-auto rounded-xl p-2"
        style={{ borderWidth: 1, borderStyle: "solid", borderColor: solved ? ACCENT : "var(--color-line, #27314f)" }}
      >
        <table className="w-full border-collapse text-center text-[11px]">
          <thead>
            <tr>
              <th className="px-1 py-1 text-left text-ink-faint">user</th>
              {MOVIES.map((m, i) => (
                <th
                  key={m.key}
                  className="px-1 py-1"
                  style={{ color: UNSEEN.includes(i) ? ACCENT : "#9aa6cf" }}
                  title={m.title}
                >
                  <span aria-hidden="true">{m.emoji}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {USERS.map((u, ui) => {
              const isActive = active === ui;
              const isPicked = picks.includes(ui);
              return (
                <tr
                  key={u.name}
                  style={{
                    background: isPicked
                      ? "rgba(168,85,247,0.16)"
                      : isActive
                        ? "rgba(168,85,247,0.07)"
                        : "transparent",
                  }}
                >
                  <td className="px-1 py-1 text-left text-ink-dim">
                    <span aria-hidden="true">{u.emoji}</span> {u.name}
                  </td>
                  {u.row.map((r, ci) => {
                    const both = isActive && r !== null && YOU[ci] !== null;
                    return (
                      <td
                        key={ci}
                        className="px-1 py-1 tabular-nums"
                        style={{
                          color: r === null ? "#566" : "#cbd3ef",
                          background: both ? "rgba(168,85,247,0.22)" : undefined,
                          borderRadius: 4,
                          fontWeight: both ? 700 : 400,
                        }}
                      >
                        {r === null ? "·" : r}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* YOU row */}
            <tr style={{ borderTop: `1px solid ${ACCENT}` }}>
              <td className="px-1 py-1 text-left font-display" style={{ color: ACCENT }}>
                🍿 You
              </td>
              {YOU.map((r, ci) => (
                <td
                  key={ci}
                  className="px-1 py-1 tabular-nums"
                  style={{ color: r === null ? ACCENT : "#cbd3ef", fontWeight: r === null ? 700 : 400 }}
                >
                  {r === null ? "?" : r}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Step 1 — Compare */}
      <div className="panel rounded-xl p-2.5">
        <p className="mb-1.5 text-[11px] text-ink-dim">
          <span style={{ color: ACCENT }}>1.</span> Compare taste — cosine similarity (0–100%)
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {USERS.map((u, i) => (
            <button
              key={u.name}
              type="button"
              onPointerDown={() => compare(i)}
              disabled={solved}
              aria-label={`Compare your taste with ${u.name}`}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] disabled:opacity-60"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: active === i ? ACCENT : "var(--color-line, #27314f)",
                background: "rgba(11,16,32,0.6)",
                color: "#cbd3ef",
                touchAction: "manipulation",
              }}
            >
              <span>
                {u.emoji} {u.name}
              </span>
              {compared.has(i) ? (
                <span className="font-display tabular-nums" style={{ color: SIM[i] >= 50 ? ACCENT : "#7c89b0" }}>
                  {SIM[i]}%
                </span>
              ) : (
                <span className="text-ink-faint">compare</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — Taste twins */}
      <div className="panel rounded-xl p-2.5">
        <p className="mb-1.5 text-[11px] text-ink-dim">
          <span style={{ color: ACCENT }}>2.</span> Pick your TOP-2 taste twins{" "}
          <span className="text-ink-faint">({picks.length}/2)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {USERS.map((u, i) => (
            <button
              key={u.name}
              type="button"
              onPointerDown={() => togglePick(i)}
              disabled={solved || (!compared.has(i) && !picks.includes(i))}
              aria-pressed={picks.includes(i)}
              aria-label={`${picks.includes(i) ? "Remove" : "Add"} ${u.name} as a taste twin`}
              className="rounded-full px-2.5 py-1 text-[11px] disabled:opacity-40"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: picks.includes(i) ? ACCENT : "var(--color-line, #27314f)",
                background: picks.includes(i) ? "rgba(168,85,247,0.2)" : "rgba(11,16,32,0.6)",
                color: picks.includes(i) ? "#fff" : "#9aa6cf",
                touchAction: "manipulation",
              }}
            >
              {u.emoji} {u.name}
              {compared.has(i) ? ` · ${SIM[i]}%` : ""}
            </button>
          ))}
        </div>
        {!allCompared && (
          <p className="mt-1.5 text-[10px] text-ink-faint">
            Tip: Compare everyone first so you can see who scores highest.
          </p>
        )}
      </div>

      {/* Step 3 — Predict */}
      <div className="panel rounded-xl p-2.5">
        <p className="mb-1.5 text-[11px] text-ink-dim">
          <span style={{ color: ACCENT }}>3.</span> Predict your rating = (twinA + twinB) ÷ 2
        </p>
        {UNSEEN.map((mi) => {
          const a = USERS[TWINS[0]].row[mi] as number;
          const b = USERS[TWINS[1]].row[mi] as number;
          return (
            <div key={mi} className="mb-2 last:mb-0">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span style={{ color: ACCENT }}>
                  {MOVIES[mi].emoji} {MOVIES[mi].title}
                </span>
                <span className="text-ink-faint tabular-nums">
                  {twinsCorrect ? `(${a} + ${b}) ÷ 2 = ?` : "(twinA + twinB) ÷ 2"}
                </span>
              </div>
              <div className="flex gap-1.5">
                {OPTIONS[mi].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onPointerDown={() => setPrediction(mi, opt)}
                    disabled={solved}
                    aria-pressed={pred[mi] === opt}
                    aria-label={`Predict ${opt} stars for ${MOVIES[mi].title}`}
                    className="flex-1 rounded-lg px-1 py-1.5 text-[12px] tabular-nums disabled:opacity-60"
                    style={{
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor: pred[mi] === opt ? ACCENT : "var(--color-line, #27314f)",
                      background: pred[mi] === opt ? "rgba(168,85,247,0.2)" : "rgba(11,16,32,0.6)",
                      color: pred[mi] === opt ? "#fff" : "#cbd3ef",
                      touchAction: "manipulation",
                    }}
                  >
                    <Stars n={opt} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status + actions */}
      <div
        className="panel rounded-xl px-3 py-2 text-center text-[12px]"
        role="status"
        aria-live="polite"
        style={solved ? { background: ACCENT, color: "#0a0612" } : { color: "#9aa6cf" }}
      >
        {solved ? (
          <span className="g10recommender-win inline-block font-display">
            ✨🎉 {status} ⭐⭐⭐
          </span>
        ) : (
          status
        )}
      </div>

      {solved && (
        <div
          className="panel g10recommender-pulse rounded-xl p-3 text-center"
          style={{ borderWidth: 1, borderStyle: "solid", borderColor: ACCENT }}
        >
          <div className="text-2xl" aria-hidden="true">
            {MOVIES[recMovie].emoji}
          </div>
          <div className="mt-1 font-display text-sm" style={{ color: ACCENT }}>
            We recommend: {MOVIES[recMovie].title}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-dim">
            Users similar to you also liked this — predicted {predictFor(recMovie)}★.
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={check}
          disabled={solved}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT, color: "#0a0612", touchAction: "manipulation" }}
          aria-label="Check your taste twins and predictions"
        >
          {solved ? "Recommended!" : "Run engine"}
        </button>
        <button
          type="button"
          onPointerDown={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          style={{ touchAction: "manipulation" }}
          aria-label="Reset the recommender"
        >
          Reset
        </button>
      </div>

      {/* Personalisation toggle */}
      <button
        type="button"
        onPointerDown={() => setShowPop((s) => !s)}
        className="text-left text-[10px] underline decoration-dotted"
        style={{ color: "#7c89b0", touchAction: "manipulation" }}
        aria-expanded={showPop}
      >
        Why not just recommend the most popular movie?
      </button>
      {showPop && (
        <p className="text-[10px] leading-snug text-ink-faint">
          The most-rated movie is {MOVIES[popularIdx].title} {MOVIES[popularIdx].emoji} — popular,
          but Ivy &amp; Sam (opposite taste) rated it too, so &quot;popular&quot; isn&apos;t the same as
          &quot;right for you&quot;. Collaborative filtering only listens to your taste twins, so your pick is{" "}
          <span style={{ color: ACCENT }}>{MOVIES[recMovie].title}</span> — personalised, not just popular.
        </p>
      )}
    </div>
  );
}
