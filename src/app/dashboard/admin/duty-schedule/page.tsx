import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { DutyScheduleEditor } from "@/components/admin/duty-schedule-editor";

export default async function DutySchedulePage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const [
    { data: teachers },
    { data: admins },
    { data: dutySchedule },
    { data: panelConfig }
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("school_id", profile.school_id).eq("role", "ogretmen").eq("status", "active").order("full_name"),
    supabase.from("profiles").select("id, full_name").eq("school_id", profile.school_id).eq("role", "idareci").eq("status", "active"),
    supabase.from("duty_schedule").select("*, profiles(full_name)").eq("school_id", profile.school_id),
    supabase.from("panel_config").select("nobet_yerleri").eq("school_id", profile.school_id).maybeSingle()
  ]);

  const allTeachers = [...(teachers || []), ...(admins || [])].sort((a, b) => a.full_name.localeCompare(b.full_name));
  const nobetYerleri = panelConfig?.nobet_yerleri
    ? panelConfig.nobet_yerleri.split(",").map((s: string) => s.trim()).filter(Boolean)
    : ["Giris/Kapi", "Bahce", "Kantin"];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Nöbet Programı</h2>
      <DutyScheduleEditor
        teachers={allTeachers}
        initialSchedule={dutySchedule || []}
        schoolId={profile.school_id}
        nobetYerleri={nobetYerleri}
      />
    </div>
  );
}
