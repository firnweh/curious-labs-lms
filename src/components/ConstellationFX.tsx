"use client";

import { useEffect, useRef } from "react";

/**
 * A cursor "constellation" overlay: faint glowing lines reach from the pointer
 * to nearby star-anchors and link them to each other, so moving the mouse draws
 * living constellations across the cosmos. Canvas, GPU-light, pointer-safe;
 * disabled for reduced-motion / coarse pointers.
 */
export function ConstellationFX() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!matchMedia("(pointer: fine)").matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    let anchors: { x: number; y: number }[] = [];
    const hash = (n: number) => {
      const x = Math.sin(n * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };

    const build = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      anchors = [];
      const cols = Math.max(4, Math.round(w / 130));
      const rows = Math.max(3, Math.round(h / 130));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const k = i * rows + j + 1;
          anchors.push({
            x: ((i + 0.5) / cols) * w + (hash(k) * 64 - 32),
            y: ((j + 0.5) / rows) * h + (hash(k + 137) * 64 - 32),
          });
        }
      }
    };

    let mx = -9999;
    let my = -9999;
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };
    const onLeave = () => {
      mx = -9999;
      my = -9999;
    };

    let raf = 0;
    const R = 190;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (mx > -9000) {
        const near: { x: number; y: number; d: number }[] = [];
        for (const a of anchors) {
          const d = Math.hypot(a.x - mx, a.y - my);
          if (d < R) near.push({ x: a.x, y: a.y, d });
        }
        near.sort((a, b) => a.d - b.d);
        const top = near.slice(0, 6);

        // cursor → star lines + star nodes
        for (const a of top) {
          const al = (1 - a.d / R) * 0.55;
          ctx.strokeStyle = `rgba(125,211,252,${al.toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(a.x, a.y);
          ctx.stroke();
          ctx.fillStyle = `rgba(125,211,252,${Math.min(1, al * 1.3).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(a.x, a.y, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
        // star ↔ star links (the constellation)
        for (let i = 0; i < top.length; i++) {
          for (let j = i + 1; j < top.length; j++) {
            const A = top[i];
            const B = top[j];
            const d = Math.hypot(A.x - B.x, A.y - B.y);
            if (d < 150) {
              const al = (1 - d / 150) * 0.2;
              ctx.strokeStyle = `rgba(192,132,252,${al.toFixed(3)})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(A.x, A.y);
              ctx.lineTo(B.x, B.y);
              ctx.stroke();
            }
          }
        }
        // a soft node at the cursor
        ctx.fillStyle = "rgba(125,211,252,0.85)";
        ctx.beginPath();
        ctx.arc(mx, my, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    build();
    draw();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", build);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", build);
    };
  }, []);

  return <canvas ref={canvasRef} className="constellation-fx" aria-hidden />;
}
