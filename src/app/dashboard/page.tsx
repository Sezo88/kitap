import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, Library, ClipboardCheck } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  if (!profile) return null;

  // Get school code for idareci to share with teachers
  const { data: school } = profile.school_id
    ? await supabase.from("schools").select("code, name").eq("id", profile.school_id).single()
    : { data: null };

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };

  const { count: studentCount } = await supabase.from("students").select("*", { count: "exact", head: true }).match(schoolFilter).eq("is_active", true);
  const { count: classCount } = await supabase.from("classes").select("*", { count: "exact", head: true }).match(schoolFilter);
  const { count: bookCount } = await supabase.from("books").select("*", { count: "exact", head: true }).match(schoolFilter);

  const today = new Date().toISOString().split("T")[0];
  let todayQuery = supabase.from("reading_logs").select("*", { count: "exact", head: true }).eq("log_date", today);
  if (profile.school_id) {
    const { data: schoolClassIds } = await supabase.from("classes").select("id").eq("school_id", profile.school_id);
    const ids = schoolClassIds?.map((c) => c.id) || [];
    if (ids.length > 0) {
      todayQuery = todayQuery.in("class_id", ids);
    }
  }
  const { count: todayCount } = await todayQuery;

  const stats = [
    { label: "Sınıflar", value: classCount || 0, icon: GraduationCap, color: "text-blue-600 bg-blue-100" },
    { label: "Öğrenciler", value: studentCount || 0, icon: Users, color: "text-green-600 bg-green-100" },
    { label: "Kitaplar", value: bookCount || 0, icon: Library, color: "text-purple-600 bg-purple-100" },
    { label: "Bugün İşaretlenen", value: todayCount || 0, icon: ClipboardCheck, color: "text-orange-600 bg-orange-100" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Ana Sayfa</h2>
      {school && (profile.role === "idareci" || profile.role === "super_admin") && (
        <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Okul Kodu (Öğretmenlerle paylaşın)</p>
            <p className="text-2xl font-mono font-bold tracking-widest text-primary">{school.code}</p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>{school.name}</p>
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
