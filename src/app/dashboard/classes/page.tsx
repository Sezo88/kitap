import { createClient } from "@/lib/supabase/server";
import { ClassList } from "@/components/classes/class-list";

export default async function ClassesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  let query = supabase.from("classes").select("*").order("grade_level").order("name");
  if (profile?.role !== "super_admin" && profile?.school_id) {
    query = query.eq("school_id", profile.school_id);
  }
  const { data: classes } = await query;

  const { data: teachers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "ogretmen")
    .match(profile?.role === "super_admin" ? {} : { school_id: profile?.school_id });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Sınıf Yönetimi</h2>
      <ClassList
        classes={classes || []}
        teachers={teachers || []}
        role={profile?.role || "ogretmen"}
        schoolId={profile?.school_id || ""}
      />
    </div>
  );
}
