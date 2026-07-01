import { createClient } from "@/lib/supabase/server";
import { SmsSettingsClient } from "@/components/admin/sms-settings-client";

export default async function SmsSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  if (!profile || !["idareci", "super_admin"].includes(profile.role)) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  if (!profile.school_id) {
    return <div className="text-center py-8 text-muted-foreground">Bir okula bağlı değilsiniz.</div>;
  }

  // Mevcut SMS ayarlarını ve okul bilgilerini çek
  const [
    { data: settings },
    { data: school }
  ] = await Promise.all([
    supabase
      .from("sms_provider_settings")
      .select("*")
      .eq("school_id", profile.school_id)
      .maybeSingle(),
    supabase
      .from("schools")
      .select("total_lessons")
      .eq("id", profile.school_id)
      .maybeSingle()
  ]);

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Genel ve SMS Ayarları</h2>
      <SmsSettingsClient
        schoolId={profile.school_id}
        existingSettings={settings || null}
        schoolTotalLessons={school?.total_lessons ?? 8}
      />
    </div>
  );
}
