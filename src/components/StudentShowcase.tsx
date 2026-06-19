import type { ReactNode } from "react";

type Project = {
  title: string;
  type: string;
  author: string;
  accent: string;
  art: ReactNode;
};

const px = (x: number, y: number, fill: string) => (
  <rect key={`${x}-${y}`} x={x} y={y} width={14} height={14} fill={fill} />
);

const projects: Project[] = [
  {
    title: "Cosmic Cat",
    type: "Pixel Art",
    author: "by Aarav, Class 5",
    accent: "#22d3ee",
    art: (
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <rect width={100} height={100} fill="#0b1220" />
        {px(28, 14, "#22d3ee")}
        {px(58, 14, "#22d3ee")}
        {px(28, 28, "#155e75")}
        {px(42, 28, "#22d3ee")}
        {px(58, 28, "#155e75")}
        {px(28, 42, "#22d3ee")}
        {px(42, 42, "#0e7490")}
        {px(58, 42, "#22d3ee")}
        {px(36, 56, "#f43f5e")}
        {px(50, 56, "#f43f5e")}
        {px(28, 70, "#22d3ee")}
        {px(58, 70, "#22d3ee")}
      </svg>
    ),
  },
  {
    title: "Floating Island",
    type: "3D Model",
    author: "by Meera, Class 7",
    accent: "#f59e0b",
    art: (
      <div className="flex h-full w-full items-center justify-center bg-[#160f05]" style={{ perspective: "200px" }}>
        <div style={{ transformStyle: "preserve-3d", transform: "rotateX(58deg) rotateZ(45deg)" }}>
          <div className="h-12 w-12" style={{ background: "#f59e0b", boxShadow: "0 14px 0 #b45309, -14px 0 0 #d97706" }} />
          <div className="mx-auto -mt-3 h-7 w-7" style={{ background: "#fbbf24", boxShadow: "0 8px 0 #d97706" }} />
        </div>
      </div>
    ),
  },
  {
    title: "Fruit Sorter",
    type: "Trained Model",
    author: "by Kabir, Class 6",
    accent: "#a855f7",
    art: (
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <rect width={100} height={100} fill="#120a1e" />
        {[20, 50, 80].flatMap((x) =>
          [70, 50, 30].map((nx) =>
            x < 80 ? <line key={`l${x}-${nx}`} x1={x} y1={nx} x2={x + 30} y2={50} stroke="#a855f7" strokeOpacity={0.3} strokeWidth={1} /> : null,
          ),
        )}
        {[20, 50, 80].flatMap((x) =>
          [30, 50, 70].map((cy) => <circle key={`c${x}-${cy}`} cx={x} cy={cy} r={6} fill="#a855f7" fillOpacity={x === 50 ? 0.9 : 0.6} />),
        )}
      </svg>
    ),
  },
  {
    title: "Blinking Beacon",
    type: "Circuit",
    author: "by Isha, Class 4",
    accent: "#34d399",
    art: (
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <rect width={100} height={100} fill="#05140e" />
        <polyline points="15,80 15,40 45,40 45,20 75,20" fill="none" stroke="#34d399" strokeWidth={2} strokeOpacity={0.7} />
        <polyline points="75,20 75,60 50,60 50,80" fill="none" stroke="#34d399" strokeWidth={2} strokeOpacity={0.7} />
        <circle cx={15} cy={80} r={4} fill="#34d399" />
        <circle cx={50} cy={80} r={4} fill="#34d399" />
        <circle cx={75} cy={20} r={9} fill="#34d399" />
        <circle cx={75} cy={20} r={14} fill="#34d399" fillOpacity={0.25} />
      </svg>
    ),
  },
  {
    title: "Loop Garden",
    type: "Code Animation",
    author: "by Noor, Class 8",
    accent: "#22d3ee",
    art: (
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <rect width={100} height={100} fill="#0b1220" />
        {[14, 32, 50, 68, 86].map((x, i) => {
          const h = 14 + i * 14;
          return <rect key={x} x={x - 6} y={88 - h} width={12} height={h} rx={2} fill="#22d3ee" fillOpacity={0.5 + i * 0.1} />;
        })}
        <path d="M14 18 A12 12 0 1 1 26 30" fill="none" stroke="#22d3ee" strokeWidth={2} />
        <polygon points="26,30 20,26 28,22" fill="#22d3ee" />
      </svg>
    ),
  },
  {
    title: "Maze Escape",
    type: "Game",
    author: "by Vihaan, Class 9",
    accent: "#f43f5e",
    art: (
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <rect width={100} height={100} fill="#1a060d" />
        <g stroke="#f43f5e" strokeWidth={2} strokeOpacity={0.7} fill="none">
          <path d="M10 10 H90 V90 H10 Z" />
          <path d="M10 30 H70" />
          <path d="M30 30 V70 H90" />
          <path d="M50 50 H70 V70" />
          <path d="M30 90 V70" />
        </g>
        <circle cx={20} cy={20} r={6} fill="#f43f5e" />
      </svg>
    ),
  },
];

export default function StudentShowcase() {
  return (
    <section id="showcase">
      <div className="mb-8 text-center">
        <div className="section-label reveal">Made by makers</div>
        <h2 className="section-title reveal">Student showcase</h2>
        <p className="section-sub reveal mx-auto mt-3 max-w-xl">A wall of projects kids have built — from pixel art to 3D worlds and trained models.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div key={p.title} className="panel reveal overflow-hidden group relative">
            <div
              className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-40 transition-opacity group-hover:opacity-70"
              style={{ background: p.accent }}
            />
            <div className="aspect-square w-full overflow-hidden">{p.art}</div>
            <div className="relative p-3">
              <div className="font-display text-sm text-ink">{p.title}</div>
              <div className="font-mono text-[10px] tracking-tech" style={{ color: p.accent }}>
                {p.type} · {p.author}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
