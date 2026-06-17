import { AmbientBackground } from "@/components/AmbientBackground";

/** The homepage backdrop: full multi-colour palette, playful glyph mix, loud. */
export function HomeBackground() {
  return (
    <AmbientBackground
      tone="rich"
      palette={["#22d3ee", "#a855f7", "#34d399", "#f59e0b", "#ec4899"]}
      glyphs={["🤖", "🚀", "⚙️", "✨", "🧊", "💡", "🛰️", "🔭", "⭐", "🧠"]}
    />
  );
}
