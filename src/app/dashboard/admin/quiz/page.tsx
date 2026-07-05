import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { QuizManager } from "@/components/admin/quiz-manager";

export default async function QuizAdminPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const [questionsRes, dailyRes] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select("*")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("quiz_daily")
      .select("question_id")
      .eq("school_id", profile.school_id)
  ]);

  const questions = questionsRes.data || [];
  const askedQuestionIds = Array.from(new Set(
    (dailyRes.data || [])
      .map((d: any) => d.question_id)
      .filter(Boolean)
  )) as string[];

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Soru Bankası</h2>
      <QuizManager schoolId={profile.school_id} initialQuestions={questions} askedQuestionIds={askedQuestionIds} />
    </div>
  );
}
