"use client";

import { useT } from "@/lib/i18n";

/**
 * Client header block for the Tracks page so its copy can be translated.
 * Counts are passed from the server page (registry/subject lengths).
 */
export function TracksIntro({ labs, tracks }: { labs: number; tracks: number }) {
  const { t } = useT();

  return (
    <div className="mb-8 text-center">
      <p className="font-mono text-xs tracking-tech text-neon-cyan">
        {t("tracks.kicker")}
      </p>
      <h1
        className="mt-2 font-orbitron text-4xl font-black tracking-tight text-ink sm:text-5xl"
        style={{ textShadow: "0 0 28px rgba(34,211,238,0.45)" }}
      >
        {t("tracks.title")}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-ink-dim">
        {t("tracks.desc", { labs, tracks })}
      </p>
    </div>
  );
}
