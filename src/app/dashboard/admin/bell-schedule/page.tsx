import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { BellScheduleEditor } from "@/components/admin/bell-schedule-editor";
import { LicenseExpiredBlock } from "@/components/admin/license-expired-block";

export default async function BellSchedulePage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const schoolData = (profile as any)?.schools;
  const school = Array.isArray(schoolData) ? schoolData[0] : schoolData;
  const isLicenseExpired = school?.license_expires_at && new Date(school.license_expires_at).getTime() < Date.now();

  if (isLicenseExpired && profile.role !== "super_admin") {
    return <LicenseExpiredBlock />;
  }

  const { data: bellSchedule } = await supabase
    .from("bell_schedule")
    .select("*")
    .eq("school_id", profile.school_id)
    .order("period_no");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Ders Saatleri</h2>
      <BellScheduleEditor
        initialSchedule={bellSchedule || []}
        schoolId={profile.school_id}
      />
    </div>
  );
}
