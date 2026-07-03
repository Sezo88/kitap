import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, Library, ClipboardCheck, CalendarDays, Shield, Cake } from "lucide-react";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { user, profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolData = (profile as any).schools;
  const school = Array.isArray(schoolData) ? schoolData[0] : schoolData;
  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };

  // Bugünün gün numarası (1=Pazartesi, 5=Cuma)
  const now = new Date(new Date().getTime() + 3 * 3600 * 1000);
  const todayStr = now.toISOString().split("T")[0];
  const jsDay = now.getDay(); // 0=Pazar
  const dayOfWeek = jsDay === 0 ? 7 : jsDay; // 1-7, biz 1-5 kullanıyoruz

  // ── Öğretmen Dashboard ──────────────────────────────────────
  if (profile.role === "ogretmen") {
    const [
      { data: todayLessons },
      { data: todayDuties },
      { data: birthdayStudents }
    ] = await Promise.all([
      // Bugün girdiğim dersler
      dayOfWeek <= 5
        ? supabase
            .from("lesson_schedule")
            .select("*, classes(name), subjects(name)")
            .eq("teacher_id", user!.id)
            .eq("day_of_week", dayOfWeek)
            .order("period_no")
        : Promise.resolve({ data: [] }),
      // Bugün nöbetim var mı?
      dayOfWeek <= 5
        ? supabase
            .from("duty_schedule")
            .select("*")
            .eq("teacher_id", user!.id)
            .eq("day_of_week", dayOfWeek)
        : Promise.resolve({ data: [] }),
      // Bugün doğum günü olan öğrenciler (ay-gün eşleşmesi)
      supabase
        .from("students")
        .select("full_name, dogum_tarihi, classes(name)")
        .eq("school_id", profile.school_id)
        .eq("is_active", true)
        .not("dogum_tarihi", "is", null)
    ]);

    // Doğum günü filtreleme (client-side, çünkü extract SQL'de RPC lazım)
    const todayMonth = now.getMonth() + 1;
    const todayDate = now.getDate();
    const birthdays = (birthdayStudents || []).filter((s: any) => {
      if (!s.dogum_tarihi) return false;
      const d = new Date(s.dogum_tarihi);
      return d.getMonth() + 1 === todayMonth && d.getDate() === todayDate;
    });

    const dayNames = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Hoş geldiniz 👋</h2>
        <p className="text-muted-foreground">Bugün: {dayNames[dayOfWeek] || "Hafta sonu"}, {now.toLocaleDateString("tr-TR")}</p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Bugünün Dersleri */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                Bugünün Dersleri
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!todayLessons || todayLessons.length === 0) ? (
                <p className="text-sm text-muted-foreground py-2">
                  {dayOfWeek > 5 ? "Hafta sonu — ders yok" : "Bugün ders programınız boş"}
                </p>
              ) : (
                <div className="space-y-2">
                  {todayLessons.map((lesson: any) => (
                    <div key={lesson.id} className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2">
                      <span className="text-xs font-mono font-bold text-primary w-6">{lesson.period_no}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lesson.subjects?.name}</p>
                        <p className="text-xs text-muted-foreground">{lesson.classes?.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Nöbet Hatırlatması */}
          <Card className={(todayDuties && todayDuties.length > 0) ? "border-orange-200 bg-orange-50/30" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-orange-600" />
                Nöbet Bilgisi
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!todayDuties || todayDuties.length === 0) ? (
                <p className="text-sm text-muted-foreground py-2">
                  {dayOfWeek > 5 ? "Hafta sonu — nöbet yok" : "Bugün nöbetiniz yok ✓"}
                </p>
              ) : (
                <div className="space-y-2">
                  {todayDuties.map((duty: any) => (
                    <div key={duty.id} className="flex items-center gap-3 bg-orange-100/50 rounded-lg px-3 py-2">
                      <Badge variant="outline" className="text-orange-700 border-orange-300">{duty.time_slot}</Badge>
                      {duty.location && <span className="text-xs text-muted-foreground">📍 {duty.location}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Doğum günleri */}
        {birthdays.length > 0 && (
          <Card className="border-pink-200 bg-pink-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cake className="h-5 w-5 text-pink-600" />
                🎂 Bugün Doğum Günü Olan Öğrenciler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {birthdays.map((s: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-pink-700 border-pink-300">
                    {s.full_name} ({(s.classes as any)?.name})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── İdareci / Super Admin Dashboard ─────────────────────────
  const [
    { count: studentCount },
    { count: classCount },
    { count: bookCount },
    schoolClassIdsRes
  ] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }).match(schoolFilter).eq("is_active", true),
    supabase.from("classes").select("*", { count: "exact", head: true }).match(schoolFilter),
    supabase.from("books").select("*", { count: "exact", head: true }).match(schoolFilter),
    profile.school_id
      ? supabase.from("classes").select("id").eq("school_id", profile.school_id)
      : Promise.resolve({ data: null })
  ]);

  let todayQuery = supabase.from("reading_logs").select("*", { count: "exact", head: true }).eq("log_date", todayStr);
  if (profile.school_id && schoolClassIdsRes.data) {
    const ids = schoolClassIdsRes.data.map((c) => c.id) || [];
    if (ids.length > 0) {
      todayQuery = todayQuery.in("class_id", ids);
    }
  }
  const { count: todayCount } = await todayQuery;

  // Bugün doğum günü olanlar (idareci için de göster)
  const { data: allStudents } = await supabase
    .from("students")
    .select("full_name, dogum_tarihi, classes(name)")
    .eq("school_id", profile.school_id)
    .eq("is_active", true)
    .not("dogum_tarihi", "is", null);

  const todayMonth = now.getMonth() + 1;
  const todayDate = now.getDate();
  const birthdays = (allStudents || []).filter((s: any) => {
    if (!s.dogum_tarihi) return false;
    const d = new Date(s.dogum_tarihi);
    return d.getMonth() + 1 === todayMonth && d.getDate() === todayDate;
  });

  const stats = [
    { label: "Sınıflar", value: classCount || 0, icon: GraduationCap, color: "text-blue-600 bg-blue-100" },
    { label: "Öğrenciler", value: studentCount || 0, icon: Users, color: "text-green-600 bg-green-100" },
    { label: "Kitaplar", value: bookCount || 0, icon: Library, color: "text-purple-600 bg-purple-100" },
    { label: "Bugün İşaretlenen", value: todayCount || 0, icon: ClipboardCheck, color: "text-orange-600 bg-orange-100" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Ana Sayfa</h2>
      {school && (profile.role === "idareci" || profile.role === "super_admin") && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-4">
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

      {/* Doğum günleri */}
      {birthdays.length > 0 && (
        <Card className="border-pink-200 bg-pink-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cake className="h-5 w-5 text-pink-600" />
              🎂 Bugün Doğum Günü Olan Öğrenciler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {birthdays.map((s: any, i: number) => (
                <Badge key={i} variant="outline" className="text-pink-700 border-pink-300">
                  {s.full_name} ({(s.classes as any)?.name})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
