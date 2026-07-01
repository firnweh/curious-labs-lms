import type { Metadata } from "next";
import { AILab } from "@/components/AILab";

export const metadata: Metadata = {
  title: "Neural Lab — Curious Labs",
  description:
    "Neural Lab — train your own AI. Follow one learning journey from Novice to AI Mastery across 35 hands-on experiments laid out as a neural network (Grades 1–10).",
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
