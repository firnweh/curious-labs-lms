import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ACTIVITIES, getActivityMeta } from "@/lib/activities/registry";
import { LabShell } from "@/components/LabShell";

export function generateStaticParams() {
  return ACTIVITIES.map((a) => ({ id: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meta = getActivityMeta(id);
  return { title: meta ? `${meta.title} — Curious Labs` : "Lab — Curious Labs" };
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!getActivityMeta(id)) notFound();
  return <LabShell id={id} />;
}
