"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";

/**
 * Full-viewport horizontal carousel. Each child is one slide; the cosmos
 * backdrop (CosmosFX) stays fixed behind them. Every transition fires a warp
 * burst in the starfield (window.__clWarp). Drive with the Prev/Next buttons,
 * the dot rail, ← → arrow keys, or a touch swipe.
 */
export function CosmicCarousel({
  children,
  labels = [],
  sectors = [],
  immersiveSlides = [],
}: {
  children: React.ReactNode;
  labels?: string[];
  sectors?: string[];
  /** Slide indices that play as a full-screen film: autoplay pauses and all
   *  page chrome (header, nav arrows, dots, mission HUD) is hidden while active. */
  immersiveSlides?: number[];
}) {
  const slides = Children.toArray(children);
  const n = slides.length;
  const [i, setI] = useState(0);
  const immersive = immersiveSlides.includes(i);
  const [pulse, setPulse] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const first = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);

  // keep latest sector labels without making them an effect dependency
  const sectorsRef = useRef(sectors);
  sectorsRef.current = sectors;

  const go = useCallback(
    (next: number) => setI(() => Math.max(0, Math.min(n - 1, next))),
    [n],
  );

  // own the page chrome: lock body scroll + hide the global footer while mounted
  useEffect(() => {
    document.body.classList.add("cl-carousel-page");
    return () => document.body.classList.remove("cl-carousel-page");
  }, []);

  // immersive (cinematic) slides take over the screen: strip header + carousel
  // chrome + cosmos HUD via a body class (see .cl-takeover in globals.css)
  useEffect(() => {
    document.body.classList.toggle("cl-takeover", immersive);
    return () => document.body.classList.remove("cl-takeover");
  }, [immersive]);

  // on each slide change: replay the aurora bloom + update the mission HUD sector
  useEffect(() => {
    (window as unknown as { __clSector?: (n: string) => void }).__clSector?.(sectorsRef.current[i] ?? "");
    if (first.current) {
      first.current = false;
      return;
    }
    setPulse((p) => p + 1);
  }, [i]);

  // keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  // autoplay — advance every 3s and loop. Pauses on hover (set via paused) and
  // honours reduced-motion. The timer is keyed to `i`, so any manual nav resets
  // the countdown for clean pacing.
  useEffect(() => {
    if (paused || n <= 1 || immersive) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Cinematic studio-intro / video slides are long loops — hold them ~15s
    // (one full loop) so they're actually seen, instead of skipping at 3s.
    const slide = rootRef.current?.querySelectorAll<HTMLElement>(".cl-slide")[i];
    const cinematic = !!slide?.querySelector(".hero-intro, .hero-video, .draw-sky");
    const t = window.setTimeout(() => setI((cur) => (cur + 1) % n), cinematic ? 15000 : 3000);
    return () => window.clearTimeout(t);
  }, [i, paused, n, immersive]);

  // zero-scroll: scale the active slide's content with CSS `zoom` so it always
  // fits the viewport — no scrollbar. `offsetHeight` reports the natural
  // (zoom-independent) content height, so we compute the target directly and
  // only write it when it actually changes — that's idempotent, so the
  // ResizeObserver can safely re-fit when content settles or the sample lab is
  // switched without ever looping. Floored at 0.45 (the slide's overflow
  // scroll stays as a last-resort fallback below that).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const slide = root.querySelectorAll<HTMLElement>(".cl-slide")[i];
    const inner = slide?.querySelector<HTMLElement>(".cl-slide-inner");
    if (!slide || !inner) return;

    const fit = () => {
      const avail = slide.clientHeight;
      const natural = inner.offsetHeight;
      if (!avail || !natural) return;
      const target = natural > avail ? Math.max(0.42, (avail - 2) / natural) : 1;
      const current = parseFloat(inner.style.zoom) || 1;
      if (Math.abs(current - target) > 0.003) inner.style.zoom = target === 1 ? "" : String(target);
    };

    fit();
    const t1 = window.setTimeout(fit, 300); // catch late layout (fonts, lab init)
    const t2 = window.setTimeout(fit, 1200);
    window.addEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(inner);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, [i]);

  // anchor / deep-link nav: an in-page link like #samples or #grades jumps to
  // the slide that contains that element (the body is scroll-locked, so plain
  // anchor scrolling can't reach off-screen slides).
  useEffect(() => {
    const gotoHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const slideEl = document.getElementById(id)?.closest(".cl-slide");
      const parent = slideEl?.parentElement;
      if (slideEl && parent) {
        const idx = Array.prototype.indexOf.call(parent.children, slideEl);
        if (idx >= 0) go(idx);
      }
    };
    window.addEventListener("hashchange", gotoHash);
    gotoHash(); // honour deep links on first load
    return () => window.removeEventListener("hashchange", gotoHash);
  }, [go]);

  return (
    <div
      ref={rootRef}
      className="cl-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {pulse > 0 && <div key={pulse} className="cl-flash" aria-hidden />}
      <div className="cl-track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((slide, idx) => (
          <div
            key={idx}
            className="cl-slide"
            aria-hidden={idx !== i}
            inert={idx !== i}
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current == null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              if (Math.abs(dx) > 55) go(i + (dx < 0 ? 1 : -1));
              touchX.current = null;
            }}
          >
            <div className="cl-slide-inner">{slide}</div>
          </div>
        ))}
      </div>

      {/* prev / next */}
      <button
        className="cl-nav cl-prev"
        onClick={() => go(i - 1)}
        disabled={i === 0}
        aria-label="Previous slide"
      >
        ‹
      </button>
      <button
        className="cl-nav cl-next"
        onClick={() => go(i + 1)}
        disabled={i === n - 1}
        aria-label="Next slide"
      >
        ›
      </button>

      {/* dot rail + counter */}
      <div className="cl-rail">
        <span className="cl-count">
          {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
        </span>
        <div className="cl-dots">
          {slides.map((_, idx) => (
            <button
              key={idx}
              className={"cl-dot" + (idx === i ? " on" : "")}
              onClick={() => go(idx)}
              aria-label={labels[idx] || `Slide ${idx + 1}`}
              title={labels[idx]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
