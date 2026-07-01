import { createClient } from "@/lib/supabase/server";
import { SmsLogsClient } from "@/components/admin/sms-logs-client";

export default async function SmsLogsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  if (!profile || !["idareci", "super_admin"].includes(profile.role)) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">SMS Gönderim Geçmişi</h2>
      <SmsLogsClient schoolId={profile.school_id || ""} />
    </div>
  );
}
