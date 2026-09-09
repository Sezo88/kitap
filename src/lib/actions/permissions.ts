"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { revalidatePath } from "next/cache";

export async function saveTeacherPermissions(
  schoolId: string,
  permissions: Record<string, boolean>
) {
  const { user, profile } = await getCachedUserAndProfile();
  if (!user || !profile) {
    return { success: false, error: "Oturum açmanız gerekiyor." };
  }

  if (profile.role !== "super_admin" && profile.role !== "idareci") {
    return { success: false, error: "Bu işlem için yetkiniz yok." };
  }

  if (profile.role === "idareci" && profile.school_id !== schoolId) {
    return { success: false, error: "Yalnızca kendi okulunuzun yetkilerini değiştirebilirsiniz." };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("schools")
    .update({
      teacher_permissions: permissions,
    })
    .eq("id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/admin/permissions");
  return { success: true };
}
