import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolvePrincipal } from "@/lib/server/principal";
import { TeacherDashboard } from "@/components/TeacherDashboard";

export const metadata: Metadata = { title: "Teacher dashboard — Curious Labs" };

export default async function TeacherPage() {
  const principal = await resolvePrincipal();
  if (principal?.kind !== "teacher") redirect("/login");
  return <TeacherDashboard name={principal.account.name} />;
}
