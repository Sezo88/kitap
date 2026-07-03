import { createClient } from "@/lib/supabase/server";
import { ReadingReportClient } from "@/components/reports/reading-report-client";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function ReadingReportsPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };
  const isOgretmen = profile.role === "ogretmen";

  const [
    { data: classes },
    { data: teachers },
    { data: seasons }
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .match(schoolFilter)
      .order("name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .match({ ...schoolFilter, role: "ogretmen" })
      .order("full_name"),
    supabase
      .from("archive_seasons")
      .select("*")
      .match(schoolFilter)
      .order("archived_at", { ascending: false })
      .then((r) => (r.error ? { data: [] } : r))
  ]);

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Okuma ve Kitap Raporları</h2>
      <ReadingReportClient
        classes={classes || []}
        schoolFilter={schoolFilter}
        teachers={teachers || []}
        hideTeacherActivity={isOgretmen}
        seasons={seasons || []}
      />
    </div>
  );
}
