"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SUBJECTS } from "@/lib/subjects";
import { ACTIVITIES, activitiesBySubject } from "@/lib/activities/registry";
import { useSubjectTransition } from "@/components/SubjectTransition";
import type { SubjectId } from "@/lib/activities/types";

/**
 * "Reactor Core" hero — a pulsing energy core with the 4 studios orbiting it
 * like electrons. The value proposition and live stats sit IN the core, so the
 * pitch lands instantly (no interaction gate); the orbit is ambient motion you
 * can tap into. Canvas draws the core / orbit / particles; the 4 studios are
 * real DOM links whose positions are driven by the same loop. Pauses on hover
 * so a moving studio is always easy to click. Cosmic theme kept.
 */

const LABS_TOTAL = ACTIVITIES.length;
const STUDIOS_TOTAL = SUBJECTS.length;
const GRADES_TOTAL = 10;

const SHORT: Record<string, string> = { "Artificial Intelligence": "AI", "3D Modelling": "3D" };
const STUDIOS = SUBJECTS.map((s) => ({
  id: s.id,
  name: SHORT[s.name] ?? s.name,
  emoji: s.emoji,
  accent: s.accent,
  count: activitiesBySubject(s.id).length,
}));

export function ReactorCore() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const pausedRef = useRef(false);
  const [stats, setStats] = useState({ labs: 0, studios: 0, grades: 0 });
  const transition = useSubjectTransition();

  // count the headline numbers up on mount — value is instant, no gate
  useEffect(() => {
    const targets = { labs: LABS_TOTAL, studios: STUDIOS_TOTAL, grades: GRADES_TOTAL };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStats(targets);
      return;
    }
    const dur = 1200;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setStats({
        labs: Math.round(targets.labs * e),
        studios: Math.round(targets.studios * e),
        grades: Math.round(targets.grades * e),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // reactor render loop — core, orbit, particles + drives the studio nodes
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const N = STUDIOS.length;
    let W = 0, H = 0, cx = 0, cy = 0, rx = 0, ry = 0;
    let mobile = false; // below this width the studios stack instead of orbit

    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W * 0.5;
      cy = H * 0.46;
      // size the orbit to the viewport, then fit the centre panel INSIDE it so
      // the studios never crowd the text — at any width or height.
      rx = Math.max(150, Math.min(W * 0.5 - 76, 450));
      ry = Math.max(118, Math.min(H * 0.42 - 54, 248));
      const panelW = Math.max(240, Math.min(2 * (rx - 78), 560));
      if (panelRef.current) panelRef.current.style.maxWidth = `${Math.round(panelW)}px`;
      mobile = W < 600;
      sectionRef.current?.classList.toggle("is-stacked", mobile);
      if (mobile) {
        // hand layout back to CSS (stacked); clear any orbit-driven inline styles
        for (const node of nodeRefs.current) {
          if (!node) continue;
          node.style.left = node.style.top = node.style.transform = node.style.opacity = node.style.zIndex = "";
        }
      }
    };
    resize();
    // observe the canvas (recompute AFTER layout settles) AND the window
    // (belt-and-suspenders — some embedded viewports don't fire RO on resize)
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 30 }, (_, i) => ({ a: (i / 30) * Math.PI * 2, s: 0.18 + (i % 6) * 0.035 }));
    let base = -Math.PI / 2; // Coding starts at the top
    let last = performance.now();
    let introStart = 0; // set on the first frame → drives the power-up intro
    let raf = 0;

    const easeOutBack = (p: number) => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };

    // place studio i; during the intro it launches out of the core into orbit
    const place = (i: number, angle: number, introP: number) => {
      const node = nodeRefs.current[i];
      const ox = cx + rx * Math.cos(angle);
      const oy = cy + ry * Math.sin(angle);
      const depth = (Math.sin(angle) + 1) / 2; // 0 = far side, 1 = near side
      const sp = introP >= 1 ? 1 : Math.max(0, Math.min(1, (introP - i * 0.08) / 0.6)); // staggered
      const e = introP >= 1 ? 1 : easeOutBack(sp);
      const x = cx + (ox - cx) * e;
      const y = cy + (oy - cy) * e;
      if (node) {
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.transform = `translate(-50%, -50%) scale(${((0.78 + depth * 0.34) * sp).toFixed(3)})`;
        node.style.opacity = ((0.5 + depth * 0.5) * sp).toFixed(2);
        node.style.zIndex = depth > 0.5 ? "6" : "1";
      }
      return { x, y, depth, sp };
    };

    const draw = () => {
      const now = performance.now();
      const dt = Math.min(50, now - last) / 1000;
      last = now;
      if (!introStart) introStart = now;
      const introP = reduced ? 1 : Math.min(1, (now - introStart) / 1500);
      const boot = 1 - Math.pow(1 - introP, 3); // ease-out power-up build
      const flick = introP < 0.45 ? 0.35 + 0.65 * Math.abs(Math.sin(now * 0.045)) : 1;
      const cb = boot * flick; // core brightness while it flickers on
      if (!pausedRef.current && introP >= 1) base += dt * 0.17; // orbit begins after launch
      const tt = now / 1000;
      const pulse = 0.5 + 0.5 * Math.sin(tt * 1.6);
      ctx.clearRect(0, 0, W, H);

      // orbit visuals only when the studios actually orbit (desktop/tablet)
      if (!mobile) {
        // energy beams: core → each studio (the core "powers" the studios)
        for (let i = 0; i < N; i++) {
          const ang = base + (i * Math.PI * 2) / N;
          const x = cx + rx * Math.cos(ang), y = cy + ry * Math.sin(ang);
          const depth = (Math.sin(ang) + 1) / 2;
          ctx.strokeStyle = hexA(STUDIOS[i].accent, (0.05 + depth * 0.13) * boot);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(x, y);
          ctx.stroke();
        }

        // orbit ellipse
        ctx.strokeStyle = `rgba(125,170,235,${(0.16 * boot).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        // energy particles travelling the orbit
        for (const p of particles) {
          if (!pausedRef.current) p.a += dt * p.s;
          const x = cx + rx * Math.cos(p.a), y = cy + ry * Math.sin(p.a);
          const depth = (Math.sin(p.a) + 1) / 2;
          ctx.fillStyle = `rgba(140,215,255,${((0.08 + depth * 0.4) * boot).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.1 + depth * 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // reactor core glow
      const coreR = 92 + pulse * 18;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      g.addColorStop(0, `rgba(120,225,255,${((0.17 + pulse * 0.08) * cb).toFixed(3)})`);
      g.addColorStop(0.4, `rgba(120,140,255,${((0.08 + pulse * 0.04) * cb).toFixed(3)})`);
      g.addColorStop(1, "rgba(120,140,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // core containment rings + rotating tick ring (techy)
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `rgba(165,232,255,${((0.22 - k * 0.06) * cb).toFixed(3)})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(cx, cy, 18 + k * 10 + pulse * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      const tickN = 14, tickR = 50 + pulse * 4;
      for (let k = 0; k < tickN; k++) {
        const a = tt * 0.4 + (k * Math.PI * 2) / tickN;
        ctx.strokeStyle = `rgba(140,210,255,${(0.30 * cb).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * tickR, cy + Math.sin(a) * tickR);
        ctx.lineTo(cx + Math.cos(a) * (tickR + 5), cy + Math.sin(a) * (tickR + 5));
        ctx.stroke();
      }
      // bright nucleus
      ctx.fillStyle = `rgba(225,247,255,${(0.92 * cb).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 3 + pulse * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // power-on shockwave expanding from the core while it boots
      if (introP < 1) {
        ctx.strokeStyle = `rgba(150,225,255,${(0.45 * (1 - boot)).toFixed(3)})`;
        ctx.lineWidth = 2.5 * (1 - boot) + 0.4;
        ctx.beginPath();
        ctx.arc(cx, cy, boot * Math.min(W, H) * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      }

      // place orbiting studios + draw their electron glow (desktop/tablet only)
      if (!mobile) {
        for (let i = 0; i < N; i++) {
          const pos = place(i, base + (i * Math.PI * 2) / N, introP);
          const gr = Math.max(1, (28 + pos.depth * 16) * pos.sp);
          const gg = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, gr);
          gg.addColorStop(0, hexA(STUDIOS[i].accent, (0.28 + pos.depth * 0.26) * pos.sp));
          gg.addColorStop(1, hexA(STUDIOS[i].accent, 0));
          ctx.fillStyle = gg;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, gr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  // cursor parallax — tilt the centre panel in 3D so the welcome "hangs" in space
  useEffect(() => {
    const el = tiltRef.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      el.style.transform = `rotateX(${(-ny * 9).toFixed(2)}deg) rotateY(${(nx * 13).toFixed(2)}deg)`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const pause = (v: boolean) => () => { pausedRef.current = v; };

  return (
    <section className="reactor" id="home" ref={sectionRef}>
      <canvas ref={canvasRef} className="reactor-canvas" aria-hidden />

      {/* central panel — value proposition + live stats, visible instantly */}
      <div className="reactor-panel" ref={panelRef}>
        <div className="reactor-3d" ref={tiltRef}>
          <span className="draw-sky-corner tl" aria-hidden />
          <span className="draw-sky-corner tr" aria-hidden />
          <span className="draw-sky-corner bl" aria-hidden />
          <span className="draw-sky-corner br" aria-hidden />
          <div className="reactor-float">
            <p className="draw-sky-status"><span className="draw-sky-live" aria-hidden /> REACTOR ONLINE · WELCOME ABOARD</p>
            <h1 className="draw-sky-headline">
              Welcome aboard,<br />
              <span>Cadet!</span> 🚀
            </h1>
            <div className="draw-sky-stats">
              <div className="draw-sky-stat"><b>{stats.labs}</b><i>LABS TO EXPLORE</i></div>
              <div className="draw-sky-stat"><b>{stats.studios}</b><i>STUDIOS</i></div>
              <div className="draw-sky-stat"><b>{stats.grades === GRADES_TOTAL ? "1–10" : stats.grades}</b><i>GRADES</i></div>
            </div>
            <p className="draw-sky-hint"><span className="draw-sky-hint-point">⚛</span> Pick a studio and start your first mission</p>
          </div>
        </div>
      </div>

      {/* the 4 studios orbiting the core */}
      {STUDIOS.map((s, i) => {
        const href = `/subjects/${s.id}`;
        return (
          <Link
            key={s.id}
            href={href}
            ref={(el) => { nodeRefs.current[i] = el; }}
            className="reactor-studio"
            style={{ color: s.accent }}
            aria-label={`${s.name} — ${s.count} labs`}
            onMouseEnter={pause(true)}
            onMouseLeave={pause(false)}
            onFocus={pause(true)}
            onBlur={pause(false)}
            onClick={(e) => {
              e.preventDefault();
              if (transition) transition.go(s.id as SubjectId, href);
              else window.location.href = href;
            }}
          >
            <span className="reactor-orb" aria-hidden>{s.emoji}</span>
            <span className="reactor-studio-name">{s.name}</span>
            <span className="reactor-studio-count">{s.count} labs</span>
          </Link>
        );
      })}

      <Link href="/tracks" className="draw-sky-browse reactor-browse">or browse all {LABS_TOTAL} labs →</Link>
    </section>
  );
}

/** hex (#rrggbb) → rgba string with alpha. */
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
