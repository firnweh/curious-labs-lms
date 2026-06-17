"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { SubjectId } from "@/lib/activities/types";
import { SUBJECT_MAP } from "@/lib/subjects";

type Phase = "in" | "out";
type Ctx = { go: (subject: SubjectId, href: string) => void };

const TransitionCtx = createContext<Ctx | null>(null);
export const useSubjectTransition = () => useContext(TransitionCtx);

const COVER_MS = 520;
const REVEAL_MS = 430;

export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [run, setRun] = useState<{ subject: SubjectId; href: string; phase: Phase } | null>(null);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const go = useCallback(
    (subject: SubjectId, href: string) => {
      // Honour reduced-motion: skip the effect, just navigate.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.push(href);
        return;
      }
      router.prefetch(href);
      clear();
      setRun({ subject, href, phase: "in" });
      const t1 = window.setTimeout(() => {
        router.push(href);
        setRun((r) => (r ? { ...r, phase: "out" } : r));
        const t2 = window.setTimeout(() => setRun(null), REVEAL_MS);
        timers.current.push(t2);
      }, COVER_MS);
      timers.current.push(t1);
    },
    [router],
  );

  useEffect(() => () => clear(), []);

  return (
    <TransitionCtx.Provider value={{ go }}>
      {children}
      {run && <Overlay subject={run.subject} phase={run.phase} />}
    </TransitionCtx.Provider>
  );
}

function Overlay({ subject, phase }: { subject: SubjectId; phase: Phase }) {
  const s = SUBJECT_MAP[subject];
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden">
      {/* keyed cover → animation restarts cleanly on phase change */}
      <div
        key={phase}
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, ${s.accent}33, transparent 60%), #05070d`,
          animation:
            phase === "in"
              ? `tx-cover-in ${COVER_MS}ms ease-out forwards`
              : `tx-cover-out ${REVEAL_MS}ms ease-in forwards`,
        }}
      />
      {phase === "in" && (
        <>
          <Effect subject={subject} />
          <div
            className="absolute bottom-[14%] font-mono text-xs tracking-tech"
            style={{ color: s.accent, textShadow: `0 0 14px ${s.accent}` }}
          >
            ◤ LAUNCHING {s.name.toUpperCase()} ◢
          </div>
        </>
      )}
    </div>
  );
}

function Effect({ subject }: { subject: SubjectId }) {
  switch (subject) {
    case "coding":
      return <CodeRain />;
    case "robotics":
      return <CircuitTrace />;
    case "ai":
      return <NeuralNet />;
    case "threed":
      return <VoxelAssemble />;
  }
}

/* ── Coding: falling code rain ──────────────────────────────── */
function CodeRain() {
  const chars = "01</>{}=+*#01λ01";
  const cols = 20;
  return (
    <div className="absolute inset-0">
      {Array.from({ length: cols }).map((_, i) => {
        const text = Array.from({ length: 36 })
          .map(() => chars[Math.floor(Math.random() * chars.length)])
          .join("\n");
        return (
          <div
            key={i}
            className="absolute top-0 whitespace-pre text-center font-mono leading-tight"
            style={{
              left: `${(i / cols) * 100}%`,
              width: `${100 / cols}%`,
              fontSize: 18,
              color: i % 4 === 0 ? "#a3e635" : "#22d3ee",
              opacity: 0.85,
              textShadow: "0 0 8px currentColor",
              animation: `tx-rain ${0.5 + (i % 5) * 0.12}s linear ${-(i % 7) * 0.13}s both`,
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}

/* ── Robotics: circuit traces powering up ───────────────────── */
function CircuitTrace() {
  const C = "#34d399";
  const paths = [
    "10,20 35,20 35,45 60,45 60,30 90,30",
    "5,55 25,55 25,75 55,75 55,60 95,60",
    "15,90 15,70 45,70 45,85 80,85 80,72 95,72",
    "20,8 20,35 50,35 50,15 75,15 75,40 92,40",
  ];
  const nodes = [
    [35, 20], [60, 45], [25, 75], [55, 60], [45, 35], [75, 15], [50, 75], [80, 85],
  ];
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {paths.map((p, i) => (
        <polyline
          key={i}
          points={p}
          fill="none"
          stroke={C}
          strokeWidth={0.5}
          pathLength={1}
          style={{
            strokeDasharray: 1,
            filter: `drop-shadow(0 0 1px ${C})`,
            animation: `tx-trace 0.5s ease-out ${i * 0.06}s both`,
          }}
        />
      ))}
      {nodes.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={1.1}
          fill={C}
          style={{
            transformOrigin: `${x}px ${y}px`,
            filter: `drop-shadow(0 0 2px ${C})`,
            animation: `tx-pop 0.4s ease-out ${0.25 + i * 0.05}s both`,
          }}
        />
      ))}
    </svg>
  );
}

/* ── AI: neural network ignites ─────────────────────────────── */
function NeuralNet() {
  const layers = [25, 50, 75];
  const ys = [28, 50, 72];
  const nodes = layers.flatMap((x, li) => ys.map((y, ni) => ({ x, y, key: `${li}-${ni}` })));
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let l = 0; l < layers.length - 1; l++) {
    for (const a of ys) for (const b of ys) {
      edges.push({ x1: layers[l], y1: a, x2: layers[l + 1], y2: b });
    }
  }
  const V = "#a855f7";
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke="#c084fc"
          strokeWidth={0.25}
          pathLength={1}
          style={{ strokeDasharray: 1, opacity: 0.7, animation: `tx-trace 0.45s ease-out ${0.1 + (i % 9) * 0.03}s both` }}
        />
      ))}
      {nodes.map((n, i) => (
        <circle
          key={n.key}
          cx={n.x}
          cy={n.y}
          r={1.8}
          fill={i % 2 ? "#ec4899" : V}
          style={{
            transformOrigin: `${n.x}px ${n.y}px`,
            filter: `drop-shadow(0 0 2px ${V})`,
            animation: `tx-pop 0.4s ease-out ${i * 0.04}s both`,
          }}
        />
      ))}
      {[0, 1].map((i) => (
        <circle
          key={`r${i}`}
          cx={50}
          cy={50}
          r={40}
          fill="none"
          stroke={V}
          strokeWidth={0.5}
          style={{ transformOrigin: "50px 50px", animation: `tx-ring 0.7s ease-out ${0.15 + i * 0.18}s both` }}
        />
      ))}
    </svg>
  );
}

/* ── 3D: voxels assemble into an isometric grid ─────────────── */
function VoxelAssemble() {
  const cols = 4;
  const rows = 4;
  const tile = 56;
  // deterministic-ish pseudo-random offsets keyed by index (no SSR — client only)
  const off = (i: number, salt: number) => Math.sin(i * 12.9898 + salt) * 43758.5453;
  return (
    <div
      className="absolute"
      style={{
        width: cols * tile,
        height: rows * tile,
        transformStyle: "preserve-3d",
        transform: "rotateX(58deg) rotateZ(45deg)",
      }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const dx = ((off(i, 1) % 1) - 0.5) * 520;
        const dy = ((off(i, 2) % 1) - 0.5) * 520;
        const dr = ((off(i, 3) % 1) - 0.5) * 240;
        const style: CSSProperties = {
          position: "absolute",
          left: c * tile,
          top: r * tile,
          width: tile - 7,
          height: tile - 7,
          borderRadius: 7,
          background: "linear-gradient(135deg, #fcd34d, #f59e0b)",
          border: "1px solid #fde68a66",
          boxShadow: "0 8px 16px #00000070, inset 0 0 8px #ffffff33",
          ["--dx" as string]: `${dx}px`,
          ["--dy" as string]: `${dy}px`,
          ["--dr" as string]: `${dr}deg`,
          animation: `tx-voxel 0.55s cubic-bezier(.2,.8,.2,1) ${(r + c) * 0.05}s both`,
        };
        return <div key={i} style={style} />;
      })}
    </div>
  );
}
