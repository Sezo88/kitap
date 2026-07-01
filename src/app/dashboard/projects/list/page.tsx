import { createClient } from "@/lib/supabase/server";
import { ProjectList } from "@/components/projects/project-list";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function ProjectListPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };

  const [
    { data: classes },
    { data: subjects }
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .match(schoolFilter)
      .order("name"),
    supabase
      .from("subjects")
      .select("*")
      .match(schoolFilter)
      .order("name"),
  ]);

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Proje Listesi Alma</h2>
      <ProjectList
        classes={classes || []}
        subjects={subjects || []}
      />
    </div>
  );
}
