"use client";

/** The cinematic landing hero: aurora + planet + orbit rings + shimmer headline. */
export function CinematicHero() {
  return (
    <section className="hero" id="home">
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
        <span className="line-1">Explore. Build.</span>
        <span className="line-orange">Innovate.</span>
        <span className="line-blue">Create Future.</span>
      </h1>

      <p className="hero-sub">
        Where young makers discover Coding, Robotics, AI and 3D Modelling through
        hands-on browser labs, real projects and instant feedback — powered by Physics Wallah.
      </p>
    </section>
  );
}
