import { createClient } from "@/lib/supabase/server";
import { DailyTracking } from "@/components/tracking/daily-tracking";

export default async function TrackingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  if (!profile) return null;

  const today = new Date().toISOString().split("T")[0];

  // Get classes relevant to this user
  let classesQuery = supabase.from("classes").select("*").order("name");
  if (profile.role === "ogretmen") {
    const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", user!.id);
    const classIds = tc?.map((t) => t.class_id) || [];
    if (classIds.length > 0) {
      classesQuery = classesQuery.in("id", classIds);
    }
  } else if (profile.role !== "super_admin" && profile.school_id) {
    classesQuery = classesQuery.eq("school_id", profile.school_id);
  }
  const { data: classes } = await classesQuery;

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

  if (classes && classes.length > 0) {
    const classIds = classes.map((c) => c.id);
    studentsQuery = studentsQuery.in("class_id", classIds);
  }

  const { data: students } = await studentsQuery;

  // Get today's reading logs
  const { data: todayLogs } = await supabase
    .from("reading_logs")
    .select("*")
    .eq("log_date", today);

  // Get active books for these students
  const studentIds = students?.map((s) => s.id) || [];
  let activeBooksQuery = supabase
    .from("student_books")
    .select("student_id, started_at, books(title)")
    .eq("status", "active");

  if (studentIds.length > 0) {
    activeBooksQuery = activeBooksQuery.in("student_id", studentIds);
  }
  const { data: activeBooks } = await activeBooksQuery;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Günlük Okuma Takip</h2>
      <DailyTracking
        students={students || []}
        classes={classes || []}
        todayLogs={todayLogs || []}
        activeBooks={activeBooks || []}
        userId={user!.id}
        role={profile.role}
      />
    </div>
  );
}
