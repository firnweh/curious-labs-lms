import type { Metadata } from "next";
import { JoinFlow } from "@/components/JoinFlow";

export const metadata: Metadata = {
  title: "Sign in — Curious Labs",
  description: "Join your class to save your progress, stars and badges across devices.",
};

export default function LoginPage() {
  return <JoinFlow />;
}
