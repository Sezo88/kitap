import { createClient } from "@/lib/supabase/server";
import { CleanlinessReportClient } from "@/components/reports/cleanliness-report-client";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function CleanlinessReportsPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };

  const [
    { data: classes },
    { data: criterias }
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .match(schoolFilter)
      .order("name"),
    supabase
      .from("cleanliness_criterias")
      .select("*")
      .match(schoolFilter)
      .order("name")
  ]);

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Temiz Sınıf Puan Raporları</h2>
      <CleanlinessReportClient
        classes={classes || []}
        criterias={criterias || []}
        schoolFilter={schoolFilter}
      />
    </div>
  );
}
