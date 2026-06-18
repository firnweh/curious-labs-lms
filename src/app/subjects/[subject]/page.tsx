import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SUBJECTS, getSubject } from "@/lib/subjects";
import { AmbientBackground } from "@/components/AmbientBackground";
import { SubjectLabList } from "@/components/SubjectLabList";
import { BackLink } from "@/components/ui";

export function generateStaticParams() {
  return SUBJECTS.map((s) => ({ subject: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string }>;
}): Promise<Metadata> {
  const { subject } = await params;
  const s = getSubject(subject);
  return { title: s ? `${s.name} — Curious Labs` : "Curious Labs" };
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  const s = getSubject(subject);
  if (!s) notFound();

  const accent = s.accent;

  return (
    <div className="relative mx-auto max-w-6xl px-5 py-8" style={{ color: accent }}>
      <AmbientBackground palette={s.palette} glyphs={s.glyphs} tone="calm" />

      <div className="relative z-10">
      <BackLink href="/tracks" label="All tracks" />

      <header className="mt-6 flex items-start gap-5">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-4xl"
          style={{ background: `${accent}1a`, border: `1px solid ${accent}40` }}
        >
          {s.emoji}
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl neon-text">
            {s.name}
          </h1>
          <p className="mt-1 text-lg" style={{ color: accent }}>
            {s.tagline}
          </p>
          <p className="mt-2 max-w-2xl text-ink-dim">{s.blurb}</p>
        </div>
      </header>

      <div
        className="mt-8 mb-5 h-px w-full"
        style={{ background: `linear-gradient(90deg, ${accent}66, transparent)` }}
      />

      <SubjectLabList subject={s.id} />
      </div>
    </div>
  );
}
