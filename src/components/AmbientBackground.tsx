import type { CSSProperties } from "react";

/**
 * Reusable animated backdrop. JS-free: static markup + pure-CSS keyframes
 * (transform/opacity only) — costs the server nothing and stays smooth on
 * low-end devices at any concurrency. Honours prefers-reduced-motion.
 *
 * Position/animation "slots" are fixed; callers inject colours (`palette`)
 * and `glyphs`, plus a `tone` that controls density + how loud it reads.
 */

type Tone = "rich" | "calm";

type BlobSlot = { size: number; top: string; left: string; anim: string; dur: number };
type GlyphSlot = { top: string; left: string; size: number; dur: number; delay: number; rot: number };
type NodeSlot = { top: string; left: string; size: number; dur: number; delay: number };

const BLOB_SLOTS: BlobSlot[] = [
  { size: 450, top: "-8%", left: "6%", anim: "hb-drift-a", dur: 27 },
  { size: 520, top: "4%", left: "66%", anim: "hb-drift-b", dur: 34 },
  { size: 400, top: "48%", left: "30%", anim: "hb-drift-c", dur: 30 },
  { size: 350, top: "26%", left: "82%", anim: "hb-drift-a", dur: 37 },
  { size: 240, top: "60%", left: "78%", anim: "hb-drift-b", dur: 40 },
];

const GLYPH_SLOTS: GlyphSlot[] = [
  { top: "16%", left: "7%", size: 40, dur: 18, delay: 0, rot: -8 },
  { top: "62%", left: "10%", size: 36, dur: 21, delay: 1.4, rot: 12 },
  { top: "30%", left: "90%", size: 38, dur: 19, delay: 0.6, rot: 0 },
  { top: "12%", left: "78%", size: 26, dur: 14, delay: 0.3, rot: 0 },
  { top: "72%", left: "86%", size: 34, dur: 23, delay: 2.1, rot: -10 },
  { top: "78%", left: "44%", size: 30, dur: 10, delay: 1.0, rot: 6 },
  { top: "8%", left: "40%", size: 30, dur: 15, delay: 0.8, rot: -6 },
  { top: "46%", left: "4%", size: 32, dur: 12, delay: 1.7, rot: 8 },
  { top: "40%", left: "60%", size: 22, dur: 8, delay: 0.5, rot: 0 },
  { top: "84%", left: "64%", size: 30, dur: 13, delay: 2.6, rot: -5 },
];

const NODE_SLOTS: NodeSlot[] = [
  { top: "20%", left: "22%", size: 5, dur: 5.1, delay: 0 },
  { top: "34%", left: "48%", size: 4, dur: 4.2, delay: 0.4 },
  { top: "18%", left: "62%", size: 6, dur: 6.1, delay: 0.9 },
  { top: "54%", left: "16%", size: 4, dur: 4.6, delay: 1.3 },
  { top: "66%", left: "52%", size: 5, dur: 5.4, delay: 0.2 },
  { top: "72%", left: "30%", size: 4, dur: 3.8, delay: 1.6 },
  { top: "44%", left: "74%", size: 5, dur: 5.8, delay: 0.7 },
  { top: "28%", left: "34%", size: 3, dur: 4.3, delay: 1.1 },
  { top: "58%", left: "66%", size: 4, dur: 3.1, delay: 1.9 },
  { top: "82%", left: "20%", size: 5, dur: 3.5, delay: 0.5 },
  { top: "14%", left: "52%", size: 3, dur: 2.5, delay: 1.4 },
  { top: "50%", left: "90%", size: 4, dur: 3.0, delay: 0.9 },
];

const TONES: Record<Tone, { blobs: number; glyphs: number; nodes: number; glyphOpacity: number; blobOpacity: number }> = {
  rich: { blobs: 4, glyphs: 5, nodes: 8, glyphOpacity: 0.15, blobOpacity: 0.34 },
  calm: { blobs: 4, glyphs: 7, nodes: 8, glyphOpacity: 0.18, blobOpacity: 0.42 },
};

export function AmbientBackground({
  palette,
  glyphs,
  tone = "rich",
}: {
  palette: string[];
  glyphs: string[];
  tone?: Tone;
}) {
  const t = TONES[tone];

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {BLOB_SLOTS.slice(0, t.blobs).map((b, i) => (
        <div
          key={`b${i}`}
          className="hb-aurora"
          style={{
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            opacity: t.blobOpacity,
            background: `radial-gradient(circle at center, ${palette[i % palette.length]} 0%, transparent 78%)`,
            animation: `${b.anim} ${b.dur}s ease-in-out infinite`,
          }}
        />
      ))}

      {NODE_SLOTS.slice(0, t.nodes).map((n, i) => {
        const c = palette[i % palette.length];
        return (
          <span
            key={`n${i}`}
            className="hb-node"
            style={{
              top: n.top,
              left: n.left,
              width: n.size,
              height: n.size,
              background: c,
              boxShadow: `0 0 8px ${c}`,
              animation: `hb-twinkle ${n.dur}s ease-in-out ${n.delay}s infinite`,
            }}
          />
        );
      })}

      {GLYPH_SLOTS.slice(0, t.glyphs).map((g, i) => (
        <span
          key={`g${i}`}
          className="hb-glyph"
          style={
            {
              top: g.top,
              left: g.left,
              fontSize: g.size,
              opacity: t.glyphOpacity,
              "--r": `${g.rot}deg`,
              animation: `hb-float ${g.dur}s ease-in-out ${g.delay}s infinite`,
            } as CSSProperties
          }
        >
          {glyphs[i % glyphs.length]}
        </span>
      ))}
    </div>
  );
}
