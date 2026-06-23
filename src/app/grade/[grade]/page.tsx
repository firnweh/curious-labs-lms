import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { activitiesByGrade, gradesWithContent } from "@/lib/activities/registry";
import { AmbientBackground } from "@/components/AmbientBackground";
import { GradeView } from "@/components/GradeView";
import { GradeHero } from "@/components/GradeHero";
import { BackLink } from "@/components/ui";

const GRADE_THEME: Record<number, string> = {
  1: "Think, Build, Play",
};

export function generateStaticParams() {
  return gradesWithContent().map((g) => ({ grade: String(g) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ grade: string }>;
}): Promise<Metadata> {
  const { grade } = await params;
  return { title: `Grade ${grade} — Curious Labs` };
}

export default async function GradePage({
  params,
}: {
  params: Promise<{ grade: string }>;
}) {
  const { grade } = await params;
  const n = Number(grade);
  const labs = Number.isInteger(n) ? activitiesByGrade(n) : [];
  if (labs.length === 0) notFound();

  return (
    <div className="relative mx-auto max-w-6xl px-5 py-8">
      <AmbientBackground
        palette={["#22d3ee", "#a855f7", "#34d399"]}
        glyphs={["🤖", "💡", "🚦", "🎨", "🧩", "✨"]}
        tone="calm"
      />

      <div className="relative z-10">
        <BackLink href="/" label="All grades" />

        <GradeHero grade={n} theme={GRADE_THEME[n]} />

        <div className="mt-9">
          <GradeView grade={n} />
        </div>
      </div>
    </div>
  );
}
