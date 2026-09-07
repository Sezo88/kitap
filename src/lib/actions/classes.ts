"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { revalidatePath } from "next/cache";

export async function toggleSchoolClassActive(classId: string, isActive: boolean) {
  const { user, profile } = await getCachedUserAndProfile();
  if (!user || !profile) {
    return { success: false, error: "Oturum açmanız gerekiyor" };
  }

  if (profile.role !== "super_admin" && profile.role !== "idareci") {
    return { success: false, error: "Bu işlem için yetkiniz yok" };
  }

  const supabase = createAdminClient();

  let query = supabase
    .from("classes")
    .update({ is_active: isActive })
    .eq("id", classId);

  if (profile.role !== "super_admin" && profile.school_id) {
    query = query.eq("school_id", profile.school_id);
  }

  const { data, error } = await query.select();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data || data.length === 0) {
    return { success: false, error: "Sınıf bulunamadı veya güncellenemedi" };
  }

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/students/import-pdf");
  revalidatePath("/dashboard");

  return { success: true, updatedClass: data[0] };
}

export async function saveSchoolClass(params: {
  id?: string;
  name: string;
  gradeLevel: number;
  quizPin?: string | null;
  isActive: boolean;
  assignedTeacher?: string;
}) {
  const { user, profile } = await getCachedUserAndProfile();
  if (!user || !profile) {
    return { success: false, error: "Oturum açmanız gerekiyor" };
  }

  if (profile.role !== "super_admin" && profile.role !== "idareci") {
    return { success: false, error: "Bu işlem için yetkiniz yok" };
  }

  const supabase = createAdminClient();

  if (params.id) {
    let query = supabase
      .from("classes")
      .update({
        name: params.name.trim(),
        grade_level: params.gradeLevel,
        quiz_pin: params.quizPin || null,
        is_active: params.isActive,
      })
      .eq("id", params.id);

    if (profile.role !== "super_admin" && profile.school_id) {
      query = query.eq("school_id", profile.school_id);
    }

    const { data, error } = await query.select().single();
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/students");
    return { success: true, data };
  } else {
    const schoolId = profile.role === "super_admin" ? (profile.school_id || "") : profile.school_id;
    if (!schoolId) return { success: false, error: "Okul ID bulunamadı" };

    const { data, error } = await supabase
      .from("classes")
      .insert({
        name: params.name.trim(),
        grade_level: params.gradeLevel,
        quiz_pin: params.quizPin || null,
        school_id: schoolId,
        is_active: params.isActive,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    if (params.assignedTeacher && data) {
      await supabase.from("teacher_classes").insert({
        teacher_id: params.assignedTeacher,
        class_id: data.id,
      });
    }

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/students");
    return { success: true, data };
  }
}

export async function deleteSchoolClass(classId: string) {
  const { user, profile } = await getCachedUserAndProfile();
  if (!user || !profile) {
    return { success: false, error: "Oturum açmanız gerekiyor" };
  }

  if (profile.role !== "super_admin" && profile.role !== "idareci") {
    return { success: false, error: "Bu işlem için yetkiniz yok" };
  }

  const supabase = createAdminClient();

  let query = supabase.from("classes").delete().eq("id", classId);
  if (profile.role !== "super_admin" && profile.school_id) {
    query = query.eq("school_id", profile.school_id);
  }

  const { error } = await query;
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/students");
  return { success: true };
}
