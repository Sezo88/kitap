import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { ExamScheduleManager } from "@/components/exam-schedule/exam-schedule-manager";
import type { ExamPeriod, ExamScheduleWithDetails, Subject } from "@/lib/types/database";

export default async function ExamSchedulePage() {
  const supabase = await createClient();
  const { profile, user } = await getCachedUserAndProfile();

  if (!profile || !profile.school_id) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Lütfen önce bir okula dahil olduğunuzdan emin olun.
      </div>
    );
  }

  // 1. Sınav Dönemlerini Çek
  let periods: ExamPeriod[] = [];
  let schedules: ExamScheduleWithDetails[] = [];
  let tableError = false;

  try {
    const { data: periodData, error: periodErr } = await supabase
      .from("exam_periods")
      .select("*")
      .eq("school_id", profile.school_id)
      .order("start_date", { ascending: false });

    if (periodErr) {
      tableError = true;
    } else {
      periods = (periodData as ExamPeriod[]) || [];
    }

    // 2. Sınav Kayıtlarını Çek
    if (!tableError) {
      const { data: scheduleData } = await supabase
        .from("exam_schedules")
        .select("*, subjects(name), profiles(full_name)")
        .eq("school_id", profile.school_id)
        .order("exam_date", { ascending: true });

      schedules = (scheduleData as ExamScheduleWithDetails[]) || [];
    }
  } catch {
    tableError = true;
  }

  // 3. Okuldaki Dersleri Çek
  const { data: subjectsData } = await supabase
    .from("subjects")
    .select("*")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const subjects: Subject[] = subjectsData || [];

  // 4. Okuldaki Kademeleri Belirle (classes tablosundan)
  const { data: classesData } = await supabase
    .from("classes")
    .select("grade_level")
    .eq("school_id", profile.school_id);

  let gradeLevels: number[] = [];
  if (classesData && classesData.length > 0) {
    gradeLevels = Array.from(new Set(classesData.map((c: any) => c.grade_level)))
      .filter((gl) => typeof gl === "number" && gl > 0)
      .sort((a, b) => a - b);
  }
  if (gradeLevels.length === 0) {
    gradeLevels = [5, 6, 7, 8]; // Varsayılan ortaokul kademeleri
  }

  // 5. Okul Bilgisi
  const { data: schoolData } = await supabase
    .from("schools")
    .select("name")
    .eq("id", profile.school_id)
    .single();

  const schoolName = schoolData?.name || "Okulumuz";

  // Tablo henüz Supabase'e eklenmemişse nazikçe uyar
  if (tableError) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <h3 className="text-lg font-bold">Ortak Sınav Veritabanı Kurulumu Gerekli</h3>
          </div>
          <p className="text-xs leading-relaxed">
            Ortak Sınav Takvimi tabloları henüz veritabanınızda oluşturulmamış. Lütfen hazırlanan{" "}
            <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded font-bold">
              migration-exam-schedule.sql
            </code>{" "}
            dosyasını Supabase SQL Editor alanında çalıştırınız.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ExamScheduleManager
      initialPeriods={periods}
      initialSchedules={schedules}
      subjects={subjects}
      gradeLevels={gradeLevels}
      schoolName={schoolName}
      role={profile.role}
      userId={user?.id || profile.id}
      schoolId={profile.school_id}
    />
  );
}
