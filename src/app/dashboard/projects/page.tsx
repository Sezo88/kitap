import { createClient } from "@/lib/supabase/server";
import { ProjectAssignment } from "@/components/projects/project-assignment";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { user, profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };

  // Kullanıcının erişebileceği sınıfları belirle
  let classFilter: any = schoolFilter;
  if (profile.role === "ogretmen") {
    const { data: tc } = await supabase
      .from("teacher_classes")
      .select("class_id")
      .eq("teacher_id", profile.id);
    const classIds = tc?.map((x) => x.class_id) || [];
    if (classIds.length === 0) {
      return (
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Proje Belirleme</h2>
          <div className="text-center py-8 text-muted-foreground">
            Size atanmış bir sınıf bulunmuyor. Lütfen idarecinizle iletişime geçin.
          </div>
        </div>
      );
    }
    const { data: assignedClasses } = await supabase
      .from("classes")
      .select("*")
      .in("id", classIds)
      .order("name");
    const classes = assignedClasses || [];

    const { data: subjects } = await supabase
      .from("subjects")
      .select("*")
      .match(schoolFilter)
      .order("name");

    return (
      <div>
        <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Proje Belirleme</h2>
        <ProjectAssignment
          classes={classes}
          subjects={subjects || []}
          schoolFilter={schoolFilter}
          userId={profile.id}
        />
      </div>
    );
  }

  // idareci ve super_admin tüm sınıfları görür
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
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Proje Belirleme</h2>
      <ProjectAssignment
        classes={classes || []}
        subjects={subjects || []}
        schoolFilter={schoolFilter}
        userId={profile.id}
      />
    </div>
  );
}
