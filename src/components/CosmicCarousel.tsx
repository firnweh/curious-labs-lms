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
}: {
  children: React.ReactNode;
  labels?: string[];
  sectors?: string[];
}) {
  const slides = Children.toArray(children);
  const n = slides.length;
  const [i, setI] = useState(0);
  const [pulse, setPulse] = useState(0);
  const touchX = useRef<number | null>(null);
  const first = useRef(true);

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

  return (
    <div className="cl-carousel">
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
