import type { Metadata } from "next";
import { MakerLab } from "@/components/MakerLab";

export const metadata: Metadata = {
  title: "Maker Lab — Curious Labs",
  description:
    "Wire up a circuit and program the chip in one full-screen workspace — drag parts, snap wires, and build Arduino/ESP code with blocks.",
};

// Full-screen platform: the fixed overlay covers the global header/chrome so the
// Maker Lab is the whole screen (no hero, no nav).
export default function MakerLabPage() {
  return (
    <div className="fixed inset-0 z-[60] bg-base">
      <MakerLab />
    </div>
  );
}
