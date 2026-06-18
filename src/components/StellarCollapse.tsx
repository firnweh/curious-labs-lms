"use client";

import { useEffect, useRef } from "react";

/**
 * "Witness a Stellar Collapse" — a live black-hole simulation (accretion disk,
 * photon ring, gravitational lensing, spaghettified infalling stars). Ported
 * from the Curious Labs landing. While on screen it calls window.__setBHPull
 * so the page's starfield (CosmosFX) gets sucked toward the singularity.
 */
export function StellarCollapse() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sec = sectionRef.current;
    const cv = canvasRef.current;
    const statusEl = statusRef.current;
    if (!sec || !cv || !statusEl) return;

    const setBHPull = (window as unknown as { __setBHPull?: (p: unknown) => void }).__setBHPull || (() => {});
    const DPR = Math.min(devicePixelRatio || 1, 2);
    const mobile = innerWidth < 768;
    const bx = cv.getContext("2d")!;
    let BW = 0,
      BH_ = 0,
      RH = 0,
      CX = 0,
      CY = 0;

    const bsize = () => {
      const stage = sec.querySelector(".bh-stage") as HTMLElement | null;
      const w = Math.max(220, (stage ? stage.clientWidth : Math.min(1080, sec.clientWidth)) - 2);
      if (cv.width === Math.round(w * DPR)) return;
      BW = cv.width = Math.round(w * DPR);
      BH_ = cv.height = Math.round(w * 0.56 * DPR);
      cv.style.height = Math.round(w * 0.56) + "px";
      CX = BW / 2;
      CY = BH_ * 0.52;
      RH = Math.min(BW, BH_) * 0.085;
    };
    bsize();

    let cvRect: DOMRect | null = null;
    const onScroll = () => (cvRect = null);
    const onResize = () => {
      cvRect = null;
      bsize();
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);

    type P = { r: number; th: number; w: number; drift: number; sz: number };
    const NP = mobile ? 230 : 560;
    const disk: P[] = [];
    const mkP = (any: boolean): P => {
      const rIn = RH * 1.5,
        rOut = Math.min(BW, BH_) * 0.49;
      const r = any ? rIn + Math.pow(Math.random(), 0.7) * (rOut - rIn) : rOut * (0.92 + Math.random() * 0.08);
      return { r, th: Math.random() * 6.283, w: 0, drift: (0.04 + Math.random() * 0.08) * DPR * 0.18, sz: (0.9 + Math.random() * 1.9) * DPR };
    };
    const resetDisk = () => {
      disk.length = 0;
      for (let i = 0; i < NP; i++) disk.push(mkP(true));
    };

    let phase: "idle" | "collapsing" | "flash" | "disk" = "idle";
    let pt0 = 0,
      played = false,
      visible = false;
    let starFall: { x: number; y: number; t: number } | null = null;
    let nextFall = 0;

    const startCollapse = () => {
      phase = "collapsing";
      pt0 = performance.now();
      statusEl.textContent = "CORE COLLAPSE";
      resetDisk();
    };
    replayRef.current?.addEventListener("click", startCollapse);

    const visObs = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          visible = e.isIntersecting;
          if (visible && !played) {
            played = true;
            window.setTimeout(() => {
              if (visible) startCollapse();
              else played = false;
            }, 650);
          }
          if (!visible) setBHPull(null);
        });
      },
      { threshold: 0.35 },
    );
    visObs.observe(sec);

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeIn = (x: number) => x * x * x;
    const diskColor = (r: number) => {
      const rOut = Math.min(BW, BH_) * 0.49,
        t = (r - RH * 1.5) / (rOut - RH * 1.5);
      if (t < 0.18) return "rgba(255,247,224,";
      if (t < 0.45) return "rgba(255,195,107,";
      if (t < 0.75) return "rgba(255,122,60,";
      return "rgba(176,68,58,";
    };
    const drawStar = (scale: number, now: number) => {
      const R = RH * 2.2 * scale + 0.001,
        p = 1 + Math.sin(now * 0.004) * 0.04;
      const g = bx.createRadialGradient(CX, CY, 0, CX, CY, R * 2.4 * p);
      g.addColorStop(0, "rgba(255,252,240,1)");
      g.addColorStop(0.25, "rgba(255,214,140,0.9)");
      g.addColorStop(0.6, "rgba(255,140,80,0.25)");
      g.addColorStop(1, "rgba(255,120,60,0)");
      bx.fillStyle = g;
      bx.beginPath();
      bx.arc(CX, CY, R * 2.4 * p, 0, 7);
      bx.fill();
    };
    const drawHole = (a: number) => {
      const rim = bx.createRadialGradient(CX, CY, RH * 0.6, CX, CY, RH * 1.06);
      rim.addColorStop(0, "rgba(0,0,0,1)");
      rim.addColorStop(0.93, "rgba(0,0,0,1)");
      rim.addColorStop(1, "rgba(80,140,200," + 0.25 * a + ")");
      bx.fillStyle = rim;
      bx.beginPath();
      bx.arc(CX, CY, RH * 1.06, 0, 7);
      bx.fill();
    };
    const drawPhotonRing = (now: number) => {
      const p = 1 + Math.sin(now * 0.006) * 0.12;
      bx.strokeStyle = "rgba(210,236,255," + (0.85 * p * 0.5 + 0.35) + ")";
      bx.lineWidth = 1.4 * DPR;
      bx.beginPath();
      bx.arc(CX, CY, RH * 1.16, 0, 7);
      bx.stroke();
      bx.strokeStyle = "rgba(56,189,248,0.18)";
      bx.lineWidth = 5 * DPR;
      bx.beginPath();
      bx.arc(CX, CY, RH * 1.16, 0, 7);
      bx.stroke();
    };
    const stepDisk = () => {
      for (let i = 0; i < disk.length; i++) {
        const p = disk[i];
        p.w = Math.pow((RH * 2.6) / p.r, 1.5) * 0.05;
        p.th += p.w;
        p.r -= p.drift;
        if (p.r < RH * 1.18) disk[i] = mkP(false);
      }
    };
    const drawDisk = (back: boolean, grow: number) => {
      for (let i = 0; i < disk.length; i++) {
        const p = disk[i];
        const sinT = Math.sin(p.th);
        if (back ? sinT > 0 : sinT <= 0) continue;
        const x = CX + Math.cos(p.th) * p.r,
          y = CY + sinT * p.r * 0.34;
        const a = (back ? 0.5 : 0.95) * grow * Math.min(1, (RH * 3.4) / p.r);
        bx.fillStyle = diskColor(p.r) + a + ")";
        bx.beginPath();
        bx.arc(x, y, p.sz * (back ? 0.8 : 1), 0, 7);
        bx.fill();
      }
    };
    const drawLensArc = (grow: number) => {
      bx.save();
      bx.translate(CX, CY);
      bx.scale(1, 0.46);
      for (let r = RH * 1.35; r < RH * 2.6; r += 3 * DPR) {
        bx.globalAlpha = grow * Math.max(0, 1 - (r - RH * 1.35) / (RH * 1.3)) * 0.5;
        bx.strokeStyle = "rgba(255,170,90,0.5)";
        bx.beginPath();
        bx.arc(0, 0, r / 0.46, Math.PI * 1.06, Math.PI * 1.94);
        bx.lineWidth = 2 * DPR;
        bx.stroke();
      }
      bx.restore();
      bx.globalAlpha = 1;
    };

    let raf = 0;
    let stopped = false;
    const bhLoop = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(bhLoop);
      if (!visible) return;
      bx.clearRect(0, 0, BW, BH_);
      const t = (now - pt0) / 1000;

      if (phase === "disk") {
        if (!cvRect) cvRect = cv.getBoundingClientRect();
        setBHPull({ x: (cvRect.left + cvRect.width / 2) * DPR, y: (cvRect.top + cvRect.height * 0.52) * DPR, r: RH, g: 0.5 * DPR });
      } else setBHPull(null);

      if (phase === "idle") {
        drawStar(1, now);
        return;
      }
      if (phase === "collapsing") {
        const k = Math.min(1, t / 0.9);
        drawStar(1 - easeOut(k) * 0.99, now);
        if (k >= 1) {
          phase = "flash";
          pt0 = now;
          statusEl.textContent = "SINGULARITY FORMED";
        }
        return;
      }
      if (phase === "flash") {
        const f = Math.min(1, t / 0.5);
        const fr = easeOut(f) * Math.max(BW, BH_) * 0.7;
        bx.fillStyle = "rgba(235,242,255," + 0.85 * (1 - f) + ")";
        bx.fillRect(0, 0, BW, BH_);
        bx.strokeStyle = "rgba(160,215,255," + (1 - f) + ")";
        bx.lineWidth = 3 * DPR * (1 - f) + 1;
        bx.beginPath();
        bx.arc(CX, CY, fr, 0, 7);
        bx.stroke();
        drawHole(f);
        if (f >= 1) {
          phase = "disk";
          pt0 = now;
          statusEl.textContent = "ACCRETING";
        }
        return;
      }

      const grow = Math.min(1, t / 1.4);
      stepDisk();
      drawDisk(true, grow);
      drawLensArc(grow);
      drawHole(1);
      drawDisk(false, grow);
      drawPhotonRing(now);
      if (!starFall && now > nextFall) {
        starFall = { x: BW * (Math.random() < 0.5 ? 0.06 : 0.94), y: BH_ * 0.12, t: 0 };
      }
      if (starFall) {
        starFall.t += 0.008;
        const st = easeIn(starFall.t);
        const sx = starFall.x + (CX - starFall.x) * st,
          sy = starFall.y + (CY - starFall.y) * st;
        const stretch = st * 46 * DPR,
          ang = Math.atan2(CY - sy, CX - sx);
        bx.strokeStyle = "rgba(220,236,255," + 0.9 * (1 - st * 0.6) + ")";
        bx.lineWidth = (2.4 - st * 1.8) * DPR;
        bx.beginPath();
        bx.moveTo(sx, sy);
        bx.lineTo(sx + Math.cos(ang) * stretch, sy + Math.sin(ang) * stretch);
        bx.stroke();
        if (st > 0.98) {
          starFall = null;
          nextFall = now + 5200 + Math.random() * 5200;
        }
      }
    };
    if (!reduced) raf = requestAnimationFrame(bhLoop);
    else drawStar(1, performance.now());

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      visObs.disconnect();
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      replayRef.current?.removeEventListener("click", startCollapse);
      setBHPull(null);
    };
  }, []);

  return (
    <section ref={sectionRef} className="singularity" id="singularity">
      <div className="section-label reveal">Gravity Lab</div>
      <h2 className="section-title reveal">Witness a Stellar Collapse</h2>
      <p className="section-sub reveal" style={{ maxWidth: 640, margin: "14px auto 0" }}>
        A dying star collapses into a black hole — accretion disk, photon ring and gravitational
        lensing, simulated live in your browser. Physics is the coolest subject in the universe.
      </p>
      <div className="bh-stage reveal">
        <canvas ref={canvasRef} id="bhCanvas" />
        <div className="bh-hud">
          OBJECT: <b>CL-X1</b>
          <br />
          CLASS: STELLAR BH
          <br />
          STATUS: <span ref={statusRef} id="bhStatus">PRE-COLLAPSE</span>
        </div>
        <button ref={replayRef} className="bh-replay" id="bhReplay">
          ↻ REPLAY COLLAPSE
        </button>
      </div>
      <p className="bh-caption">Tip — the stars of this page get pulled in while the singularity is on screen.</p>
    </section>
  );
}
