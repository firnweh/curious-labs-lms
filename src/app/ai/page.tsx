import type { Metadata } from "next";
import { AILab } from "@/components/AILab";

export const metadata: Metadata = {
  title: "AI Lab — Curious Labs",
  description:
    "Train your own AI: add example data, teach it to tell things apart, watch the AI learn a decision boundary, test it, and discover bias — hands-on AI literacy.",
};

// Full-screen platform — a fixed overlay covers the global header/chrome so the
// AI Lab is the whole screen, exactly like the Studio and Maker Lab.
export default function AILabPage() {
  return (
    <div className="fixed inset-0 z-[60] bg-[#080b14] text-[#e8eefc]">
      <AILab />
    </div>
  );
}
