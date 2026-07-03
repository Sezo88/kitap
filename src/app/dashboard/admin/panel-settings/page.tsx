import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { PanelSettingsClient } from "@/components/admin/panel-settings-client";

export default async function PanelSettingsPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  // 1. Ayarları al (yoksa varsayılan ile oluştur)
  let { data: settings } = await supabase
    .from("panel_settings")
    .select("*")
    .eq("school_id", profile.school_id)
    .maybeSingle();

  if (!settings) {
    const { data: newSettings } = await supabase
      .from("panel_settings")
      .insert({
        school_id: profile.school_id,
        active_slides: ["announcements", "lessons", "top_readers", "birthdays", "duties"],
        slide_duration: 10
      })
      .select("*")
      .single();
    settings = newSettings;
  }

  // 2. Duyuruları al
  const { data: announcements } = await supabase
    .from("panel_announcements")
    .select("*")
    .eq("school_id", profile.school_id)
    .order("created_at", { ascending: false });

  // Get school code
  const { data: school } = await supabase
    .from("schools")
    .select("code")
    .eq("id", profile.school_id)
    .single();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dijital Pano Ayarları</h2>
      <PanelSettingsClient
        initialSettings={settings}
        initialAnnouncements={announcements || []}
        schoolId={profile.school_id}
        schoolCode={school?.code || ""}
      />
    </div>
  );
}
