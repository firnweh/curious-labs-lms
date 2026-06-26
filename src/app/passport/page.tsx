import type { Metadata } from "next";
import { PassportView } from "@/components/PassportView";

export const metadata: Metadata = {
  title: "Skill Passport — Curious Labs",
  description:
    "Your permanent, PW-verified record of skills mastered, labs built, certificates and badges.",
};

export default function PassportPage() {
  return <PassportView />;
}
