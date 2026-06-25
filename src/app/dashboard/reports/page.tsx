import { createClient } from "@/lib/supabase/server";
import { ReportTable } from "@/components/reports/report-table";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };
  const { data: classes } = await supabase.from("classes").select("*").match(schoolFilter).order("name");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">İdare Raporları</h2>
      <ReportTable
        classes={classes || []}
        schoolFilter={schoolFilter}
      />
    </div>
  );
}
