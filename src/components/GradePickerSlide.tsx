import { GradeJourney } from "@/components/GradeJourney";

/**
 * Slide variant of the grade picker — a "Mission Select" journey map into the
 * per-grade curriculum: each grade shows its theme + signature project, colour
 * coded by band, so you see the climb from a first circuit to a self-driving car.
 */
export function GradePickerSlide() {
  return (
    <section id="grades">
      <div className="mb-6 text-center">
        <div className="section-label reveal">The Curriculum · Grades 1–10</div>
        <h2 className="section-title reveal">Pick your grade</h2>
        <p className="section-sub reveal mx-auto mt-3 max-w-2xl">
          One year of hands-on projects per grade — the climb from a blinking LED to a self-driving car. Tap a grade to jump in.
        </p>
      </div>
      <GradeJourney />
    </section>
  );
}
