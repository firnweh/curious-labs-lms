/* Maker Lab — "Midnight + Electric Cyan" premium design tokens (scoped to the
   lab; the rest of the site keeps its own theme). Class strings for glass
   panels, pill buttons, and accents so every surface stays consistent. */

export const ACCENT = "#22d3ee";

// surfaces
export const CARD =
  "rounded-2xl border border-white/10 bg-[#0c1222]/70 backdrop-blur-xl shadow-[0_12px_40px_-16px_rgba(0,0,0,0.7)]";
export const GLASS = "rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl";
export const HAIRLINE = "border-white/10";

// text
export const TEXT = "text-[#e8eefc]";
export const MUTED = "text-[#8595bd]";
export const FAINT = "text-[#566091]";

// pill buttons
export const PILL = "rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide transition-all";
export const PILL_GHOST = "text-[#8595bd] hover:bg-white/[0.06] hover:text-[#e8eefc]";
export const PILL_ACTIVE =
  "bg-cyan-400/15 text-cyan-200 shadow-[0_0_20px_-2px_rgba(34,211,238,0.45)] ring-1 ring-cyan-300/30";
export const PILL_CYAN =
  "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/30 hover:bg-cyan-400/25 hover:shadow-[0_0_22px_-2px_rgba(34,211,238,0.55)]";

// a small chip/button used in toolbars
export const CHIP =
  "rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[#8595bd] transition-all hover:border-cyan-300/40 hover:text-[#e8eefc] hover:shadow-[0_0_18px_-4px_rgba(34,211,238,0.5)]";

export const MONO = "font-[family-name:var(--font-jbmono)]";
