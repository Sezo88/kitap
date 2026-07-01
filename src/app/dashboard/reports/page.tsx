import { createClient } from "@/lib/supabase/server";
import { ReportsClient } from "@/components/reports/reports-client";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { user, profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };

  // Parallelize classes list and teachers list queries
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
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Detaylı Raporlar</h2>
      <ReportsClient
        classes={classes || []}
        schoolFilter={schoolFilter}
        teachers={teachers || []}
      />
    </div>
  );
}
