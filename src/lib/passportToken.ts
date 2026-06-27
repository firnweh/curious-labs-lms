import crypto from "node:crypto";

/**
 * Issue + verify signed Skill Passport tokens.
 *
 * A token is `base64url(payloadJSON).base64url(HMAC-SHA256(payload))`, signed
 * with a server secret. Anyone can open a `/passport/verify?t=<token>` link;
 * the server recomputes the HMAC to prove the credential was issued by Curious
 * Labs and hasn't been edited since. Server-only — uses node:crypto + the secret,
 * so never import this into a client component (use `import type` for the type).
 */

const SECRET =
  process.env.PASSPORT_SECRET ||
  process.env.STUDENT_SESSION_SECRET ||
  "curious-labs-dev-passport-secret";

export interface PassportPayload {
  v: number; // schema version
  n: string; // holder name
  c: string | null; // class line
  p: Record<string, number>; // progress: activityId -> stars (1..3)
  s: number; // streak (days)
  pid: string; // passport id
  iat: number; // issued-at (ms epoch)
}

const enc = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const hmac = (data: string) =>
  crypto.createHmac("sha256", SECRET).update(data).digest("base64url");

export function signPassport(payload: PassportPayload): string {
  const data = enc(JSON.stringify(payload));
  return `${data}.${hmac(data)}`;
}

export function verifyPassport(token: string): {
  ok: boolean;
  payload: PassportPayload | null;
} {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return { ok: false, payload: null };
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(data);
  // constant-time compare; lengths must match first or timingSafeEqual throws
  const ok =
    sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return { ok: false, payload: null };
  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as PassportPayload;
    return { ok: true, payload };
  } catch {
    return { ok: false, payload: null };
  }
}
