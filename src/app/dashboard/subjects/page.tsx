import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { SubjectManager } from "@/components/subjects/subject-manager";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function SubjectsPage() {
  const supabase = await createClient();
  const { profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .eq("school_id", profile.school_id)
    .order("name");

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Ders Yönetimi</h2>
      <Card>
        <CardContent className="p-6">
          <SubjectManager
            schoolId={profile.school_id}
            initialSubjects={subjects || []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
