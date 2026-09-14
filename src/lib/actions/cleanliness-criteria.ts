"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { revalidatePath } from "next/cache";

export async function addCleanlinessCriteria(name: string) {
  try {
    const { user, profile } = await getCachedUserAndProfile();
    if (!user || !profile) return { success: false, error: "Oturum açmanız gerekiyor" };
    if (profile.role !== "super_admin" && profile.role !== "idareci") {
      return { success: false, error: "Bu işlem için sadece idareciler yetkilidir" };
    }

    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      const { createClient } = await import("@/lib/supabase/server");
      supabase = await createClient();
    }

    const { data, error } = await supabase
      .from("cleanliness_criterias")
      .insert({
        school_id: profile.school_id,
        name: name.trim(),
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/cleanliness");
    revalidatePath("/dashboard/reports/cleanliness");
    return { success: true, criteria: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Kriter eklenirken hata oluştu" };
  }
}

export async function updateCleanlinessCriteria(id: string, name: string) {
  try {
    const { user, profile } = await getCachedUserAndProfile();
    if (!user || !profile) return { success: false, error: "Oturum açmanız gerekiyor" };
    if (profile.role !== "super_admin" && profile.role !== "idareci") {
      return { success: false, error: "Bu işlem için sadece idareciler yetkilidir" };
    }

    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      const { createClient } = await import("@/lib/supabase/server");
      supabase = await createClient();
    }

    const { data, error } = await supabase
      .from("cleanliness_criterias")
      .update({ name: name.trim() })
      .eq("id", id)
      .eq("school_id", profile.school_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/cleanliness");
    revalidatePath("/dashboard/reports/cleanliness");
    return { success: true, criteria: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Kriter güncellenirken hata oluştu" };
  }
}

export async function deleteCleanlinessCriteria(id: string) {
  try {
    const { user, profile } = await getCachedUserAndProfile();
    if (!user || !profile) return { success: false, error: "Oturum açmanız gerekiyor" };
    if (profile.role !== "super_admin" && profile.role !== "idareci") {
      return { success: false, error: "Bu işlem için sadece idareciler yetkilidir" };
    }

    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      const { createClient } = await import("@/lib/supabase/server");
      supabase = await createClient();
    }

    // Önce bu kritere ait puan var mı kontrol edelim
    const { count } = await supabase
      .from("cleanliness_scores")
      .select("id", { count: "exact", head: true })
      .eq("criteria_id", id);

    if (count && count > 0) {
      return {
        success: false,
        error: `Bu kritere ait ${count} adet geçmiş puan kaydı bulunmaktadır. Veri tutarlılığı için bu kriter silinemez. Dilerseniz adını güncelleyebilirsiniz.`,
      };
    }

    const { error } = await supabase
      .from("cleanliness_criterias")
      .delete()
      .eq("id", id)
      .eq("school_id", profile.school_id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/cleanliness");
    revalidatePath("/dashboard/reports/cleanliness");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Kriter silinirken hata oluştu" };
  }
}
