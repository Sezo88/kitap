import { createClient } from "@/lib/supabase/server";
import { AttendanceReportClient } from "@/components/reports/attendance-report-client";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function AttendanceReportsPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };

  const [
    { data: classes },
    { data: seasons }
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .match(schoolFilter)
      .order("name"),
    supabase
      .from("archive_seasons")
      .select("*")
      .match(schoolFilter)
      .order("archived_at", { ascending: false })
      .then((r) => (r.error ? { data: [] } : r))
  ]);

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Devamsızlık ve Yoklama Raporları</h2>
      <AttendanceReportClient
        classes={classes || []}
        schoolFilter={schoolFilter}
        seasons={seasons || []}
      />
    </div>
  );
}
