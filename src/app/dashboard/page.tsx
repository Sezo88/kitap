import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, Library, Cake, HelpCircle, Trophy } from "lucide-react";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { TeacherDashboardView } from "@/components/dashboard/teacher-dashboard-view";
import Link from "next/link";

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
  const dayOfWeek = jsDay === 0 ? 7 : jsDay; // 1-7 (1=Pzt, 5=Cuma)

  // Bu haftanın Pazartesi ve Pazar tarihleri (Temiz sınıf ve haftalık hesaplamalar için)
  const d = new Date(now);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const weekMon = monday.toISOString().split("T")[0];

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const weekSun = sunday.toISOString().split("T")[0];

  // ── Öğretmen Dashboard ──────────────────────────────────────
  if (profile.role === "ogretmen") {
    const [
      lessonsRes,
      dutiesRes,
      statsRes,
      cleanScoresRes,
      bellsRes,
      birthdayStudentsRes
    ] = await Promise.all([
      // Öğretmenin tüm haftalık dersleri
      supabase
        .from("lesson_schedule")
        .select("id, day_of_week, period_no, teacher_name, classes(name), subjects(name)")
        .or(`teacher_id.eq.${user!.id},teacher_name.ilike.${profile.full_name}`)
        .order("day_of_week")
        .order("period_no"),

      // Öğretmenin bu haftaki nöbetleri
      supabase
        .from("duty_schedule")
        .select("*")
        .eq("school_id", profile.school_id)
        .or(`teacher_id.eq.${user!.id},teacher_name.ilike.${profile.full_name}`)
        .order("day_of_week"),

      // Öğretmenin kümülatif nöbet istatistiği
      supabase
        .from("duty_stats")
        .select("*")
        .eq("school_id", profile.school_id)
        .or(`teacher_id.eq.${user!.id},teacher_name.ilike.${profile.full_name}`)
        .maybeSingle(),

      // Bu haftanın temiz sınıf puanları
      supabase
        .from("cleanliness_scores")
        .select("score, classes!inner(name, school_id)")
        .eq("classes.school_id", profile.school_id)
        .gte("score_date", weekMon)
        .lte("score_date", weekSun),

      // Okul zil saatleri
      supabase
        .from("bell_schedule")
        .select("period_no, start_time, end_time")
        .eq("school_id", profile.school_id)
        .order("period_no"),

      // Doğum günleri
      supabase
        .from("students")
        .select("full_name, dogum_tarihi, classes(name)")
        .eq("school_id", profile.school_id)
        .eq("is_active", true)
        .not("dogum_tarihi", "is", null)
    ]);

    // Haftanın Temiz Sınıf Lideri hesaplama
    let topCleanClass: { name: string; score: number } | null = null;
    if (cleanScoresRes.data && cleanScoresRes.data.length > 0) {
      const map: Record<string, { total: number; count: number }> = {};
      cleanScoresRes.data.forEach((s: any) => {
        const cn = Array.isArray(s.classes) ? s.classes[0]?.name : s.classes?.name;
        if (!cn) return;
        if (!map[cn]) map[cn] = { total: 0, count: 0 };
        map[cn].total += s.score;
        map[cn].count++;
      });
      const sorted = Object.entries(map)
        .map(([name, val]) => ({ name, score: val.total }))
        .sort((a, b) => b.score - a.score);
      if (sorted.length > 0) {
        topCleanClass = sorted[0];
      }
    }

    // Dersler
    const teacherLessons = (lessonsRes.data || []).map((l: any) => ({
      id: l.id,
      day_of_week: l.day_of_week,
      period_no: l.period_no,
      class_name: Array.isArray(l.classes) ? l.classes[0]?.name : l.classes?.name || "",
      subject_name: Array.isArray(l.subjects) ? l.subjects[0]?.name : l.subjects?.name || "",
    }));

    // Nöbetler
    const teacherDuties = (dutiesRes.data || []).map((d: any) => ({
      id: d.id,
      day_of_week: d.day_of_week,
      location: d.location || d.time_slot || "Belirtilmemiş",
      time_slot: d.time_slot,
      is_extra: d.time_slot === "EK_NOBET" || d.is_extra === true,
    }));

    // Doğum günü filtreleme
    const todayMonth = now.getMonth() + 1;
    const todayDate = now.getDate();
    const birthdays = (birthdayStudentsRes.data || [])
      .filter((s: any) => {
        if (!s.dogum_tarihi) return false;
        const bd = new Date(s.dogum_tarihi);
        return bd.getMonth() + 1 === todayMonth && bd.getDate() === todayDate;
      })
      .map((s: any) => ({
        full_name: s.full_name,
        class_name: Array.isArray(s.classes) ? s.classes[0]?.name : s.classes?.name || "",
      }));

    return (
      <TeacherDashboardView
        teacherName={profile.full_name}
        lessons={teacherLessons}
        duties={teacherDuties}
        dutyStat={statsRes.data || null}
        topCleanClass={topCleanClass}
        bellTimes={bellsRes.data || []}
        birthdays={birthdays}
        todayDayOfWeek={dayOfWeek}
      />
    );
  }

  // ── İdareci / Super Admin Dashboard ─────────────────────────
  const [
    { count: studentCount },
    { count: classCount },
    { count: bookCount },
    schoolClassIdsRes,
    adminCleanScoresRes
  ] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }).match(schoolFilter).eq("is_active", true),
    supabase.from("classes").select("*", { count: "exact", head: true }).match(schoolFilter),
    supabase.from("books").select("*", { count: "exact", head: true }).match(schoolFilter),
    profile.school_id
      ? supabase.from("classes").select("id").eq("school_id", profile.school_id)
      : Promise.resolve({ data: null }),
    supabase
      .from("cleanliness_scores")
      .select("score, classes!inner(name, school_id)")
      .eq("classes.school_id", profile.school_id)
      .gte("score_date", weekMon)
      .lte("score_date", weekSun)
  ]);

  let todayQuery = supabase.from("reading_logs").select("*", { count: "exact", head: true }).eq("log_date", todayStr);
  if (profile.school_id && schoolClassIdsRes.data) {
    const ids = schoolClassIdsRes.data.map((c) => c.id) || [];
    if (ids.length > 0) {
      todayQuery = todayQuery.in("class_id", ids);
    }
  }

  // Bugün doğum günü olanlar
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
    const bd = new Date(s.dogum_tarihi);
    return bd.getMonth() + 1 === todayMonth && bd.getDate() === todayDate;
  });

  // Günün Soruları İstatistikleri
  const qqQuery = supabase
    .from("quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (profile.school_id) qqQuery.eq("school_id", profile.school_id);
  const { count: totalQuestionsCount } = await qqQuery;

  const qdQuery = supabase.from("quiz_daily").select("question_id");
  if (profile.school_id) qdQuery.eq("school_id", profile.school_id);
  const { data: askedQuestionsRes } = await qdQuery;

  const uniqueAskedIds = Array.from(
    new Set((askedQuestionsRes || []).map((item: any) => item.question_id).filter(Boolean))
  );

  let activeAskedCount = 0;
  if (uniqueAskedIds.length > 0) {
    const qCountQuery = supabase
      .from("quiz_questions")
      .select("id")
      .eq("is_active", true)
      .in("id", uniqueAskedIds);
    if (profile.school_id) qCountQuery.eq("school_id", profile.school_id);
    const { data: activeAskedRes } = await qCountQuery;
    activeAskedCount = activeAskedRes?.length || 0;
  }

  const totalQuestions = totalQuestionsCount || 0;
  const remainingQuestions = Math.max(0, totalQuestions - activeAskedCount);

  // İdareci için haftanın temiz sınıf lideri
  let adminTopClean: { name: string; score: number } | null = null;
  if (adminCleanScoresRes.data && adminCleanScoresRes.data.length > 0) {
    const cmap: Record<string, { total: number; count: number }> = {};
    adminCleanScoresRes.data.forEach((s: any) => {
      const cn = Array.isArray(s.classes) ? s.classes[0]?.name : s.classes?.name;
      if (!cn) return;
      if (!cmap[cn]) cmap[cn] = { total: 0, count: 0 };
      cmap[cn].total += s.score;
      cmap[cn].count++;
    });
    const sorted = Object.entries(cmap)
      .map(([name, val]) => ({ name, score: val.total }))
      .sort((a, b) => b.score - a.score);
    if (sorted.length > 0) {
      adminTopClean = sorted[0];
    }
  }

  const stats = [
    { label: "Sınıflar", value: classCount || 0, icon: GraduationCap, color: "text-blue-600 bg-blue-100" },
    { label: "Öğrenciler", value: studentCount || 0, icon: Users, color: "text-green-600 bg-green-100" },
    { label: "Kitaplar", value: bookCount || 0, icon: Library, color: "text-purple-600 bg-purple-100" },
    { label: "Sorulmamış Sorular", value: `${remainingQuestions} / ${totalQuestions}`, icon: HelpCircle, color: remainingQuestions === 0 ? "text-rose-600 bg-rose-100 animate-pulse" : "text-amber-600 bg-amber-100" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-2xl font-bold">Yönetici Ana Sayfa</h2>
        {adminTopClean && (
          <Link
            href="/dashboard/cleanliness"
            className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-500/20 transition-colors"
          >
            <Trophy className="h-4 w-4 text-amber-600" />
            Haftanın Temiz Sınıf Lideri: <strong>{adminTopClean.name}</strong> ({adminTopClean.score} Puan)
          </Link>
        )}
      </div>

      {/* Günün Sorusu Durum Uyarısı */}
      {remainingQuestions === 0 ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded-lg flex flex-col gap-1 text-sm animate-pulse">
          <span className="font-bold flex items-center gap-1">⚠️ Günün Soruları Bitti!</span>
          <span>Soru bankanızdaki tüm aktif sorular soruldu. Lütfen yeni sorular ekleyin. Şu anda mevcut sorular sıfırlanıp tekrar döngüye girecektir.</span>
        </div>
      ) : remainingQuestions <= 5 ? (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg flex flex-col gap-1 text-sm">
          <span className="font-bold flex items-center gap-1">⚠️ Günün Soruları Azalıyor!</span>
          <span>Soru bankanızda sorulmamış son <strong>{remainingQuestions}</strong> adet aktif soru kaldı. Yakında soruların bitmemesi için yeni sorular ekleyebilirsiniz.</span>
        </div>
      ) : null}

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
