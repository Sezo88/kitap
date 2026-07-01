import { createClient } from "@/lib/supabase/server";
import { AttendanceReportClient } from "@/components/reports/attendance-report-client";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function AttendanceReportsPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .match(schoolFilter)
    .order("name");

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Devamsızlık ve Yoklama Raporları</h2>
      <AttendanceReportClient
        classes={classes || []}
        schoolFilter={schoolFilter}
      />
    </div>
  );
}
