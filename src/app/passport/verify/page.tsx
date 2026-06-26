import type { Metadata } from "next";
import { verifyPassport } from "@/lib/passportToken";
import { VerifiedPassportView } from "@/components/VerifiedPassportView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify Skill Passport — Curious Labs",
  description: "Independently verify a Curious Labs Skill Passport credential.",
};

export default async function VerifyPassportPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const { ok, payload } = t ? verifyPassport(t) : { ok: false, payload: null };
  return <VerifiedPassportView verified={ok} payload={payload} />;
}
