import { ExcelImport } from "@/components/students/excel-import";
import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { redirect } from "next/navigation";

export default async function ImportPage() {
  const { user, profile } = await getCachedUserAndProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();
  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };
  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .match(schoolFilter)
    .order("name");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Excel ile Öğrenci İçe Aktar</h2>
      <ExcelImport classes={classes || []} schoolId={profile.school_id || ""} />
    </div>
  );
}
