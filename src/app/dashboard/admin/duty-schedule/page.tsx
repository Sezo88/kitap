import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { DutyScheduleEditor } from "@/components/admin/duty-schedule-editor";
import { canAccessPage } from "@/lib/server/permissions";

export default async function DutySchedulePage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  const allowed = await canAccessPage(profile, "duty_schedule");
  if (!allowed) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const [
    { data: teachers },
    { data: admins },
    { data: dutySchedule },
    { data: panelConfig },
    statsRes
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("school_id", profile.school_id)
      .eq("role", "ogretmen")
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("school_id", profile.school_id)
      .eq("role", "idareci")
      .eq("status", "active"),
    supabase
      .from("duty_schedule")
      .select("*, profiles(full_name)")
      .eq("school_id", profile.school_id),
    supabase
      .from("panel_config")
      .select("nobet_yerleri")
      .eq("school_id", profile.school_id)
      .maybeSingle(),
    supabase
      .from("duty_stats")
      .select("*")
      .eq("school_id", profile.school_id)
      .order("extra_duties", { ascending: false })
  ]);

  const allTeachers = [...(teachers || []), ...(admins || [])].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "tr-TR")
  );

  const nobetYerleri = panelConfig?.nobet_yerleri
    ? panelConfig.nobet_yerleri.split(",").map((s: string) => s.trim()).filter(Boolean)
    : ["ÖN BAHÇE", "ARKA BAHÇE", "ZEMİN KAT", "1. KAT", "2. KAT"];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Nöbet Programı & Rotasyon</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Haftalık nöbet çizelgesini yönetin, Excel'den yükleyin, nöbet yerlerini haftalık döndürün ve fazla nöbet istatistiklerini takip edin.
        </p>
      </div>

      <DutyScheduleEditor
        teachers={allTeachers}
        initialSchedule={dutySchedule || []}
        schoolId={profile.school_id}
        initialNobetYerleri={nobetYerleri}
        initialDutyStats={statsRes?.data || []}
      />
    </div>
  );
}
