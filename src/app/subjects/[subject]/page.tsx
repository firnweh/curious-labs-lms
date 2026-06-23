import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SUBJECTS, getSubject } from "@/lib/subjects";
import { AmbientBackground } from "@/components/AmbientBackground";
import { SubjectLabList } from "@/components/SubjectLabList";
import { SubjectHero } from "@/components/SubjectHero";
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

        <SubjectHero subject={s.id} />

        <div className="mt-9">
          <SubjectLabList subject={s.id} />
        </div>
      </div>
    </div>
  );
}
