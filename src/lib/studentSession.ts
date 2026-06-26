import crypto from "crypto";

/**
 * Verifier for the student session cookie issued by the existing Curious Labs
 * app (curiouslabs.online/api/student/login). The cookie lives on
 * `.curiouslabs.online`, so this learn.* app can read it. HMAC-SHA256 signed;
 * the secret (STUDENT_SESSION_SECRET) is shared between both apps.
 */

export interface StudentSession {
  kind: "account" | "class" | "phone";
  sub: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string;
  schoolId?: string;
  schoolName?: string;
  grade?: string;
  section?: string;
  exp: number;
}

export const STUDENT_COOKIE = "cl_student";

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function verifyStudentSession(token: string | undefined | null, secret: string): StudentSession | null {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as StudentSession;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
