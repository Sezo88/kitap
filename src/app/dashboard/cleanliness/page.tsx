import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { CleanlinessForm } from "@/components/cleanliness/cleanliness-form";

export default async function CleanlinessPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };
  const today = new Date(new Date().getTime() + 3 * 3600 * 1000).toISOString().split("T")[0];

  const [
    { data: classes },
    { data: criterias }
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .match(schoolFilter)
      .order("name"),
    supabase
      .from("cleanliness_criterias")
      .select("*")
      .match(schoolFilter)
      .order("name")
  ]);

  // Bugün girilen tüm puanları çek
  const classIds = classes?.map((c) => c.id) || [];
  let todayScores: any[] = [];
  if (classIds.length > 0) {
    const { data } = await supabase
      .from("cleanliness_scores")
      .select("*")
      .eq("score_date", today)
      .in("class_id", classIds);
    todayScores = data || [];
  }

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Temiz Sınıf Puanlama</h2>
      <CleanlinessForm
        classes={classes || []}
        criterias={criterias || []}
        todayScores={todayScores}
        userId={profile.id}
      />
    </div>
  );
}
