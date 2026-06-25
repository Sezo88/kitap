import { createClient } from "@/lib/supabase/server";
import { ReportsClient } from "@/components/reports/reports-client";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .match(schoolFilter)
    .order("name");

  // Öğretmenleri çek (aktivite raporu için)
  const { data: teachers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .match({ ...schoolFilter, role: "ogretmen", status: "active" })
    .order("full_name");

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
