"use client";

import { type CSSProperties, useEffect, useRef } from "react";

/** Split a line into per-letter spans, continuing a shared index so the ripple
 *  travels letter-to-letter across the whole headline (spaces ripple too). */
function letters(text: string, ctr: { i: number }) {
  return Array.from(text).map((ch, k) => (
    <span key={k} className="hw" style={{ "--i": ctr.i++ } as CSSProperties}>
      {ch === " " ? " " : ch}
    </span>
  ));
}

/** The cinematic landing hero: aurora + planet + orbit rings + rippling headline. */
export function CinematicHero() {
  const ctr = { i: 0 };
  const heroRef = useRef<HTMLElement>(null);

  // Cursor-driven depth parallax: the planet (near) and orbit system (far) shift
  // at different rates as you move, so the scene feels like a 3D space you float in.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = heroRef.current;
        if (!el) return;
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        el.style.setProperty("--hx", (nx * 30).toFixed(1) + "px");
        el.style.setProperty("--hy", (ny * 22).toFixed(1) + "px");
        el.style.setProperty("--ox", (nx * -18).toFixed(1) + "px");
        el.style.setProperty("--oy", (ny * -14).toFixed(1) + "px");
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="hero" id="home" ref={heroRef}>
      {/* orbit rings + planet (decorative) */}
      <div className="orbit-system" aria-hidden>
        <div className="orbit-ring" />
        <div className="orbit-ring r2" />
        <div className="orbit-sat" />
        <div className="orbit-sat s2" />
        <div className="orbit-sat s3" />
      </div>
      <div className="hero-planet" aria-hidden>
        <i />
      </div>

      <div className="hero-badge">
        <span className="badge-dot" />
        India&apos;s #1 STEM Innovation Platform
      </div>

      <h1>
        <span className="line-1">{letters("Explore. Build.", ctr)}</span>
        <span className="line-orange">{letters("Innovate.", ctr)}</span>
        <span className="line-blue">{letters("Create Future.", ctr)}</span>
      </h1>

      <p className="hero-sub">
        Where young makers discover Coding, Robotics, AI and 3D Modelling through
        hands-on browser labs, real projects and instant feedback — powered by Physics Wallah.
      </p>
    </section>
  );
}
