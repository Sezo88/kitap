import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { BellControlClient } from "@/components/admin/bell-control-client";
import { LicenseExpiredBlock } from "@/components/admin/license-expired-block";

export default async function BellControlPage() {
  const supabase = await createClient();
  const { user, profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const schoolData = (profile as any)?.schools;
  const school = Array.isArray(schoolData) ? schoolData[0] : schoolData;
  const isLicenseExpired = school?.license_expires_at && new Date(school.license_expires_at).getTime() < Date.now();

  if (isLicenseExpired && profile.role !== "super_admin") {
    return <LicenseExpiredBlock />;
  }

  // Son 50 komutu getir
  const { data: recentCommands } = await supabase
    .from("bell_commands")
    .select("*, profiles(full_name)")
    .eq("school_id", profile.school_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Zil Kontrol</h2>
      <BellControlClient
        schoolId={profile.school_id}
        userId={user!.id}
        initialCommands={recentCommands || []}
      />
    </div>
  );
}
