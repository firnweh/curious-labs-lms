"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * AI Lab — "Group the Unknown" (Clustering · k-means).
 *
 * ~18 UNLABELLED points sit on a 2-D map. The child picks k (2 or 3) and runs
 * k-means: deterministic init (centroids spread evenly along the data diagonal),
 * then assign→update iterations. Points are coloured by cluster, centroids drawn
 * as ✕, and points far from every centroid get a faint "outlier" ring.
 *
 * The big idea: NO labels are given. The AI groups by *similarity* alone — and
 * the SAME points split differently depending on the k you choose. Fully
 * deterministic: no Math.random, no Date.now. Pure React + SVG.
 */

const ACCENT = "#a855f7";

// Fixed, unlabelled points (0..1). Three natural blobs + two lone outliers.
const POINTS: { x: number; y: number }[] = [
  // blob A — lower-left
  { x: 0.14, y: 0.2 }, { x: 0.2, y: 0.14 }, { x: 0.1, y: 0.32 },
  { x: 0.26, y: 0.26 }, { x: 0.18, y: 0.38 },
  // blob B — upper-right
  { x: 0.82, y: 0.84 }, { x: 0.74, y: 0.9 }, { x: 0.9, y: 0.74 },
  { x: 0.86, y: 0.92 }, { x: 0.76, y: 0.78 },
  // blob C — lower-right
  { x: 0.84, y: 0.18 }, { x: 0.9, y: 0.28 }, { x: 0.76, y: 0.24 },
  { x: 0.88, y: 0.12 },
  // outliers — far from any blob
  { x: 0.5, y: 0.5 },
  { x: 0.46, y: 0.92 },
  // a couple more to fill blobs naturally
  { x: 0.3, y: 0.16 }, { x: 0.7, y: 0.86 },
];

// Cluster palette (primary accent first so k=1-ish reads as the accent).
const COLORS = ["#a855f7", "#22d3ee", "#eab308"];

interface Centroid { x: number; y: number }
interface Frame {
  // assignment of each point to a centroid index (after the assign step)
  assign: number[];
  // centroid positions shown in this frame
  centroids: Centroid[];
  // phase: did this frame just re-assign, or just move centroids?
  phase: "assign" | "move";
}

const dist2 = (ax: number, ay: number, bx: number, by: number) =>
  (ax - bx) ** 2 + (ay - by) ** 2;

/** Deterministic init: spread k centroids evenly along the data diagonal. */
function initCentroids(k: number): Centroid[] {
  const out: Centroid[] = [];
  for (let i = 0; i < k; i++) {
    const t = k === 1 ? 0.5 : (i + 0.5) / k; // 0..1 along the diagonal
    out.push({ x: 0.12 + t * 0.76, y: 0.12 + t * 0.76 });
  }
  return out;
}

/** Build the full deterministic k-means timeline as a list of frames. */
function buildFrames(k: number): Frame[] {
  let centroids = initCentroids(k);
  const frames: Frame[] = [];
  const assignAll = (cs: Centroid[]): number[] =>
    POINTS.map((p) => {
      let best = 0;
      let bestD = Infinity;
      cs.forEach((c, ci) => {
        const d = dist2(p.x, p.y, c.x, c.y);
        if (d < bestD) { bestD = d; best = ci; }
      });
      return best;
    });

  for (let iter = 0; iter < 6; iter++) {
    // assign step
    const assign = assignAll(centroids);
    frames.push({ assign, centroids: centroids.map((c) => ({ ...c })), phase: "assign" });

    // update step — mean of assigned points (empty clusters stay put)
    const next: Centroid[] = centroids.map((c, ci) => {
      let sx = 0, sy = 0, n = 0;
      POINTS.forEach((p, pi) => {
        if (assign[pi] === ci) { sx += p.x; sy += p.y; n++; }
      });
      return n === 0 ? c : { x: sx / n, y: sy / n };
    });
    frames.push({ assign, centroids: next.map((c) => ({ ...c })), phase: "move" });
    centroids = next;
  }
  return frames;
}

// The two designed "loner" points (see POINTS) that fit no blob. A fixed
// distance threshold mis-fires when a small k merges real blobs into one
// cluster (a whole tight blob then looks "far"), so we mark the intended
// outliers directly — correct and honest at any k.
const OUTLIER_IDX = new Set<number>([14, 15]);

export default function GroupTheUnknown() {
  const [k, setK] = useState(2);
  const [frameIdx, setFrameIdx] = useState(-1); // -1 = nothing run yet

  // Recompute the whole deterministic timeline when k changes.
  const frames = useMemo(() => buildFrames(k), [k]);
  const cur = frameIdx >= 0 ? frames[Math.min(frameIdx, frames.length - 1)] : null;
  const done = frameIdx >= frames.length - 1;

  // Which points are outliers (only meaningful once we have a settled frame).
  const outliers = useMemo(() => (cur ? OUTLIER_IDX : new Set<number>()), [cur]);

  const pickK = useCallback((nk: number) => { setK(nk); setFrameIdx(-1); }, []);
  const group = useCallback(() => setFrameIdx(frames.length - 1), [frames.length]);
  const step = useCallback(() => setFrameIdx((i) => Math.min(i + 1, frames.length - 1)), [frames.length]);
  const reset = useCallback(() => setFrameIdx(-1), []);

  // SVG mapping (0..1 → 0..100, y flipped).
  const sx = (x: number) => x * 100;
  const sy = (y: number) => (1 - y) * 100;

  // Cluster sizes for the legend (from current assignment).
  const sizes = useMemo(() => {
    const arr = new Array(k).fill(0);
    if (cur) cur.assign.forEach((a) => { arr[a]++; });
    return arr as number[];
  }, [cur, k]);

  const iterNo = frameIdx < 0 ? 0 : Math.floor(frameIdx / 2) + 1;
  const phase = cur?.phase;

  const teach =
    frameIdx < 0
      ? `🔮 ${POINTS.length} points, NO labels. Pick k = how many groups to look for, then press Group.`
      : !done
        ? phase === "assign"
          ? `🎯 Step ${iterNo}: each point joins its NEAREST ✕ centre. Similar points end up together.`
          : `➡️ Step ${iterNo}: each ✕ slides to the MIDDLE of its points. Now they re-decide…`
        : k === 2
          ? `✨ With k=2 the AI found 2 groups by similarity alone — no labels needed. The faint-ringed points are outliers: loners that fit no group well. Now switch to k=3 and watch the SAME points split differently!`
          : `✨ With k=3 the SAME points split into 3 groups! Nothing about the data changed — only YOUR choice of k. There's no single "right" k; clustering finds patterns, you pick how many.`;

  return (
    <div className="w-full" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="mx-auto flex max-w-[920px] flex-col gap-4 p-4">
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden style={{ fontSize: 24 }}>🔮</span>
          <span className="font-mono text-base font-semibold" style={{ color: "#e8eefc" }}>
            Group the Unknown
          </span>
          <span
            className="rounded-md px-2 py-0.5 font-mono text-[10px]"
            style={{ background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}55` }}
          >
            Grades 6-9
          </span>
          <span className="font-mono text-[11px]" style={{ color: "#5b6b8c" }}>
            · Clustering · k-means
          </span>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Map */}
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <div className="w-full max-w-[520px]" style={{ aspectRatio: "1 / 1" }}>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="h-full w-full rounded-2xl border"
                style={{ background: "#0b1018", borderColor: "#1e2738" }}
              >
                {/* grid */}
                {[25, 50, 75].map((g) => (
                  <g key={g} stroke="#1e2738" strokeWidth={0.3}>
                    <line x1={g} y1={0} x2={g} y2={100} />
                    <line x1={0} y1={g} x2={100} y2={g} />
                  </g>
                ))}

                {/* faint links from each point to its centroid (after grouping) */}
                {cur && POINTS.map((p, pi) => {
                  const c = cur.centroids[cur.assign[pi]];
                  return (
                    <line
                      key={`l${pi}`}
                      x1={sx(p.x)} y1={sy(p.y)} x2={sx(c.x)} y2={sy(c.y)}
                      stroke={COLORS[cur.assign[pi] % COLORS.length]}
                      strokeWidth={0.35}
                      opacity={0.35}
                    />
                  );
                })}

                {/* points */}
                {POINTS.map((p, pi) => {
                  const ci = cur ? cur.assign[pi] : -1;
                  const fill = ci < 0 ? "#5b6b8c" : COLORS[ci % COLORS.length];
                  const isOut = cur && done && outliers.has(pi);
                  return (
                    <g key={`p${pi}`}>
                      {isOut && (
                        <circle cx={sx(p.x)} cy={sy(p.y)} r={4.6} fill="none" stroke="#9fb0d0" strokeWidth={0.5} strokeDasharray="1.2 1.2" opacity={0.7} />
                      )}
                      <circle cx={sx(p.x)} cy={sy(p.y)} r={2.6} fill={fill} stroke="#0b1018" strokeWidth={0.6} />
                    </g>
                  );
                })}

                {/* centroids as ✕ */}
                {cur && cur.centroids.map((c, ci) => (
                  <g key={`c${ci}`} stroke={COLORS[ci % COLORS.length]} strokeWidth={1.4} strokeLinecap="round">
                    <line x1={sx(c.x) - 2.6} y1={sy(c.y) - 2.6} x2={sx(c.x) + 2.6} y2={sy(c.y) + 2.6} />
                    <line x1={sx(c.x) - 2.6} y1={sy(c.y) + 2.6} x2={sx(c.x) + 2.6} y2={sy(c.y) - 2.6} />
                  </g>
                ))}
              </svg>
            </div>
            <p
              className="mt-2 max-w-[520px] text-center font-mono text-[11px] leading-relaxed"
              style={{ color: "#9fb0d0" }}
              aria-live="polite"
            >
              {teach}
            </p>
          </div>

          {/* Controls */}
          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[250px]">
            {/* k picker */}
            <div className="rounded-2xl border p-3" style={{ borderColor: "#1e2738", background: "#0f1420" }}>
              <p className="mb-2 font-mono text-[10px] tracking-wide" style={{ color: "#5b6b8c" }}>
                HOW MANY GROUPS? (k)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[2, 3].map((nk) => {
                  const on = k === nk;
                  return (
                    <button
                      key={nk}
                      onClick={() => pickK(nk)}
                      className="rounded-xl border-2 py-3 font-mono text-lg font-bold transition-colors"
                      style={{
                        borderColor: on ? ACCENT : "#1e2738",
                        background: on ? `${ACCENT}1a` : "transparent",
                        color: on ? ACCENT : "#9fb0d0",
                      }}
                    >
                      k = {nk}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group + Step */}
            <button
              onClick={group}
              className="rounded-2xl py-3 font-mono text-sm font-semibold transition-colors"
              style={{ background: ACCENT, color: "#1a0b2e", border: `2px solid ${ACCENT}` }}
            >
              🔮 Group it!
            </button>

            <div className="rounded-2xl border p-3" style={{ borderColor: "#1e2738", background: "#0f1420" }}>
              <button
                onClick={step}
                disabled={done && frameIdx >= 0}
                className="w-full rounded-xl border-2 py-2 font-mono text-xs transition-colors disabled:opacity-40"
                style={{ borderColor: "#22d3ee", color: "#22d3ee" }}
              >
                {frameIdx < 0 ? "▶ Step through it" : phase === "assign" ? "➡️ Move the ✕ centres" : "🎯 Re-assign points"}
              </button>
              <button
                onClick={reset}
                disabled={frameIdx < 0}
                className="mt-2 w-full rounded-xl border py-2 font-mono text-[11px] transition-colors disabled:opacity-40"
                style={{ borderColor: "#2a3550", color: "#9fb0d0" }}
              >
                🔄 Reset
              </button>
              {frameIdx >= 0 && (
                <p className="mt-2 text-center font-mono text-[10px]" style={{ color: "#5b6b8c" }}>
                  iteration {iterNo} / 6 · {phase === "assign" ? "assigned" : "centres moved"}
                </p>
              )}
            </div>

            {/* Legend / cluster sizes */}
            {cur && (
              <div className="rounded-2xl border p-3" style={{ borderColor: "#1e2738", background: "#0f1420" }}>
                <p className="mb-2 font-mono text-[10px] tracking-wide" style={{ color: "#5b6b8c" }}>
                  GROUPS FOUND
                </p>
                <div className="flex flex-col gap-1.5">
                  {sizes.map((n, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <span style={{ width: 12, height: 12, borderRadius: 99, background: COLORS[ci % COLORS.length], display: "inline-block" }} />
                      <span className="font-mono text-[11px]" style={{ color: "#e8eefc" }}>
                        Group {ci + 1}
                      </span>
                      <span className="ml-auto font-mono text-[11px]" style={{ color: "#9fb0d0" }}>
                        {n} pts
                      </span>
                    </div>
                  ))}
                  {done && outliers.size > 0 && (
                    <div className="mt-1 flex items-center gap-2">
                      <span style={{ width: 12, height: 12, borderRadius: 99, border: "1px dashed #9fb0d0", display: "inline-block" }} />
                      <span className="font-mono text-[11px]" style={{ color: "#9fb0d0" }}>
                        {outliers.size} outlier{outliers.size > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p
              className="rounded-xl border p-2.5 font-mono text-[10px] leading-relaxed"
              style={{ borderColor: "#1e2738", background: "#0f1420", color: "#5b6b8c" }}
            >
              No labels, no answers given. The AI groups points only by{" "}
              <span style={{ color: ACCENT }}>similarity</span> — points near each other land together. Change{" "}
              <span style={{ color: "#22d3ee" }}>k</span> and the same data groups a different way.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
