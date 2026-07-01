import { createClient } from "@/lib/supabase/server";
import { DailyTracking } from "@/components/tracking/daily-tracking";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function TrackingPage() {
  const supabase = await createClient();
  const { user, profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const today = new Date().toISOString().split("T")[0];

  // Get classes relevant to this user
  let teacherClassIds: string[] | null = null;
  if (profile.role === "ogretmen") {
    const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", user!.id);
    teacherClassIds = tc?.map((t) => t.class_id) || [];
  }

  let classesQuery = supabase.from("classes").select("*").order("name");
  if (profile.role === "ogretmen" && teacherClassIds) {
    if (teacherClassIds.length > 0) {
      classesQuery = classesQuery.in("id", teacherClassIds);
    } else {
      classesQuery = classesQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  } else if (profile.role !== "super_admin" && profile.school_id) {
    classesQuery = classesQuery.eq("school_id", profile.school_id);
  }

  // Get students for those classes
  let studentsQuery = supabase
    .from("students")
    .select("*, classes!inner(name)")
    .eq("is_active", true)
    .order("full_name");

  if (profile.role === "super_admin") {
    // All active students
  } else if (profile.school_id) {
    studentsQuery = studentsQuery.eq("school_id", profile.school_id);
  }

  if (profile.role === "ogretmen" && teacherClassIds) {
    if (teacherClassIds.length > 0) {
      studentsQuery = studentsQuery.in("class_id", teacherClassIds);
    } else {
      studentsQuery = studentsQuery.eq("class_id", "00000000-0000-0000-0000-000000000000");
    }
  }

  // Get books for inline assignment
  const booksQuery = supabase
    .from("books")
    .select("id, title")
    .eq("school_id", profile.school_id ?? "")
    .order("title");

  // Get today's reading logs
  const todayLogsQuery = supabase
    .from("reading_logs")
    .select("*")
    .eq("log_date", today);

  // Parallelize primary queries
  const [
    { data: classes },
    { data: students },
    { data: todayLogs },
    { data: books }
  ] = await Promise.all([
    classesQuery,
    studentsQuery,
    todayLogsQuery,
    booksQuery
  ]);

  // Get active books for these students
  const studentIds = students?.map((s) => s.id) || [];
  let activeBooks: any[] = [];
  if (studentIds.length > 0) {
    const { data } = await supabase
      .from("student_books")
      .select("student_id, started_at, books(title)")
      .eq("status", "active")
      .in("student_id", studentIds);
    activeBooks = data || [];
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 sm:mb-6">Günlük Okuma Takip</h2>
      <DailyTracking
        students={students || []}
        classes={classes || []}
        todayLogs={todayLogs || []}
        activeBooks={activeBooks || []}
        books={books || []}
        userId={user!.id}
        role={profile.role}
      />
    </div>
  );
}
