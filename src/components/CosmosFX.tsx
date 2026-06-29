"use client";

import { useEffect } from "react";

/**
 * The cosmos visual system — ported from the Curious Labs marketing landing.
 * A fixed full-screen starfield canvas (3-layer parallax stars, twinkle,
 * warp intro, shooting stars, comets, click bursts, cursor trail), drifting
 * nebulae, a scroll-progress bar, a mission HUD, and a reticle cursor.
 *
 * Everything is built imperatively and torn down on unmount so it stays
 * single-instance across client navigation / HMR. Honours reduced-motion.
 * Exposes window.__setBHPull so the StellarCollapse section can suck stars in.
 */
export function CosmosFX() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = innerWidth < 768;
    const fine = matchMedia("(pointer:fine)").matches;

    // things to remove / stop on cleanup
    const nodes: HTMLElement[] = [];
    const offs: Array<() => void> = [];
    let stopped = false;
    const on = (
      target: Window | Document | HTMLElement,
      ev: string,
      fn: EventListenerOrEventListenerObject,
      opts?: AddEventListenerOptions,
    ) => {
      target.addEventListener(ev, fn, opts);
      offs.push(() => target.removeEventListener(ev, fn, opts));
    };

    /* ── scroll progress ── */
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    document.body.appendChild(bar);
    nodes.push(bar);
    on(
      window,
      "scroll",
      () => {
        const h = document.documentElement;
        bar.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100 + "%";
      },
      { passive: true },
    );

    /* ── nebulae ── */
    ["nebula-1", "nebula-2", "nebula-3"].forEach((cls) => {
      const n = document.createElement("div");
      n.className = "nebula " + cls;
      document.body.prepend(n);
      nodes.push(n);
    });

    /* ── stagger reveals ── */
    const revIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            window.setTimeout(() => el.classList.add("visible"), i * 70);
            revIO.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll(".reveal").forEach((r) => revIO.observe(r));
    offs.push(() => revIO.disconnect());

    /* ── tilt + magnetic ── */
    document.querySelectorAll<HTMLElement>(".tilt").forEach((card) => {
      const move = (ev: Event) => {
        const e = ev as MouseEvent;
        const r = card.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -8;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 10;
        card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
      };
      const leave = () => (card.style.transform = "");
      on(card, "mousemove", move);
      on(card, "mouseleave", leave);
    });

    if (reduced) {
      return () => {
        nodes.forEach((n) => n.remove());
        offs.forEach((f) => f());
      };
    }

    /* ════════ COSMOS CANVAS ════════ */
    const C = document.createElement("canvas");
    C.id = "cosmosCanvas";
    document.body.prepend(C);
    nodes.push(C);
    const ctx = C.getContext("2d")!;
    const DPR = Math.min(devicePixelRatio || 1, 2);
    let W = 0,
      H = 0;
    const size = () => {
      const w = Math.round(innerWidth * DPR),
        h = Math.round(innerHeight * DPR);
      if (w === W && h === H) return;
      W = C.width = w;
      H = C.height = h;
      C.style.width = innerWidth + "px";
      C.style.height = innerHeight + "px";
    };
    size();
    on(window, "resize", size);

    const LAYERS = [
      { n: mobile ? 40 : 90, sp: 0.35, r: [0.4, 1.0], par: 0.1 },
      { n: mobile ? 26 : 60, sp: 0.18, r: [0.8, 1.6], par: 0.22 },
      { n: mobile ? 14 : 34, sp: 0.08, r: [1.2, 2.4], par: 0.4 },
    ];
    type Star = { x: number; y: number; li: number; r: number; tw: number; tws: number; hue: number; dxr: number; dyr: number; vx: number; vy: number };
    const stars: Star[] = [];
    LAYERS.forEach((L, li) => {
      for (let i = 0; i < L.n; i++)
        stars.push({
          x: Math.random(),
          y: Math.random(),
          li,
          r: (L.r[0] + Math.random() * (L.r[1] - L.r[0])) * DPR,
          tw: Math.random() * 6.28,
          tws: 0.5 + Math.random() * 1.5,
          hue: Math.random() < 0.82 ? 0 : Math.random() < 0.5 ? 199 : 265,
          dxr: Math.random() - 0.5,
          dyr: 0.3 + Math.random() * 0.7,
          vx: 0,
          vy: 0,
        });
    });

    let shoots: Array<{ x: number; y: number; vx: number; vy: number; life: number; decay: number }> = [];
    let nextShoot = performance.now() + 2400;
    const spawnShoot = () => {
      const fromTop = Math.random() < 0.7;
      shoots.push({
        x: Math.random() * W,
        y: fromTop ? -20 * DPR : Math.random() * H * 0.3,
        vx: (4 + Math.random() * 5) * DPR * (Math.random() < 0.5 ? 1 : -1),
        vy: (3.4 + Math.random() * 4) * DPR,
        life: 1,
        decay: 0.012 + Math.random() * 0.008,
      });
    };

    let trail: Array<{ x: number; y: number; life: number }> = [];
    let mx = -1,
      my = -1;
    if (fine)
      on(
        window,
        "mousemove",
        (ev) => {
          const e = ev as MouseEvent;
          mx = e.clientX * DPR;
          my = e.clientY * DPR;
          trail.push({ x: mx, y: my, life: 1 });
          if (trail.length > 28) trail.shift();
        },
        { passive: true },
      );

    let bursts: Array<{ x: number; y: number; ring: number; life: number; parts: Array<{ x: number; y: number; vx: number; vy: number; hue: number }> }> = [];
    let comets: Array<{ t: number; dur: number; trail: Array<{ x: number; y: number }>; x0: number; y0: number; x1: number; y1: number; cxp: number; cyp: number }> = [];
    let nextComet = performance.now() + 5000;
    let nextShower = performance.now() + 13000;
    let prevSY = scrollY,
      sVel = 0,
      sDir = 1,
      hyperUntil = 0,
      lastNow = 0;
    const stats = { fps: 60, warp: 1 };
    (window as unknown as { __cosmosStats: typeof stats }).__cosmosStats = stats;

    on(window, "click", (ev) => {
      const e = ev as MouseEvent;
      const px = e.clientX * DPR,
        py = e.clientY * DPR,
        parts = [];
      for (let i = 0; i < 26; i++) {
        const an = Math.random() * 6.283,
          sp = (1.5 + Math.random() * 4) * DPR;
        parts.push({ x: px, y: py, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, hue: Math.random() < 0.6 ? 199 : Math.random() < 0.5 ? 265 : 330 });
      }
      bursts.push({ x: px, y: py, ring: 0, life: 1, parts });
    });

    const spawnComet = () => {
      const fromLeft = Math.random() < 0.5;
      comets.push({
        t: 0,
        dur: 3.8 + Math.random() * 1.6,
        trail: [],
        x0: fromLeft ? -0.08 : 1.08,
        y0: 0.06 + Math.random() * 0.25,
        x1: fromLeft ? 1.1 : -0.1,
        y1: 0.45 + Math.random() * 0.4,
        cxp: 0.3 + Math.random() * 0.4,
        cyp: -0.15 + Math.random() * 0.2,
      });
    };

    let bhPull: { x: number; y: number; r: number; g: number } | null = null;
    (window as unknown as { __setBHPull: (p: typeof bhPull) => void }).__setBHPull = (p) => {
      bhPull = p;
    };

    /* warp burst — fired by the carousel on every slide transition */
    const triggerWarp = (ms = 850) => {
      hyperUntil = performance.now() + ms;
      C.classList.add("hyperspace");
      window.setTimeout(() => C.classList.remove("hyperspace"), ms);
    };
    (window as unknown as { __clWarp?: (ms?: number) => void }).__clWarp = triggerWarp;
    offs.push(() => {
      delete (window as unknown as { __clWarp?: unknown }).__clWarp;
    });

    const warpT0 = performance.now(),
      WARP_MS = 1500;
    let warpDone = false;
    window.setTimeout(() => {
      warpDone = true;
    }, WARP_MS + 120);
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    let raf = 0;
    const cosmosLoop = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(cosmosLoop);
      const dtm = lastNow ? Math.min(now - lastNow, 80) : 16;
      lastNow = now;
      stats.fps = Math.round(stats.fps * 0.92 + (1000 / Math.max(dtm, 1)) * 0.08);
      const sy = scrollY,
        sd = sy - prevSY;
      prevSY = sy;
      if (sd) sDir = sd > 0 ? 1 : -1;
      sVel = sVel * 0.88 + Math.abs(sd) * 0.12;
      stats.warp = 1 + sVel / 60;
      const near: Array<{ x: number; y: number }> = [];
      ctx.clearRect(0, 0, W, H);
      const wp = Math.min(1, (now - warpT0) / WARP_MS),
        we = easeOut(wp);
      const cx = W / 2,
        cy = H / 2,
        scroll = scrollY * DPR;
      const pxn = fine && mx >= 0 ? mx / W - 0.5 : 0,
        pyn = fine && my >= 0 ? my / H - 0.5 : 0;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i],
          L = LAYERS[s.li];
        let bx = s.x * W,
          by = ((s.y * H - scroll * L.par) % H + H) % H;
        bx = ((bx - pxn * 40 * DPR * L.par * 3) % W + W) % W;
        by = ((by - pyn * 26 * DPR * L.par * 3) % H + H) % H;
        let x = bx,
          y = by,
          stretch = 0;
        if (wp < 1) {
          const dx = bx - cx,
            dy = by - cy,
            k = 1 + (1 - we) * 3.2;
          x = cx + dx * k;
          y = cy + dy * k;
          stretch = (1 - we) * 26 * DPR;
        }
        if (bhPull) {
          const ddx = bhPull.x - x,
            ddy = bhPull.y - y,
            d2 = ddx * ddx + ddy * ddy,
            rad = bhPull.r * 6;
          if (d2 < rad * rad) {
            const d = Math.sqrt(d2) || 1,
              f = (1 - d / rad) * bhPull.g;
            s.vx += (ddx / d) * f;
            s.vy += (ddy / d) * f;
            if (d < bhPull.r * 1.1) {
              s.x = Math.random();
              s.y = Math.random();
              s.vx = s.vy = 0;
              continue;
            }
          }
        }
        s.x += L.sp * 0.0006 * s.dxr + s.vx / W;
        s.y += L.sp * 0.0009 * s.dyr + s.vy / H;
        s.vx *= 0.96;
        s.vy *= 0.96;
        if (s.x > 1) s.x -= 1;
        if (s.x < 0) s.x += 1;
        if (s.y > 1) s.y -= 1;
        if (s.y < 0) s.y += 1;
        s.tw += 0.016 * s.tws;
        let a = 0.45 + 0.55 * Math.abs(Math.sin(s.tw));
        if (now < hyperUntil) {
          const hdx = x - cx,
            hdy = y - cy,
            hd = Math.sqrt(hdx * hdx + hdy * hdy) || 1,
            hl = (8 + hd * 0.12) * DPR;
          ctx.strokeStyle = "hsla(" + (199 + Math.sin(now * 0.01 + i) * 60) + ",95%,75%," + a * 0.9 + ")";
          ctx.lineWidth = s.r * 0.9;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (hdx / hd) * hl, y + (hdy / hd) * hl);
          ctx.stroke();
          continue;
        }
        if (fine && mx >= 0) {
          const lx = x - mx,
            ly = y - my,
            ld2 = lx * lx + ly * ly,
            LR = 150 * DPR;
          if (ld2 < LR * LR) {
            const ld = Math.sqrt(ld2) || 1,
              pw = 1 - ld / LR,
              push = pw * pw * 26 * DPR;
            x += (lx / ld) * push;
            y += (ly / ld) * push;
            a = Math.min(1, a + pw * 0.5);
            if (s.li > 0 && ld < 120 * DPR) near.push({ x, y });
          }
        }
        ctx.beginPath();
        if (stretch > 2) {
          const ang = Math.atan2(y - cy, x - cx);
          ctx.strokeStyle = "rgba(190,225,255," + a * 0.9 + ")";
          ctx.lineWidth = s.r * 0.8;
          ctx.moveTo(x, y);
          ctx.lineTo(x - Math.cos(ang) * stretch, y - Math.sin(ang) * stretch);
          ctx.stroke();
        } else if (sVel > 6) {
          const sl = Math.min(sVel * L.par * 1.1, 35) * DPR;
          ctx.strokeStyle = "rgba(200,228,255," + a * 0.85 + ")";
          ctx.lineWidth = s.r * 0.85;
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + sl * sDir);
          ctx.stroke();
        } else {
          ctx.fillStyle = s.hue === 0 ? "rgba(225,238,252," + a + ")" : "hsla(" + s.hue + ",90%,70%," + a + ")";
          ctx.arc(x, y, s.r, 0, 7);
          ctx.fill();
        }
      }

      if (warpDone) {
        if (now > nextShoot) {
          spawnShoot();
          nextShoot = now + 2600 + Math.random() * 4200;
        }
        for (let k = shoots.length - 1; k >= 0; k--) {
          const sh = shoots[k];
          sh.x += sh.vx;
          sh.y += sh.vy;
          sh.life -= sh.decay;
          if (sh.life <= 0 || sh.y > H + 40) {
            shoots.splice(k, 1);
            continue;
          }
          const g = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 9, sh.y - sh.vy * 9);
          g.addColorStop(0, "rgba(235,245,255," + sh.life * 0.95 + ")");
          g.addColorStop(1, "rgba(56,189,248,0)");
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.6 * DPR;
          ctx.beginPath();
          ctx.moveTo(sh.x, sh.y);
          ctx.lineTo(sh.x - sh.vx * 9, sh.y - sh.vy * 9);
          ctx.stroke();
        }
      }

      for (let b = bursts.length - 1; b >= 0; b--) {
        const bu = bursts[b];
        bu.life -= 0.02;
        bu.ring += 7 * DPR;
        if (bu.life <= 0) {
          bursts.splice(b, 1);
          continue;
        }
        ctx.strokeStyle = "rgba(140,200,255," + bu.life * 0.55 + ")";
        ctx.lineWidth = Math.max(2 * DPR * bu.life, 0.5);
        ctx.beginPath();
        ctx.arc(bu.x, bu.y, bu.ring, 0, 7);
        ctx.stroke();
        for (let q = 0; q < bu.parts.length; q++) {
          const pp = bu.parts[q];
          pp.x += pp.vx;
          pp.y += pp.vy;
          pp.vx *= 0.97;
          pp.vy *= 0.97;
          ctx.fillStyle = "hsla(" + pp.hue + ",95%,72%," + bu.life * 0.9 + ")";
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, Math.max(1.6 * DPR * bu.life, 0.4), 0, 7);
          ctx.fill();
        }
      }

      if (warpDone && now > nextComet) {
        spawnComet();
        nextComet = now + 9000 + Math.random() * 12000;
      }
      if (warpDone && now > nextShower) {
        for (let sw = 0; sw < 10; sw++) window.setTimeout(spawnShoot, sw * 150);
        nextShower = now + 22000 + Math.random() * 16000;
      }
      for (let ci = comets.length - 1; ci >= 0; ci--) {
        const co = comets[ci];
        co.t += dtm / 1000 / co.dur;
        if (co.t >= 1) {
          comets.splice(ci, 1);
          continue;
        }
        const u = co.t,
          iu = 1 - u,
          qx = (iu * iu * co.x0 + 2 * iu * u * co.cxp + u * u * co.x1) * W,
          qy = (iu * iu * co.y0 + 2 * iu * u * co.cyp + u * u * co.y1) * H;
        co.trail.push({ x: qx, y: qy });
        if (co.trail.length > 34) co.trail.shift();
        for (let ti = 0; ti < co.trail.length; ti++) {
          const tp2 = co.trail[ti],
            ta = ti / co.trail.length;
          ctx.fillStyle = "rgba(170,220,255," + ta * 0.4 + ")";
          ctx.beginPath();
          ctx.arc(tp2.x, tp2.y, (0.6 + ta * 2.6) * DPR, 0, 7);
          ctx.fill();
        }
        const cg = ctx.createRadialGradient(qx, qy, 0, qx, qy, 18 * DPR);
        cg.addColorStop(0, "rgba(240,250,255,1)");
        cg.addColorStop(0.3, "rgba(160,220,255,.7)");
        cg.addColorStop(1, "rgba(120,200,255,0)");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(qx, qy, 18 * DPR, 0, 7);
        ctx.fill();
      }

      for (let n1 = 0; n1 < near.length; n1++)
        for (let n2 = n1 + 1; n2 < near.length; n2++) {
          const nx = near[n1].x - near[n2].x,
            ny = near[n1].y - near[n2].y,
            nd2 = nx * nx + ny * ny,
            ND = 130 * DPR;
          if (nd2 < ND * ND) {
            const na = (1 - Math.sqrt(nd2) / ND) * 0.35;
            ctx.strokeStyle = "rgba(56,189,248," + na + ")";
            ctx.lineWidth = 0.8 * DPR;
            ctx.beginPath();
            ctx.moveTo(near[n1].x, near[n1].y);
            ctx.lineTo(near[n2].x, near[n2].y);
            ctx.stroke();
          }
        }

      for (let m = trail.length - 1; m >= 0; m--) {
        const tp = trail[m];
        tp.life -= 0.05;
        if (tp.life <= 0) {
          trail.splice(m, 1);
          continue;
        }
        ctx.beginPath();
        ctx.fillStyle = "rgba(56,189,248," + tp.life * 0.3 + ")";
        ctx.arc(tp.x, tp.y, (1 + tp.life * 4) * DPR, 0, 7);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(cosmosLoop);

    /* ════════ MISSION HUD ════════ */
    const hud = document.createElement("div");
    hud.className = "mission-hud";
    hud.innerHTML =
      '<span class="mh-dot"></span>MISSION ACTIVE<br>SECTOR: <span class="mh-sector" id="mhSector">LAUNCH PAD</span><br><span id="mhCoord">RA 05h 34m · DEC +22°</span><br><span id="mhTele">WARP 1.0 · 60 FPS</span>';
    document.body.appendChild(hud);
    nodes.push(hud);
    const secEl = hud.querySelector("#mhSector") as HTMLElement;
    // the carousel drives the active sector name through this setter
    (window as unknown as { __clSector?: (name: string) => void }).__clSector = (name) => {
      if (secEl && name) secEl.textContent = name;
    };
    offs.push(() => {
      delete (window as unknown as { __clSector?: unknown }).__clSector;
    });
    let ra = 5.57,
      dec = 22.0;
    const co = hud.querySelector("#mhCoord") as HTMLElement;
    const te = hud.querySelector("#mhTele") as HTMLElement;
    const hudTimer = window.setInterval(() => {
      ra += (Math.random() - 0.5) * 0.02;
      dec += (Math.random() - 0.5) * 0.05;
      co.textContent = "RA 0" + ra.toFixed(2).replace(".", "h ") + "m · DEC +" + dec.toFixed(1) + "°";
      te.textContent = "WARP " + stats.warp.toFixed(1) + " · " + stats.fps + " FPS";
    }, 700);
    offs.push(() => clearInterval(hudTimer));

    /* ════════ RETICLE CURSOR ════════ */
    if (fine) {
      const ret = document.createElement("div");
      ret.className = "cl-reticle";
      ret.innerHTML =
        '<div class="cl-ret-frame"><span class="cl-ret-corner tl"></span><span class="cl-ret-corner tr"></span><span class="cl-ret-corner bl"></span><span class="cl-ret-corner br"></span></div>' +
        '<div class="cl-ret-ring2"></div>' +
        '<div class="cl-ret-dot"></div>';
      document.body.appendChild(ret);
      nodes.push(ret);
      const prevCursor = document.body.style.cursor;
      document.body.style.cursor = "none";
      offs.push(() => {
        document.body.style.cursor = prevCursor;
      });
      let rx = innerWidth / 2,
        ry = innerHeight / 2,
        tx = rx,
        ty = ry;
      on(
        window,
        "mousemove",
        (ev) => {
          const e = ev as MouseEvent;
          tx = e.clientX;
          ty = e.clientY;
          const t = e.target as HTMLElement;
          const inter = t && t.closest && t.closest("a,button,input,textarea,select,.tilt");
          ret.classList.toggle("on-link", !!inter);
        },
        { passive: true },
      );
      on(window, "mousedown", () => ret.classList.add("clicking"));
      on(window, "mouseup", () => ret.classList.remove("clicking"));
      let retRaf = 0;
      const follow = () => {
        if (stopped) return;
        rx += (tx - rx) * 0.18;
        ry += (ty - ry) * 0.18;
        ret.style.transform = `translate(${rx}px,${ry}px)`;
        retRaf = requestAnimationFrame(follow);
      };
      retRaf = requestAnimationFrame(follow);
      offs.push(() => cancelAnimationFrame(retRaf));
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      offs.forEach((f) => f());
      nodes.forEach((n) => n.remove());
    };
  }, []);

  return null;
}
