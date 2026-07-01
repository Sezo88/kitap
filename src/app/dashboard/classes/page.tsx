import { createClient } from "@/lib/supabase/server";
import { ClassList } from "@/components/classes/class-list";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function ClassesPage() {
  const supabase = await createClient();
  const { user, profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  let classesQuery = supabase.from("classes").select("*").order("grade_level").order("name");
  if (profile.role !== "super_admin" && profile.school_id) {
    classesQuery = classesQuery.eq("school_id", profile.school_id);
  }

  // Parallelize classes and teachers query
  const [
    { data: classes },
    { data: teachers }
  ] = await Promise.all([
    classesQuery,
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "ogretmen")
      .match(profile.role === "super_admin" ? {} : { school_id: profile.school_id })
  ]);

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
