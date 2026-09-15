import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, Library, Cake, HelpCircle, Trophy, Sparkles, BookOpen, ClipboardCheck, ArrowRight, ChevronRight, Flame, FolderKanban } from "lucide-react";
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
    adminCleanScoresRes,
    topQuizRes,
    completedBooksRes,
    todayAttendanceRes,
    projectStatsRes
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
      .lte("score_date", weekSun),
    supabase
      .from("quiz_scores")
      .select("class_name, score")
      .match(schoolFilter)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("student_books")
      .select("student_id, students!inner(full_name, classes!inner(name, school_id))")
      .match(profile.school_id ? { "students.classes.school_id": profile.school_id } : {})
      .eq("status", "completed")
      .limit(100),
    supabase
      .from("attendance_logs")
      .select("id, status, class_id, classes!inner(school_id)")
      .match(profile.school_id ? { "classes.school_id": profile.school_id } : {})
      .eq("log_date", todayStr),
    supabase
      .from("student_projects")
      .select("id, subject_id, subjects!inner(name, school_id)")
      .match(profile.school_id ? { "subjects.school_id": profile.school_id } : {})
  ]);

  // Quiz Lideri
  const quizLeader = topQuizRes?.data || null;

  // Okuma Lideri (En çok kitap bitiren öğrenci)
  let topReader: { name: string; className: string; bookCount: number } | null = null;
  if (completedBooksRes?.data && completedBooksRes.data.length > 0) {
    const readerMap: Record<string, { name: string; className: string; bookCount: number }> = {};
    completedBooksRes.data.forEach((b: any) => {
      const sid = b.student_id;
      const sName = b.students?.full_name || "Öğrenci";
      const cName = b.students?.classes?.name || "";
      if (!readerMap[sid]) readerMap[sid] = { name: sName, className: cName, bookCount: 0 };
      readerMap[sid].bookCount++;
    });
    const sortedReaders = Object.values(readerMap).sort((a, b) => b.bookCount - a.bookCount);
    if (sortedReaders.length > 0) topReader = sortedReaders[0];
  }

  // Günlük Yoklama Durumu
  const todayLogs = todayAttendanceRes?.data || [];
  const absentCount = todayLogs.filter((l: any) => l.status === "absent").length;
  const hasAttendanceData = todayLogs.length > 0;

  // Proje Dağılımı
  const projectList = projectStatsRes?.data || [];
  const totalAssignedProjects = projectList.length;
  const subjectCounts: Record<string, number> = {};
  projectList.forEach((p: any) => {
    const sName = p.subjects?.name;
    if (sName) subjectCounts[sName] = (subjectCounts[sName] || 0) + 1;
  });
  const topProjectSubjectEntry = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0];
  const topProjectSubject = topProjectSubjectEntry ? { name: topProjectSubjectEntry[0], count: topProjectSubjectEntry[1] } : null;

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

      {/* ── RAPOR ÖZETLERİ & OKUL LİDERLERİ PANOSU ── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Trophy className="h-5 w-5 text-amber-500" />
            </span>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Rapor Özetleri & Okul Liderleri</h3>
              <p className="text-xs text-muted-foreground">Temizlik, yarışma ligi, okuma ve yoklama verilerinin canlı özetleri</p>
            </div>
          </div>
          <Link
            href="/dashboard/reports"
            className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-all"
          >
            Tüm Raporlar Portalı <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* 1. Temiz Sınıf Lideri */}
          <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-card p-5 transition-all hover:shadow-md hover:border-amber-500/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Temiz Sınıf
                </span>
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 group-hover:scale-110 transition-transform">
                  <Trophy className="h-4 w-4" />
                </span>
              </div>
              {adminTopClean ? (
                <div>
                  <div className="text-2xl font-black tracking-tight text-foreground">{adminTopClean.name}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200">
                      {adminTopClean.score} Puan
                    </span>
                    <span className="text-[11px] text-muted-foreground">Haftalık 1.</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-semibold text-muted-foreground">Bu hafta puan yok</div>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">Denetim bekleniyor</p>
                </div>
              )}
            </div>
            <div className="pt-3 mt-3 border-t border-amber-500/15 flex justify-end">
              <Link
                href="/dashboard/reports/cleanliness"
                className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline inline-flex items-center gap-1"
              >
                Temizlik Raporu <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* 2. Bilgi Yarışması Ligi */}
          <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-card p-5 transition-all hover:shadow-md hover:border-purple-500/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5" /> Quiz / Yarışma
                </span>
                <span className="p-2 rounded-xl bg-purple-500/20 text-purple-700 dark:text-purple-300 group-hover:scale-110 transition-transform">
                  <Trophy className="h-4 w-4" />
                </span>
              </div>
              {quizLeader ? (
                <div>
                  <div className="text-2xl font-black tracking-tight text-foreground">{quizLeader.class_name}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-800 dark:text-purple-200">
                      {quizLeader.score} Puan
                    </span>
                    <span className="text-[11px] text-muted-foreground">Lig Şampiyonu</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-semibold text-muted-foreground">Henüz yarışma skoru yok</div>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">Günün sorusuna katılım bekleniyor</p>
                </div>
              )}
            </div>
            <div className="pt-3 mt-3 border-t border-purple-500/15 flex justify-end">
              <Link
                href="/dashboard/reports/quiz"
                className="text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline inline-flex items-center gap-1"
              >
                Lig Sıralaması <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* 3. Okuma Şampiyonu */}
          <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-card p-5 transition-all hover:shadow-md hover:border-blue-500/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Kitap Kurdu
                </span>
                <span className="p-2 rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-300 group-hover:scale-110 transition-transform">
                  <BookOpen className="h-4 w-4" />
                </span>
              </div>
              {topReader ? (
                <div>
                  <div className="text-lg font-black tracking-tight truncate text-foreground" title={topReader.name}>{topReader.name}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-800 dark:text-blue-200">
                      {topReader.bookCount} Kitap
                    </span>
                    <span className="text-[11px] text-muted-foreground">{topReader.className}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-semibold text-muted-foreground">Dönem Başlangıcı</div>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">Bitirilen kitaplar listelenir</p>
                </div>
              )}
            </div>
            <div className="pt-3 mt-3 border-t border-blue-500/15 flex justify-end">
              <Link
                href="/dashboard/reports/reading"
                className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline inline-flex items-center gap-1"
              >
                Okuma Raporu <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* 4. Günlük Devamsızlık */}
          <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-rose-500/10 via-red-500/5 to-card p-5 transition-all hover:shadow-md hover:border-rose-500/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <ClipboardCheck className="h-3.5 w-3.5" /> Devamsızlık
                </span>
                <span className="p-2 rounded-xl bg-rose-500/20 text-rose-700 dark:text-rose-300 group-hover:scale-110 transition-transform">
                  <Users className="h-4 w-4" />
                </span>
              </div>
              {hasAttendanceData ? (
                <div>
                  <div className="text-2xl font-black tracking-tight text-foreground">
                    {absentCount > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">{absentCount} Öğrenci</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">0 Devamsız</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {absentCount > 0 ? "Bugün okula gelmeyen" : "Bugün herkes okulda"}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-semibold text-muted-foreground">Bugün yoklama yok</div>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">Öğretmen girişi bekleniyor</p>
                </div>
              )}
            </div>
            <div className="pt-3 mt-3 border-t border-rose-500/15 flex justify-end">
              <Link
                href="/dashboard/reports/attendance"
                className="text-xs font-bold text-rose-700 dark:text-rose-300 hover:underline inline-flex items-center gap-1"
              >
                Yoklama Takibi <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* 5. Proje Ödevi Dağılımı */}
          <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-card p-5 transition-all hover:shadow-md hover:border-emerald-500/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <FolderKanban className="h-3.5 w-3.5" /> Proje Dağılımı
                </span>
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 group-hover:scale-110 transition-transform">
                  <FolderKanban className="h-4 w-4" />
                </span>
              </div>
              {totalAssignedProjects > 0 ? (
                <div>
                  <div className="text-2xl font-black tracking-tight text-foreground">{totalAssignedProjects} Proje</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate" title={topProjectSubject ? `En çok: ${topProjectSubject.name} (${topProjectSubject.count})` : ""}>
                    {topProjectSubject ? `En çok: ${topProjectSubject.name}` : "Öğrenci proje atamaları"}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-semibold text-muted-foreground">Henüz proje yok</div>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">Derslerden proje ataması yapın</p>
                </div>
              )}
            </div>
            <div className="pt-3 mt-3 border-t border-emerald-500/15 flex justify-end">
              <Link
                href="/dashboard/projects/list"
                className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1"
              >
                Proje Listesi <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
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
