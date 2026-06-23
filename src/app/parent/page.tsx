import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolvePrincipal } from "@/lib/server/principal";
import { ParentDashboard } from "@/components/ParentDashboard";

export const metadata: Metadata = { title: "Parent dashboard — Curious Labs" };

export default async function ParentPage() {
  const principal = await resolvePrincipal();
  if (principal?.kind !== "parent") redirect("/login");
  return <ParentDashboard name={principal.account.name} />;
}
