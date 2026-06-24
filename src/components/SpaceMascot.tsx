"use client";

import { useEffect, useRef } from "react";

/**
 * A floating astronaut buddy for the hero — drifts gently, glows, and lazily
 * leans toward the cursor so the cosmos feels alive and companioned. Purely
 * decorative (pointer-safe), hidden on small screens + reduced-motion.
 */
export function SpaceMascot() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!matchMedia("(pointer: fine)").matches) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
        el.style.setProperty("--mx", clamp(dx * 0.05, 30).toFixed(1) + "px");
        el.style.setProperty("--my", clamp(dy * 0.05, 30).toFixed(1) + "px");
        el.style.setProperty("--mtilt", clamp(dx * 0.02, 16).toFixed(1) + "deg");
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="space-mascot" aria-hidden>
      <div className="space-mascot-lean">
        <span className="space-mascot-glow" />
        <span className="space-mascot-emoji">🧑‍🚀</span>
        <span className="space-mascot-wave">👋</span>
      </div>
    </div>
  );
}
