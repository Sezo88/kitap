import { createClient } from "@/lib/supabase/server";
import { ReadingReportClient } from "@/components/reports/reading-report-client";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function ReadingReportsPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };

  const [
    { data: classes },
    { data: teachers }
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .match(schoolFilter)
      .order("name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .match({ ...schoolFilter, role: "ogretmen", status: "active" })
      .order("full_name")
  ]);

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Okuma ve Kitap Raporları</h2>
      <ReadingReportClient
        classes={classes || []}
        schoolFilter={schoolFilter}
        teachers={teachers || []}
      />
    </div>
  );
}
