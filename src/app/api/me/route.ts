import { NextRequest, NextResponse } from "next/server";
import { verifyStudentSession, STUDENT_COOKIE } from "@/lib/studentSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns the signed-in student (read from the shared .curiouslabs.online cookie), or null. */
export async function GET(req: NextRequest) {
  const secret = process.env.STUDENT_SESSION_SECRET || "";
  const token = req.cookies.get(STUDENT_COOKIE)?.value;
  const session = verifyStudentSession(token, secret);
  if (!session) return NextResponse.json({ student: null });
  return NextResponse.json({
    student: { name: session.name, email: session.email ?? null, school: session.schoolName ?? null, grade: session.grade ?? null },
  });
}
