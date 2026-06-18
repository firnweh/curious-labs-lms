import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUBJECTS, getSubject } from "@/lib/subjects";
import { CertificateView } from "@/components/CertificateView";
import type { SubjectId } from "@/lib/activities/types";

export function generateStaticParams() {
  return SUBJECTS.map((s) => ({ subject: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string }>;
}): Promise<Metadata> {
  const { subject } = await params;
  const s = getSubject(subject);
  return { title: s ? `${s.name} Certificate — Curious Labs` : "Certificate" };
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  if (!getSubject(subject)) notFound();
  return <CertificateView subjectId={subject as SubjectId} />;
}
