"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SUBJECT_MAP, SUBJECTS } from "@/lib/subjects";
import { ACTIVITIES } from "@/lib/activities/registry";
import { useSubjectTransition } from "@/components/SubjectTransition";
import type { SubjectId } from "@/lib/activities/types";

// real headline figures for the centre panel (kept honest from the registry)
const LABS_TOTAL = ACTIVITIES.length;
const STUDIOS_TOTAL = SUBJECTS.length;
const GRADES_TOTAL = 10;

/**
 * "Draw the Sky" — the hero refuses to perform until you drag. A comet-trail of
 * stardust follows your stroke; brushing a dim star ignites it (pop + chime).
 * Lighting all 7 stitches the constellation and blooms the wordmark — and the
 * four coloured stars become doorways into the studios. If you don't move, a
 * ghost-hand draws it for you, so the screen is never dead. Canvas, GPU-light;
 * reduced-motion shows the finished sky instantly.
 */

type Star = {
  fx: number; // fractional position 0..1
  fy: number;
  color: string;
  track?: SubjectId; // the 4 coloured stars are doorways
  label?: string;
  top?: boolean; // in the upper half → its label sits above the dot
};

// 5 big stars laid out as a 5-pointed star (pentagram). You start at the top
// star and trace; the 4 studio labs light up along the way. Closing the star
// fires a shockwave and pops the Curious Labs logo out of the middle. A far
// cooler shape than a box — you literally draw a star out of the labs.
const CX = 0.5;
const CY = 0.47;
const RX = 0.39;
const RY = 0.36;
const RING: { ang: number; color: string; track?: SubjectId; label?: string }[] = [
  { ang: -90, color: "#cfe3ff" }, // top apex — start
  { ang: -18, color: "#22d3ee", track: "coding", label: "Coding" }, // upper right
  { ang: 54, color: "#34d399", track: "robotics", label: "Robotics" }, // lower right
  { ang: 126, color: "#a855f7", track: "ai", label: "AI" }, // lower left
  { ang: 198, color: "#f59e0b", track: "threed", label: "3D" }, // upper left
];
const STARS: Star[] = RING.map((r) => {
  const rad = (r.ang * Math.PI) / 180;
  return {
    fx: CX + RX * Math.cos(rad),
    fy: CY + RY * Math.sin(rad),
    color: r.color,
    track: r.track,
    label: r.label,
    top: Math.sin(rad) < 0,
  };
});
// pentagram stroke order: skip one point each time → the classic 5-point star
const EDGES: [number, number][] = [
  [0, 2],
  [2, 4],
  [4, 1],
  [1, 3],
  [3, 0],
];
const TOTAL = STARS.length;

export function DrawTheSky() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  const [lit, setLit] = useState(0);
  const [stats, setStats] = useState({ labs: 0, studios: 0, grades: 0 });
  const transition = useSubjectTransition();

  // count the headline numbers up once the star completes — techy + impressive
  useEffect(() => {
    if (!done) return;
    const targets = { labs: LABS_TOTAL, studios: STUDIOS_TOTAL, grades: GRADES_TOTAL };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStats(targets);
      return;
    }
    const dur = 1100;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setStats({
        labs: Math.round(targets.labs * e),
        studios: Math.round(targets.studios * e),
        grades: Math.round(targets.grades * e),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done]);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!section || !canvas || !ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;

    // per-star runtime state
    const state = STARS.map(() => ({ on: false, t: 0 })); // t = ignite progress 0..1
    let litCount = 0;
    const trail: { x: number; y: number; a: number }[] = [];
    let ghost: { i: number; x: number; y: number } | null = null;
    let idleTimer = 0;
    let finished = false;
    let doneAt = 0; // timestamp the star was completed → drives the shockwave

    const sx = (i: number) => STARS[i].fx * W;
    const sy = (i: number) => STARS[i].fy * H;

    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // ── optional chime on ignite (graceful if blocked) ──
    let ac: AudioContext | null = null;
    const chime = (n: number) => {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        ac = ac ?? new Ctx();
        if (ac.state === "suspended") void ac.resume();
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = "sine";
        o.frequency.value = 440 * Math.pow(2, n / 12); // climbing notes
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.16, ac.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5);
        o.connect(g);
        g.connect(ac.destination);
        o.start();
        o.stop(ac.currentTime + 0.55);
      } catch {
        /* sound is a nicety */
      }
    };

    const ignite = (i: number) => {
      if (state[i].on) return;
      state[i].on = true;
      litCount += 1;
      setLit(litCount);
      chime([0, 4, 7, 11, 12, 14, 16][Math.min(litCount - 1, 6)]);
      if (litCount >= TOTAL && !finished) {
        finished = true;
        doneAt = performance.now();
        window.setTimeout(() => setDone(true), 480); // let the shockwave land, then bloom
      }
    };

    const tryIgniteAt = (x: number, y: number) => {
      for (let i = 0; i < TOTAL; i++) {
        if (state[i].on) continue;
        if (Math.hypot(x - sx(i), y - sy(i)) < 38) ignite(i);
      }
    };

    const ptr = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (W / r.width);
      const y = (e.clientY - r.top) * (H / r.height);
      trail.push({ x, y, a: 1 });
      if (trail.length > 70) trail.shift();
      tryIgniteAt(x, y);
      ghost = null;
      window.clearTimeout(idleTimer);
      if (!finished) idleTimer = window.setTimeout(startGhost, 6000);
    };

    // ── ghost-hand demo so the screen is never dead ──
    let ghostRaf = 0;
    const startGhost = () => {
      if (finished || ghost) return;
      let seg = 0;
      let p = 0;
      const step = () => {
        if (finished) return;
        const [a, b] = EDGES[seg];
        const x = sx(a) + (sx(b) - sx(a)) * p;
        const y = sy(a) + (sy(b) - sy(a)) * p;
        ghost = { i: seg, x, y };
        trail.push({ x, y, a: 1 });
        if (trail.length > 70) trail.shift();
        tryIgniteAt(x, y);
        p += 0.06;
        if (p >= 1) { p = 0; seg += 1; }
        if (seg < EDGES.length && !finished) ghostRaf = requestAnimationFrame(step);
        else ghost = null;
      };
      ghostRaf = requestAnimationFrame(step);
    };

    // ── main render loop ──
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      const t = performance.now();
      // connection lines: once both stars are lit, a glowing colour-gradient line
      // with a bright spark flowing along it; otherwise a faint DOTTED guide so
      // the visitor sees which star joins which and where to drag next.
      EDGES.forEach(([a, b], idx) => {
        const x1 = sx(a), y1 = sy(a), x2 = sx(b), y2 = sy(b);
        if (state[a].on && state[b].on) {
          // vivid while building, then settle to a calm glow so the logo reads
          const lineA = finished ? 0.42 : 0.95;
          const grad = ctx.createLinearGradient(x1, y1, x2, y2);
          grad.addColorStop(0, hexA(STARS[a].color, lineA));
          grad.addColorStop(1, hexA(STARS[b].color, lineA));
          ctx.save();
          ctx.strokeStyle = grad;
          ctx.lineWidth = finished ? 1.8 : 2.4;
          ctx.lineCap = "round";
          ctx.shadowColor = STARS[a].color;
          ctx.shadowBlur = finished ? 5 : 12;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.restore();
          // a bright spark flowing along each line — only during the build
          if (!finished) {
            const f = (t / 1000 * 0.5 + idx * 0.3) % 1;
            const px = x1 + (x2 - x1) * f, py = y1 + (y2 - y1) * f;
            ctx.save();
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.shadowColor = "#ffffff";
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(px, py, 2.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        } else {
          ctx.save();
          ctx.setLineDash([5, 9]);
          ctx.strokeStyle = "rgba(125,211,252,0.22)";
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.restore();
        }
      });

      // completion shockwave — twin rings burst from the centre when the star closes
      if (doneAt) {
        const el = (t - doneAt) / 900; // 0..1 over 900ms
        if (el < 1) {
          const cx = CX * W, cy = CY * H, maxR = Math.min(W, H) * 0.6;
          ctx.save();
          ctx.lineWidth = 3 * (1 - el) + 0.6;
          ctx.strokeStyle = `rgba(125,211,252,${(0.55 * (1 - el)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(cx, cy, el * maxR, 0, Math.PI * 2);
          ctx.stroke();
          const el2 = el - 0.16;
          if (el2 > 0) {
            ctx.strokeStyle = `rgba(168,132,247,${(0.45 * (1 - el)).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(cx, cy, el2 * maxR, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // "start here" pulse on the first star until the visitor begins tracing
      if (litCount === 0) {
        const pr = 17 + 6 * Math.sin(performance.now() / 240);
        ctx.strokeStyle = hexA(STARS[0].color, 0.65);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx(0), sy(0), pr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // comet trail
      for (let k = trail.length - 1; k > 0; k--) {
        const p0 = trail[k];
        const p1 = trail[k - 1];
        p0.a *= 0.92;
        ctx.strokeStyle = `rgba(190,230,255,${(p0.a * 0.7).toFixed(3)})`;
        ctx.lineWidth = p0.a * 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      while (trail.length && trail[0].a < 0.04) trail.shift();

      // stars — the four clickable track stars twinkle hard to invite a click
      const now = performance.now() / 1000;
      for (let i = 0; i < TOTAL; i++) {
        const s = STARS[i];
        const st = state[i];
        st.t += ((st.on ? 1 : 0) - st.t) * 0.16;
        const x = sx(i);
        const y = sy(i);
        const isTrack = !!s.track;
        // twinkle factor: bold pulse for doorways, gentle shimmer for the rest
        const tw = st.on
          ? (isTrack ? 0.5 + 0.5 * Math.sin(now * 3.4 + i) : 0.85 + 0.15 * Math.sin(now * 1.5 + i))
          : 1;
        const base = (1.6 + st.t * 2.4) * (isTrack ? 0.9 + 0.45 * tw : 1);
        const glowR = (22 + st.t * 16) * (isTrack ? 0.8 + 0.7 * tw : 1);
        // glow halo
        if (st.t > 0.02) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
          g.addColorStop(0, hexA(s.color, 0.5 * st.t * (isTrack ? 0.6 + 0.7 * tw : 1)));
          g.addColorStop(1, hexA(s.color, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
        // sparkle glint (a twinkling cross) on the clickable doorway stars
        if (isTrack && st.on) {
          const r = 7 + 7 * tw;
          ctx.strokeStyle = hexA(s.color, 0.3 + 0.5 * tw);
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
          ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
          ctx.stroke();
        }
        ctx.fillStyle = st.on ? s.color : "rgba(150,170,200,0.35)";
        ctx.beginPath();
        ctx.arc(x, y, base, 0, Math.PI * 2);
        ctx.fill();
      }

      // ghost cursor
      if (ghost) {
        ctx.fillStyle = "rgba(190,230,255,0.9)";
        ctx.beginPath();
        ctx.arc(ghost.x, ghost.y, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    section.addEventListener("pointermove", ptr, { passive: true });
    section.addEventListener("pointerdown", ptr, { passive: true });

    if (reduced) {
      // finished sky, instantly
      state.forEach((s) => { s.on = true; s.t = 1; });
      litCount = TOTAL;
      setLit(TOTAL);
      finished = true;
      setDone(true);
      // one static paint
      draw();
      cancelAnimationFrame(raf);
    } else {
      draw();
      idleTimer = window.setTimeout(startGhost, 6000);
    }

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(ghostRaf);
      window.clearTimeout(idleTimer);
      window.removeEventListener("resize", resize);
      section.removeEventListener("pointermove", ptr);
      section.removeEventListener("pointerdown", ptr);
    };
  }, []);

  return (
    <section className={"draw-sky" + (done ? " is-done" : "")} ref={sectionRef} id="home">
      <canvas ref={canvasRef} className="draw-sky-canvas" aria-hidden />

      {/* prompt — shown until the star is complete */}
      {!done && (
        <div className="draw-sky-prompt" aria-hidden>
          <span className="draw-sky-kicker">✨ {lit > 0 ? `${lit} / ${TOTAL} stars joined` : "Draw the star"}</span>
          <span className="draw-sky-sub">{lit > 0 ? "keep going…" : "trace from star to star"}</span>
        </div>
      )}

      {/* the four labs — labelled from the start so you know which is which while
          connecting; they become clickable doorways once the star is complete */}
      {STARS.filter((s) => s.track).map((s) => {
        const subj = SUBJECT_MAP[s.track as SubjectId];
        const href = `/subjects/${s.track}`;
        return (
          <Link
            key={s.track}
            href={href}
            onClick={(e) => {
              e.preventDefault();
              if (done && transition) transition.go(s.track as SubjectId, href);
              else if (done) window.location.href = href;
            }}
            className={"draw-sky-door " + (s.top ? "is-top" : "is-bottom")}
            style={{ left: `${s.fx * 100}%`, top: `${s.fy * 100}%`, color: subj.accent }}
          >
            <span>{s.label}</span>
          </Link>
        );
      })}

      {/* "start here" badge on the top star until tracing begins */}
      {!done && lit === 0 && (
        <div
          className="draw-sky-start"
          aria-hidden
          style={{
            left: `${STARS[0].fx * 100}%`,
            top: `${STARS[0].fy * 100}%`,
            color: STARS[0].color,
          }}
        >
          ✦ Start here
        </div>
      )}

      {/* mission-control panel pops out of the star centre once it's complete */}
      <div className="draw-sky-reveal">
        <span className="draw-sky-corner tl" aria-hidden />
        <span className="draw-sky-corner tr" aria-hidden />
        <span className="draw-sky-corner bl" aria-hidden />
        <span className="draw-sky-corner br" aria-hidden />
        <p className="draw-sky-status"><span className="draw-sky-live" aria-hidden /> CURIOUS LABS · STEM MAKER STUDIO</p>
        <h1 className="draw-sky-headline">
          Kids don&rsquo;t watch science.<br />
          <span>They build it.</span>
        </h1>
        <div className="draw-sky-stats">
          <div className="draw-sky-stat"><b>{stats.labs}</b><i>HANDS-ON LABS</i></div>
          <div className="draw-sky-stat"><b>{stats.studios}</b><i>STUDIOS</i></div>
          <div className="draw-sky-stat"><b>{stats.grades === GRADES_TOTAL ? "1–10" : stats.grades}</b><i>GRADES</i></div>
        </div>
        <p className="draw-sky-hint">
          <span className="draw-sky-hint-point">👆</span> Click a glowing star to explore that studio
        </p>
        <Link href="/tracks" className="draw-sky-browse">or browse all {LABS_TOTAL} labs →</Link>
      </div>
    </section>
  );
}

/** hex (#rrggbb) → rgba string with alpha. */
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
