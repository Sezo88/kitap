import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { QuizManager } from "@/components/admin/quiz-manager";
import { TahtaQuizSettingsForm } from "@/components/admin/tahta-quiz-settings-form";
import { getTahtaQuizSettings } from "@/lib/actions/tahta-quiz";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, Monitor } from "lucide-react";

export default async function QuizAdminPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const schoolId = profile.school_id;

  const [questionsRes, dailyRes, schoolRes, tahtaSettings] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    supabase
      .from("quiz_daily")
      .select("question_id")
      .eq("school_id", schoolId),
    supabase
      .from("schools")
      .select("code")
      .eq("id", schoolId)
      .single(),
    getTahtaQuizSettings(schoolId),
  ]);

  const questions = questionsRes.data || [];
  const askedQuestionIds = Array.from(new Set(
    (dailyRes.data || [])
      .map((d: any) => d.question_id)
      .filter(Boolean)
  )) as string[];

  const schoolCode = schoolRes.data?.code || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Günün Sorusu & Akıllı Tahta Yönetimi</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Soru bankasını düzenleyin, Pardus ETA 23 akıllı tahtaların sabah yarışma saatlerini uzaktan yönetin.
          </p>
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="mb-4">
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Akıllı Tahta / Yarışma Ayarları
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Soru Bankası ({questions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <TahtaQuizSettingsForm
            schoolId={schoolId}
            schoolCode={schoolCode}
            initialSettings={tahtaSettings}
          />
        </TabsContent>

        <TabsContent value="questions">
          <QuizManager
            schoolId={schoolId}
            initialQuestions={questions}
            askedQuestionIds={askedQuestionIds}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
