import { GradeRail } from "@/components/GradeRail";

/**
 * Slide variant of the grade picker — re-adds the homepage entry point into
 * the per-grade curriculum that was lost when the "Browse by grade" slide was
 * removed. Could later be folded inline into the Tracks slide instead.
 */
export function GradePickerSlide() {
  return (
    <section id="grades">
      <div className="mb-8 text-center">
        <div className="section-label reveal">The Curriculum</div>
        <h2 className="section-title reveal">Pick your grade</h2>
        <p className="section-sub reveal mx-auto mt-3 max-w-xl">
          Each grade has its own year of hands-on projects — jump straight to yours.
        </p>
      </div>
      <div className="reveal">
        <GradeRail />
      </div>
    </section>
  );
}
