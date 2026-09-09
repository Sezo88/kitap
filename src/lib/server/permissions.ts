import { createClient } from "@/lib/supabase/server";
import { MANAGEABLE_PERMISSIONS } from "@/lib/types/permissions";

/**
 * Okulun öğretmen yetkilerini veritabanından güvenli çeker (Server Componentler için)
 */
export async function getSchoolTeacherPermissions(
  schoolId: string | null | undefined
): Promise<Record<string, boolean>> {
  if (!schoolId) return {};
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("schools")
      .select("teacher_permissions")
      .eq("id", schoolId)
      .maybeSingle();

    if (!error && data && data.teacher_permissions) {
      return data.teacher_permissions as Record<string, boolean>;
    }
  } catch {
    // Kolon henüz veritabanına eklenmemişse sessizce varsayılana döner
  }
  return {};
}

/**
 * Sayfa seviyesinde erişim kontrolü (Server Component'ler için)
 */
export async function canAccessPage(
  profile: any,
  permissionKey: string
): Promise<boolean> {
  if (!profile) return false;
  if (profile.role === "super_admin" || profile.role === "idareci") return true;
  if (profile.role !== "ogretmen") return false;

  const permissions = await getSchoolTeacherPermissions(profile.school_id);
  const perm = MANAGEABLE_PERMISSIONS.find((p) => p.key === permissionKey);
  if (!perm) return false;

  if (permissions[permissionKey] !== undefined) {
    return permissions[permissionKey];
  }
  return perm.defaultAllowed;
}
