import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { PanelSettingsClient } from "@/components/admin/panel-settings-client";

export default async function PanelSettingsPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erisim yetkiniz yok.</div>;
  }

  const schoolId = profile.school_id;

  // panel_config (tema, logo, motto)
  let { data: config } = await supabase
    .from("panel_config")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();

  // panel_settings (eski)
  let { data: settings } = await supabase
    .from("panel_settings")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!settings) {
    const { data: newSettings } = await supabase
      .from("panel_settings")
      .insert({
        school_id: schoolId,
        active_slides: ["announcements", "lessons", "top_readers", "birthdays", "duties"],
        slide_duration: 10
      })
      .select("*")
      .single();
    settings = newSettings;
  }

  // Duyurular
  const { data: announcements } = await supabase
    .from("panel_announcements")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  // Galeri
  const { data: gallery } = await supabase
    .from("panel_gallery")
    .select("*")
    .eq("school_id", schoolId)
    .order("display_order");

  // Okul PIN
  const { data: school } = await supabase
    .from("schools")
    .select("code, pano_pin")
    .eq("id", schoolId)
    .single();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dijital Pano Ayarlari</h2>
      <PanelSettingsClient
        initialSettings={settings}
        initialConfig={config}
        initialAnnouncements={announcements || []}
        initialGallery={gallery || []}
        schoolId={schoolId}
        schoolCode={school?.code || ""}
        panoPin={school?.pano_pin || ""}
      />
    </div>
  );
}
