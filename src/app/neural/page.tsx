import type { Metadata } from "next";
import { AILab } from "@/components/AILab";

export const metadata: Metadata = {
  title: "Neural — Curious Labs",
  description:
    "Neural — train your own AI. Add example data, teach a model to tell things apart, watch it learn, test it, and discover bias across 8 hands-on experiments (Grades 1–10).",
};

// Full-screen platform — a fixed overlay covers the global header/chrome so
// Neural is the whole screen, exactly like the Studio and Maker Lab.
export default function NeuralPage() {
  return (
    <div className="fixed inset-0 z-[60] bg-[#080b14] text-[#e8eefc]">
      <AILab />
    </div>
  );
}
