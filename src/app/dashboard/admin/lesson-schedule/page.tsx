import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { LessonScheduleEditor } from "@/components/admin/lesson-schedule-editor";

export default async function LessonSchedulePage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const [
    { data: classes },
    { data: teachers },
    { data: subjects },
    { data: bellSchedule },
    { data: lessonSchedule }
  ] = await Promise.all([
    supabase.from("classes").select("id, name").eq("school_id", profile.school_id).order("name"),
    supabase.from("profiles").select("id, full_name").eq("school_id", profile.school_id).eq("role", "ogretmen").eq("status", "active").order("full_name"),
    supabase.from("subjects").select("id, name").eq("school_id", profile.school_id).order("name"),
    supabase.from("bell_schedule").select("*").eq("school_id", profile.school_id).order("period_no"),
    supabase.from("lesson_schedule").select("*").eq("school_id", profile.school_id)
  ]);

  // idarecileri de öğretmen listesine ekle
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("school_id", profile.school_id)
    .eq("role", "idareci")
    .eq("status", "active");

  const allTeachers = [...(teachers || []), ...(admins || [])].sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Ders Programı</h2>
      {(!bellSchedule || bellSchedule.length === 0) ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-2">Ders programı oluşturabilmek için önce <strong>Ders Saatleri</strong> tanımlanmalıdır.</p>
          <a href="/dashboard/admin/bell-schedule" className="text-primary underline">Ders Saatleri sayfasına git →</a>
        </div>
      ) : (
        <LessonScheduleEditor
          classes={classes || []}
          teachers={allTeachers}
          subjects={subjects || []}
          bellSchedule={bellSchedule}
          initialSchedule={lessonSchedule || []}
          schoolId={profile.school_id}
        />
      )}
    </div>
  );
}
