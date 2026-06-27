import { NextRequest, NextResponse } from "next/server";
import { signPassport, type PassportPayload } from "@/lib/passportToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sign a learner's passport snapshot into a shareable, verifiable token. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.n !== "string" || typeof body.p !== "object" || body.p == null) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // Whitelist progress to id -> stars (1..3) and cap entries.
  const p: Record<string, number> = {};
  let count = 0;
  for (const [id, stars] of Object.entries(body.p as Record<string, unknown>)) {
    const s = Math.round(Number(stars));
    if (typeof id === "string" && id.length <= 80 && s >= 1 && s <= 3 && count < 500) {
      p[id] = s;
      count++;
    }
  }

  const payload: PassportPayload = {
    v: 1,
    n: String(body.n).slice(0, 60) || "Curious Cadet",
    c: body.c ? String(body.c).slice(0, 80) : null,
    p,
    s: Math.max(0, Math.min(9999, Math.round(Number(body.s) || 0))),
    pid: String(body.pid ?? "").slice(0, 24),
    iat: Date.now(),
  };

  return NextResponse.json({ token: signPassport(payload) });
}
