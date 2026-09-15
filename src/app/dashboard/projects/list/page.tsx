import { createClient } from "@/lib/supabase/server";
import { ProjectList } from "@/components/projects/project-list";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function ProjectListPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };
  const schoolData = (profile as any)?.schools;
  const schoolName = Array.isArray(schoolData) ? schoolData[0]?.name : schoolData?.name || "";

  let teacherClassIds: string[] = [];
  if (profile.role === "ogretmen") {
    const { data: tc } = await supabase
      .from("teacher_classes")
      .select("class_id")
      .eq("teacher_id", profile.id);
    teacherClassIds = tc?.map((x) => x.class_id) || [];
  }

  const [
    { data: classes },
    { data: subjects }
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .match(schoolFilter)
      .neq("is_active", false)
      .order("name"),
    supabase
      .from("subjects")
      .select("*")
      .match(schoolFilter)
      .order("name"),
  ]);

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Proje Listesi ve Dağılım Çizelgesi</h2>
      <ProjectList
        classes={classes || []}
        subjects={subjects || []}
        schoolName={schoolName}
        teacherClassIds={teacherClassIds}
        userRole={profile.role}
      />
    </div>
  );
}
