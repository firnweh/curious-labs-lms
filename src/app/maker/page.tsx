import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { MakerLab } from "@/components/MakerLab";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono", display: "swap" });

export const metadata: Metadata = {
  title: "Maker Lab — Curious Labs",
  description:
    "Wire up a circuit and program the chip in one full-screen workspace — drag parts, snap wires, and build Arduino/ESP code with blocks.",
};

// Full-screen platform — a fixed overlay covers the global header/chrome so the
// Maker Lab is the whole screen. Premium "midnight" canvas + Space Grotesk.
export default function MakerLabPage() {
  return (
    <div
      className={`${grotesk.variable} ${jbmono.variable} fixed inset-0 z-[60] bg-[#080b14] text-[#e8eefc]`}
      style={{ fontFamily: "var(--font-grotesk), system-ui, sans-serif" }}
    >
      <MakerLab />
    </div>
  );
}
