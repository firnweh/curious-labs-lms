type ValueProp = {
  emoji: string;
  title: string;
  desc: string;
  accent: string;
};

const VALUE_PROPS: ValueProp[] = [
  {
    emoji: "📚",
    title: "Curriculum-aligned",
    desc: "Every lab maps to grade 1–10 STEM learning outcomes.",
    accent: "#22d3ee",
  },
  {
    emoji: "📈",
    title: "Progress tracking",
    desc: "See completed labs, streaks and skills per child — at a glance.",
    accent: "#34d399",
  },
  {
    emoji: "🏅",
    title: "Certificates",
    desc: "Kids earn shareable certificates as they finish each track.",
    accent: "#a855f7",
  },
  {
    emoji: "🛡️",
    title: "Safe & ad-free",
    desc: "No ads, no chat, no data resold — a walled makerspace.",
    accent: "#f59e0b",
  },
  {
    emoji: "💻",
    title: "Zero installs",
    desc: "Runs in any browser on school or home devices — nothing to set up.",
    accent: "#22d3ee",
  },
  {
    emoji: "🎓",
    title: "Powered by Physics Wallah",
    desc: "Backed by India's trusted education platform.",
    accent: "#f43f5e",
  },
];

export function ParentsTeachers() {
  return (
    <section id="educators">
      <div className="mb-8 text-center">
        <div className="section-label reveal">For parents & teachers</div>
        <h2 className="section-title reveal">Built for classrooms and curious homes</h2>
        <p className="section-sub reveal mx-auto mt-3 max-w-xl">Curriculum-aligned, progress-tracked, and powered by Physics Wallah — safe, structured, and screen-time worth having.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {VALUE_PROPS.map(({ emoji, title, desc, accent }) => (
          <div key={title} className="panel tilt reveal p-7">
            <span
              className="grid h-12 w-12 place-items-center rounded-2xl text-2xl"
              style={{ background: `${accent}1a`, border: `1px solid ${accent}40` }}
            >
              {emoji}
            </span>
            <div className="mt-3 font-mono text-xs tracking-tech" style={{ color: accent }}>
              {title.toUpperCase()}
            </div>
            <h3 className="mt-1 font-orbitron text-lg font-bold text-ink">{title}</h3>
            <p className="mt-2 text-sm text-ink-dim">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ParentsTeachers;
