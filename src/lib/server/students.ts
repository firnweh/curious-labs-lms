import "server-only";
import { admin } from "./supabaseAdmin";
import type { StudentInfo } from "@/lib/cloud-types";

type ClassRel = { code: string; name: string } | { code: string; name: string }[] | null;

function oneClass(c: ClassRel) {
  return Array.isArray(c) ? c[0] : c;
}

/** Public info for one learner (shared by joinClass + the principal resolver). */
export async function getStudentInfo(id: string): Promise<StudentInfo | null> {
  const { data } = await admin()
    .from("students")
    .select("id, name, display_name, classes(code, name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const cls = oneClass(data.classes as ClassRel);
  return {
    id: data.id,
    name: data.name,
    displayName: data.display_name || data.name,
    classCode: cls?.code ?? "",
    className: cls?.name ?? "",
  };
}
