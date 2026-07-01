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

  // Mevcut SMS ayarlarını çek
  const { data: settings } = await supabase
    .from("sms_provider_settings")
    .select("*")
    .eq("school_id", profile.school_id)
    .single();

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">SMS Ayarları</h2>
      <SmsSettingsClient
        schoolId={profile.school_id}
        existingSettings={settings || null}
      />
    </div>
  );
}
