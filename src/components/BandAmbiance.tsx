"use client";

import { useBand } from "@/lib/bands";
import { useMounted } from "@/lib/progress";

/**
 * A soft, full-viewport glow that takes on the SELECTED class band's colour
 * (junior green / explorer cyan / innovator violet) and smoothly cross-fades
 * when you switch bands — so the page itself reacts to your pick. Sits over the
 * cosmic backdrop (z-0) and under the page content (z-10).
 */
export function BandAmbiance() {
  const { info } = useBand();
  const mounted = useMounted();
  const accent = mounted ? info.accent : "#22d3ee";

  const blob =
    "absolute rounded-full blur-[110px] transition-[background-color] duration-700 ease-out";

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className={blob} style={{ background: accent, opacity: 0.22, width: "44vh", height: "44vh", top: "-6%", left: "4%" }} />
      <div className={blob} style={{ background: accent, opacity: 0.18, width: "40vh", height: "40vh", top: "32%", right: "1%" }} />
      <div className={blob} style={{ background: accent, opacity: 0.16, width: "38vh", height: "38vh", bottom: "-8%", left: "36%" }} />
    </div>
  );
}
