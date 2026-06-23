import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless signed-cookie sessions. The cookie holds `studentId.exp.hmac`,
 * where hmac = HMAC-SHA256(SESSION_SECRET, "studentId.exp"). No server-side
 * session store needed; tampering invalidates the signature. httpOnly so JS
 * can't read it; the service-role key never leaves the server either way.
 */
const COOKIE = "cl_session";
const MAX_AGE_DAYS = 180;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set in .env.local");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function createToken(studentId: string): string {
  const exp = Date.now() + MAX_AGE_DAYS * 86_400_000;
  const payload = `${studentId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, mac] = parts;
  const expected = sign(`${id}.${exp}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!Number(exp) || Date.now() > Number(exp)) return null;
  return id;
}

/** Read the signed-in student id from the request cookie (or null). */
export async function getSessionStudentId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

/** Issue a session cookie for a student (called after join/login). */
export async function setSession(studentId: string): Promise<void> {
  (await cookies()).set(COOKIE, createToken(studentId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_DAYS * 86_400,
  });
}

/** Clear the session cookie (sign out). */
export async function clearSession(): Promise<void> {
  (await cookies()).set(COOKIE, "", { path: "/", maxAge: 0 });
}
