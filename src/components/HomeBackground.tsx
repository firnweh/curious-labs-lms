import { AmbientBackground } from "@/components/AmbientBackground";

/** The homepage backdrop: full multi-colour palette, playful glyph mix, loud. */
export function HomeBackground() {
  return (
    <AmbientBackground
      tone="rich"
      palette={["#3fd8d4", "#5e9bf0", "#7c6cf0", "#9d7bf2", "#46c7b0"]}
      glyphs={["✨", "🛰️", "🔭", "⭐", "🪐"]}
    />
  );
}
