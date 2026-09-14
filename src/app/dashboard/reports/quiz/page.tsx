import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { QuizReportClient } from "@/components/reports/quiz-report-client";

export default async function QuizReportsPage() {
  const { profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci" && profile.role !== "ogretmen")) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Bu sayfaya erişim yetkiniz bulunmamaktadır.
      </div>
    );
  }

  let supabase;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    supabase = createAdminClient();
  } catch {
    supabase = await createClient();
  }

  const schoolId = profile.school_id;

  // 1. Okula ait sınıfları getir
  const { data: classesData } = await supabase
    .from("classes")
    .select("id, name, grade_level")
    .eq("school_id", schoolId)
    .neq("is_active", false)
    .order("name", { ascending: true });

  const classes = classesData || [];
  const classIds = classes.map((c) => c.id);

  // 2. quiz_scores tablosundaki sınıf puanlarını getir
  const { data: scoresData } = await supabase
    .from("quiz_scores")
    .select("class_id, class_name, score, updated_at")
    .eq("school_id", schoolId)
    .order("score", { ascending: false });

  const scores = scoresData || [];

  // 3. Okulun geçmiş günün sorularını getir (Son 90 gün)
  const { data: dailyData } = await supabase
    .from("quiz_daily")
    .select("id, question_date, quiz_questions(question, answer, difficulty, category, option_a, option_b, option_c, option_d)")
    .eq("school_id", schoolId)
    .order("question_date", { ascending: false })
    .limit(90);

  const dailyQuestions = (dailyData || []).map((d: any) => ({
    id: d.id,
    question_date: d.question_date,
    quiz_questions: Array.isArray(d.quiz_questions) ? d.quiz_questions[0] : d.quiz_questions,
  }));

  // 4. Okulun sınıflarına ait tüm quiz cevaplarını getir
  let answers: any[] = [];

  if (classIds.length > 0) {
    // Önce tüm kolonlarla dene (answered_at, seconds_left, points_awarded)
    const { data: ansData, error: ansErr } = await supabase
      .from("quiz_answers")
      .select("id, daily_id, class_id, answer, is_correct, seconds_left, points_awarded, answered_at")
      .in("class_id", classIds);

    if (ansErr) {
      // Kolonlardan biri yoksa temel kolonlarla çek (kesinlikle var olan kolonlar)
      const { data: fallbackAns } = await supabase
        .from("quiz_answers")
        .select("id, daily_id, class_id, answer, is_correct")
        .in("class_id", classIds);
      answers = fallbackAns || [];
    } else {
      answers = ansData || [];
    }
  }

  // Okul adını al
  const schoolName = (profile as any)?.schools?.name || "Okulumuz";

  return (
    <QuizReportClient
      scores={scores}
      dailyQuestions={dailyQuestions}
      answers={answers}
      classes={classes}
      schoolName={schoolName}
    />
  );
}
