import { CosmosFX } from "@/components/CosmosFX";
import { ConstellationFX } from "@/components/ConstellationFX";
import { ReactorCore } from "@/components/ReactorCore";

/**
 * Standalone workspace for the "Reactor Core" — the orbiting-studios page with
 * Curious Labs + what we offer in the centre. Kept separate from the homepage
 * (which is the CinematicHero carousel) so we can iterate on it on its own.
 */
export default function ReactorPage() {
  return (
    <>
      <CosmosFX />
      <ConstellationFX />
      <ReactorCore />
    </>
  );
}
