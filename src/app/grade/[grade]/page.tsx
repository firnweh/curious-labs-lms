import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { activitiesByGrade, gradesWithContent } from "@/lib/activities/registry";
import { AmbientBackground } from "@/components/AmbientBackground";
import { GradeView } from "@/components/GradeView";
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

        <header className="mt-6 flex items-start gap-5">
          <span
            className="font-display grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-neon-cyan"
            style={{ background: "#22d3ee1a", border: "1px solid #22d3ee40" }}
          >
            G{n}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl neon-text text-neon-cyan">
              Grade {n}
            </h1>
            {GRADE_THEME[n] && (
              <p className="mt-1 text-lg text-neon-cyan">{GRADE_THEME[n]}</p>
            )}
            <p className="mt-2 max-w-2xl text-ink-dim">
              {`${labs.length} hands-on labs from this year's curriculum`} — one per
              project, built to tap, drag and play right in your browser.
            </p>
          </div>
        </header>

        <div className="mt-8 mb-5 h-px w-full bg-gradient-to-r from-neon-cyan/40 to-transparent" />

        <GradeView grade={n} />
      </div>
    </div>
  );
}
