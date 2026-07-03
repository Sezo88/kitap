import { createClient } from "@/lib/supabase/server";

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  if (!profile) return null;

  const today = new Date().toISOString().split("T")[0];

  // Get classes for this user
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

  // Get students
  let studentsQuery = supabase
    .from("students")
    .select("id, full_name, class_id, veli_telefon, veli_telefon_2, classes!inner(name)")
    .eq("is_active", true)
    .order("full_name");

  if (profile.role === "super_admin") {
    // All
  } else if (profile.school_id) {
    studentsQuery = studentsQuery.eq("school_id", profile.school_id);
  }

  if (profile.role === "ogretmen" && teacherClassIds && teacherClassIds.length > 0) {
    studentsQuery = studentsQuery.in("class_id", teacherClassIds);
  }

  // Parallel fetch
  const [{ data: classes }, { data: students }] = await Promise.all([classesQuery, studentsQuery]);

  // Get today's attendance logs
  const classIds = classes?.map((c) => c.id) || [];
  let todayLogs: any[] = [];
  if (classIds.length > 0) {
    const { data } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("log_date", today)
      .in("class_id", classIds);
    todayLogs = data || [];
  }

  // Check SMS provider active status, school total_lessons and bell schedule
  let smsActive = false;
  let totalLessons = 8;
  let bellSchedule: { period_no: number; start_time: string; end_time: string }[] = [];
  if (profile.school_id) {
    const [
      { data: smsSettings },
      { data: school },
      { data: bells }
    ] = await Promise.all([
      supabase
        .from("sms_provider_settings")
        .select("is_active")
        .eq("school_id", profile.school_id)
        .maybeSingle(),
      supabase
        .from("schools")
        .select("total_lessons")
        .eq("id", profile.school_id)
        .maybeSingle(),
      supabase
        .from("bell_schedule")
        .select("period_no, start_time, end_time")
        .eq("school_id", profile.school_id)
        .order("period_no")
    ]);
    smsActive = smsSettings?.is_active || false;
    totalLessons = school?.total_lessons || 8;
    bellSchedule = bells || [];
  }

  // Aktif ders saatini hesapla
  let activeLesson = 1;
  if (bellSchedule.length > 0) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (const bell of bellSchedule) {
      const [sh, sm] = bell.start_time.split(":").map(Number);
      const [eh, em] = bell.end_time.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (currentMinutes >= startMin && currentMinutes <= endMin) {
        activeLesson = bell.period_no;
        break;
      }
      // Henüz başlamamış ilk dersi bul
      if (currentMinutes < startMin && activeLesson === 1) {
        activeLesson = bell.period_no;
      }
      // teneffüste ise bir sonraki dersi göster
      if (currentMinutes > endMin) {
        activeLesson = bell.period_no + 1;
      }
    }
    // Max sınırı aşma
    if (activeLesson > totalLessons) activeLesson = totalLessons;
  }

  // Dynamic import to avoid SSR issues
  const { AttendanceForm } = await import("@/components/attendance/attendance-form");

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Yoklama</h2>
      <AttendanceForm
        students={students || []}
        classes={classes || []}
        todayLogs={todayLogs}
        userId={user!.id}
        schoolId={profile.school_id || ""}
        smsActive={smsActive}
        totalLessons={totalLessons}
        activeLesson={activeLesson}
      />
    </div>
  );
}
