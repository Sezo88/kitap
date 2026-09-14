"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  BarChart3,
  Calendar,
  Sparkles,
  TrendingUp,
  Zap,
  HelpCircle,
  GraduationCap,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface QuizScore {
  class_id: string;
  class_name: string;
  score: number;
  updated_at?: string;
}

interface QuizDaily {
  id: string;
  question_date: string;
  quiz_questions?: {
    question: string;
    answer: string;
    difficulty?: string;
    category?: string;
    option_a?: string;
    option_b?: string;
    option_c?: string;
    option_d?: string;
  };
}

interface QuizAnswer {
  id: string;
  daily_id: string;
  class_id: string;
  answer: string;
  is_correct: boolean;
  seconds_left?: number;
  points_awarded?: number;
  created_at: string;
}

interface ClassItem {
  id: string;
  name: string;
  grade_level?: number | string;
}

interface Props {
  scores: QuizScore[];
  dailyQuestions: QuizDaily[];
  answers: QuizAnswer[];
  classes: ClassItem[];
  schoolName: string;
}

export function QuizReportClient({
  scores,
  dailyQuestions,
  answers,
  classes,
  schoolName,
}: Props) {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "daily" | "class_detail">("leaderboard");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [expandedDailyId, setExpandedDailyId] = useState<string | null>(dailyQuestions[0]?.id || null);

  // Sınıf Bilgisi Haritası
  const classMap = useMemo(() => {
    const map = new Map<string, ClassItem>();
    classes.forEach((c) => map.set(c.id, c));
    return map;
  }, [classes]);

  // Sınıf bazında cevap istatistikleri
  const classStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { totalAnswered: number; correctCount: number; wrongCount: number; timeoutCount: number }
    >();

    classes.forEach((c) => {
      map.set(c.id, { totalAnswered: 0, correctCount: 0, wrongCount: 0, timeoutCount: 0 });
    });

    answers.forEach((ans) => {
      const cur = map.get(ans.class_id) || {
        totalAnswered: 0,
        correctCount: 0,
        wrongCount: 0,
        timeoutCount: 0,
      };
      cur.totalAnswered += 1;
      if (ans.is_correct) {
        cur.correctCount += 1;
      } else if (ans.answer === "SURE_DOLDU") {
        cur.timeoutCount += 1;
      } else {
        cur.wrongCount += 1;
      }
      map.set(ans.class_id, cur);
    });

    return map;
  }, [answers, classes]);

  // Sıralanmış Liderlik Tablosu
  const leaderboard = useMemo(() => {
    // Sınıf puanlarını birleştir (quiz_scores tablosunda olmayan sınıflar da 0 puanla görünsün)
    const scoreMap = new Map<string, number>();
    scores.forEach((s) => scoreMap.set(s.class_id, s.score));

    const list = classes.map((c) => {
      const stats = classStatsMap.get(c.id) || {
        totalAnswered: 0,
        correctCount: 0,
        wrongCount: 0,
        timeoutCount: 0,
      };
      const score = scoreMap.get(c.id) || 0;
      const accuracy = stats.totalAnswered > 0 ? Math.round((stats.correctCount / stats.totalAnswered) * 100) : 0;

      return {
        classId: c.id,
        className: c.name,
        gradeLevel: c.grade_level ? String(c.grade_level) : c.name.charAt(0),
        score,
        ...stats,
        accuracy,
      };
    });

    // Puana göre azalan sırala
    list.sort((a, b) => b.score - a.score || b.accuracy - a.accuracy || a.className.localeCompare(b.className));
    return list;
  }, [classes, scores, classStatsMap]);

  // Filtrelenmiş Liderlik
  const filteredLeaderboard = useMemo(() => {
    return leaderboard.filter((item) => {
      const matchesGrade =
        gradeFilter === "all" ||
        item.gradeLevel === gradeFilter ||
        item.className.startsWith(gradeFilter);

      const matchesSearch =
        !searchQuery.trim() ||
        item.className.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesGrade && matchesSearch;
    });
  }, [leaderboard, gradeFilter, searchQuery]);

  // Genel Özet İstatistikler
  const summary = useMemo(() => {
    const leader = leaderboard[0];
    const totalAnswers = answers.length;
    const totalCorrect = answers.filter((a) => a.is_correct).length;
    const overallAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

    // Aktif katılım sağlayan sınıf sayısı
    const activeClassesCount = new Set(answers.map((a) => a.class_id)).size;

    return {
      leaderName: leader ? leader.className : "—",
      leaderScore: leader ? leader.score : 0,
      totalQuestions: dailyQuestions.length,
      totalAnswers,
      totalCorrect,
      overallAccuracy,
      activeClassesCount,
      totalClasses: classes.length,
    };
  }, [leaderboard, answers, dailyQuestions, classes]);

  // Seçili sınıfın detay karnesi
  const selectedClass = useMemo(() => {
    return leaderboard.find((l) => l.classId === selectedClassId) || leaderboard[0];
  }, [leaderboard, selectedClassId]);

  const selectedClassAnswers = useMemo(() => {
    if (!selectedClass) return [];
    return answers
      .filter((a) => a.class_id === selectedClass.classId)
      .map((ans) => {
        const daily = dailyQuestions.find((d) => d.id === ans.daily_id);
        return {
          ...ans,
          dailyDate: daily?.question_date || "",
          question: daily?.quiz_questions?.question || "Günün Sorusu",
          correctAnswer: daily?.quiz_questions?.answer || "",
          category: daily?.quiz_questions?.category || "Genel Kültür",
          difficulty: daily?.quiz_questions?.difficulty || "Orta",
        };
      })
      .sort((a, b) => b.dailyDate.localeCompare(a.dailyDate));
  }, [answers, dailyQuestions, selectedClass]);

  // Kademeler listesi
  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    classes.forEach((c) => {
      const g = c.grade_level ? String(c.grade_level) : c.name.charAt(0);
      if (g && !isNaN(Number(g))) grades.add(g);
    });
    return Array.from(grades).sort();
  }, [classes]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ── UST GEZINME VE BASLIK ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div>
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Tüm Raporlara Dön</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Günün Sorusu & Yarışma Ligi
              </h1>
              <p className="text-xs text-muted-foreground">
                {schoolName} • Akıllı Tahta Bilgi Yarışması Performans Raporları
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/dashboard/admin/quiz"
            className="px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition flex items-center gap-1.5"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Soru Bankası & Ayarlar</span>
          </Link>
        </div>
      </div>

      {/* ── OZET METRIK KARTLARI (MOBIL UYUMLU) ────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Lider Sınıf */}
        <Card className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border-amber-500/30 shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-500 shrink-0">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Lig Lideri
              </span>
              <div className="text-lg sm:text-xl font-black text-foreground truncate">
                {summary.leaderName}
              </div>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                {summary.leaderScore} Puan
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Okul Başarı Oranı */}
        <Card className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/30 shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-500 shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Başarı Oranı
              </span>
              <div className="text-lg sm:text-xl font-black text-foreground">
                %{summary.overallAccuracy}
              </div>
              <span className="text-xs text-muted-foreground">
                {summary.totalCorrect} / {summary.totalAnswers} Doğru
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Katılım Sağlayan Sınıflar */}
        <Card className="bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border-blue-500/30 shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-500 shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Sınıf Katılımı
              </span>
              <div className="text-lg sm:text-xl font-black text-foreground">
                {summary.activeClassesCount} / {summary.totalClasses}
              </div>
              <span className="text-xs text-muted-foreground">Sınıf Yarıştı</span>
            </div>
          </CardContent>
        </Card>

        {/* Toplam Günlük Soru */}
        <Card className="bg-gradient-to-br from-purple-500/10 via-violet-500/5 to-transparent border-purple-500/30 shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-500 shrink-0">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Sorulan Soru
              </span>
              <div className="text-lg sm:text-xl font-black text-foreground">
                {summary.totalQuestions} Gün
              </div>
              <span className="text-xs text-muted-foreground">Yarışma Günü</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── BUYUK SEKME BUTONLARI (MOBIL DOSTU) ────────────────── */}
      <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-muted/60 border border-border/60">
        <button
          type="button"
          onClick={() => setActiveTab("leaderboard")}
          className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all select-none touch-manipulation ${
            activeTab === "leaderboard"
              ? "bg-card text-foreground shadow-sm border border-border/70"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Lig Sıralaması</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("daily")}
          className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all select-none touch-manipulation ${
            activeTab === "daily"
              ? "bg-card text-foreground shadow-sm border border-border/70"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="h-4 w-4 shrink-0 text-blue-500" />
          <span>Günlük Sorular</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("class_detail")}
          className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all select-none touch-manipulation ${
            activeTab === "class_detail"
              ? "bg-card text-foreground shadow-sm border border-border/70"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>Sınıf Karnesi</span>
        </button>
      </div>

      {/* ── TAB 1: LIDERLIK TABLOSU (LIG SIRALAMASI) ───────────── */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          {/* Filtre ve Arama Barı */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Kademe Filtreleri */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-semibold text-muted-foreground mr-1">Kademe:</span>
              <button
                type="button"
                onClick={() => setGradeFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  gradeFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Tümü
              </button>
              {availableGrades.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setGradeFilter(grade)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    gradeFilter === grade
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {grade}. Sınıflar
                </button>
              ))}
            </div>

            {/* Arama Kutusu */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Sınıf ara (ör: 5/A)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-border text-sm placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Liderlik Listesi (Kart Tasarımı - Telefondan Okuması Çok Kolay) */}
          <div className="space-y-2.5">
            {filteredLeaderboard.length === 0 ? (
              <div className="p-8 text-center bg-card rounded-2xl border border-border text-muted-foreground text-sm">
                Arama kriterine uygun sınıf bulunamadı.
              </div>
            ) : (
              filteredLeaderboard.map((item, idx) => {
                const rank = idx + 1;
                const isTop1 = rank === 1;
                const isTop2 = rank === 2;
                const isTop3 = rank === 3;

                return (
                  <div
                    key={item.classId}
                    onClick={() => {
                      setSelectedClassId(item.classId);
                      setActiveTab("class_detail");
                    }}
                    className={`group cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 active:scale-[0.99] touch-manipulation shadow-sm hover:shadow-md ${
                      isTop1
                        ? "bg-gradient-to-r from-amber-500/15 via-yellow-500/5 to-card border-amber-500/40"
                        : isTop2
                        ? "bg-gradient-to-r from-slate-400/15 via-slate-300/5 to-card border-slate-400/40"
                        : isTop3
                        ? "bg-gradient-to-r from-amber-700/15 via-amber-600/5 to-card border-amber-700/40"
                        : "bg-card hover:bg-accent/40 border-border/70"
                    }`}
                  >
                    {/* Sıralama + Sınıf Adı */}
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      {/* Sıra Rozeti */}
                      <div
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black text-base sm:text-lg shrink-0 shadow-sm ${
                          isTop1
                            ? "bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 ring-2 ring-amber-400/50"
                            : isTop2
                            ? "bg-gradient-to-tr from-slate-300 to-slate-100 text-slate-900 ring-2 ring-slate-300/50"
                            : isTop3
                            ? "bg-gradient-to-tr from-amber-700 to-amber-500 text-white ring-2 ring-amber-600/50"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isTop1 ? "🥇" : isTop2 ? "🥈" : isTop3 ? "🥉" : `#${rank}`}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base sm:text-lg text-foreground truncate group-hover:text-primary transition-colors">
                            {item.className} Sınıfı
                          </h3>
                          <Badge variant="outline" className="text-[10px] hidden xs:inline-flex">
                            {item.gradeLevel}. Kademe
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {item.correctCount} Doğru
                          </span>
                          <span>•</span>
                          <span className="text-red-600 dark:text-red-400">
                            {item.wrongCount + item.timeoutCount} Yanlış
                          </span>
                          <span>•</span>
                          <span>%{item.accuracy} Başarı</span>
                        </div>
                      </div>
                    </div>

                    {/* Puan ve Ok İkonu */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                          {item.score}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                          Toplam Puan
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: GUNLUK SORULAR VE CEVAP DAGILIMI ────────────── */}
      {activeTab === "daily" && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Aşağıda sorulmuş tüm günün soruları ve sınıfların verdiği yanıtlar yer almaktadır. Soru detayını görmek için karta tıklayın:
          </div>

          {dailyQuestions.length === 0 ? (
            <div className="p-8 text-center bg-card rounded-2xl border border-border text-muted-foreground text-sm">
              Henüz soru sorulmamış veya yarışma günü başlamamış.
            </div>
          ) : (
            dailyQuestions.map((daily) => {
              const q = daily.quiz_questions;
              const isExpanded = expandedDailyId === daily.id;
              const dailyAnswers = answers.filter((a) => a.daily_id === daily.id);
              const correctCount = dailyAnswers.filter((a) => a.is_correct).length;
              const totalAnswers = dailyAnswers.length;
              const pct = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;

              return (
                <div
                  key={daily.id}
                  className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm transition"
                >
                  {/* Soru Başlık Kutusu */}
                  <div
                    onClick={() => setExpandedDailyId(isExpanded ? null : daily.id)}
                    className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-muted/40 transition select-none touch-manipulation"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {daily.question_date}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-muted-foreground">
                          {q?.category || "Genel Kültür"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          Zorluk: {q?.difficulty || "Orta"}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                        {q?.question || "Soru metni bulunamadı"}
                      </h3>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Doğru Cevap: <strong className="underline">{q?.answer}</strong>
                        </span>
                        <span>•</span>
                        <span className="text-muted-foreground">
                          Katılım: <strong>{totalAnswers} Sınıf</strong> ({correctCount} Doğru, %{pct})
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-muted text-muted-foreground shrink-0">
                      <ChevronRight
                        className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                    </div>
                  </div>

                  {/* Genişletilmiş Alan: Hangi Sınıf Ne Cevap Verdi? */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-muted/20 border-t border-border/60 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Sınıfların Yanıt Dağılımı ({dailyAnswers.length} Yanıt)
                      </div>

                      {dailyAnswers.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic py-2">
                          Bu soruya henüz hiçbir sınıf cevap vermemiş.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {dailyAnswers.map((ans) => {
                            const cls = classMap.get(ans.class_id);
                            const isTimeout = ans.answer === "SURE_DOLDU";

                            return (
                              <div
                                key={ans.id}
                                className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                                  ans.is_correct
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                    : isTimeout
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                                    : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-foreground truncate">
                                    {cls ? `${cls.name} Sınıfı` : "Bilinmeyen Sınıf"}
                                  </div>
                                  <div className="truncate text-[11px] mt-0.5 opacity-90">
                                    Cevap: {isTimeout ? "Süre Doldu ⏱️" : ans.answer}
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                      ans.is_correct
                                        ? "bg-emerald-500 text-slate-950 font-black"
                                        : "bg-red-500 text-white font-bold"
                                    }`}
                                  >
                                    {ans.is_correct ? `+${ans.points_awarded || 100} Puan` : "0 Puan"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB 3: SINIF KARNESI & GECMIS ──────────────────────── */}
      {activeTab === "class_detail" && selectedClass && (
        <div className="space-y-4">
          {/* Sınıf Seçici Dropdown */}
          <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold">İncelenen Sınıf:</span>
            </div>

            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-4 py-2 rounded-xl bg-muted border border-border text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
            >
              {leaderboard.map((cls, idx) => (
                <option key={cls.classId} value={cls.classId}>
                  #{idx + 1} • {cls.className} Sınıfı ({cls.score} Puan)
                </option>
              ))}
            </select>
          </div>

          {/* Sınıf Performans Özeti */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-card">
              <CardContent className="p-4 text-center">
                <span className="text-xs text-muted-foreground block uppercase font-semibold">
                  Okul Derecesi
                </span>
                <span className="text-2xl font-black text-amber-500">
                  #{leaderboard.findIndex((l) => l.classId === selectedClass.classId) + 1}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4 text-center">
                <span className="text-xs text-muted-foreground block uppercase font-semibold">
                  Toplam Puan
                </span>
                <span className="text-2xl font-black text-foreground">
                  {selectedClass.score}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4 text-center">
                <span className="text-xs text-muted-foreground block uppercase font-semibold">
                  Doğru Cevap
                </span>
                <span className="text-2xl font-black text-emerald-500">
                  {selectedClass.correctCount}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4 text-center">
                <span className="text-xs text-muted-foreground block uppercase font-semibold">
                  Başarı Oranı
                </span>
                <span className="text-2xl font-black text-blue-500">
                  %{selectedClass.accuracy}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Sınıfın Katıldığı Sorular Listesi */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground pt-2">
              {selectedClass.className} Sınıfının Günlük Soru Yanıtları
            </h3>

            {selectedClassAnswers.length === 0 ? (
              <div className="p-8 text-center bg-card rounded-2xl border border-border text-muted-foreground text-sm">
                Bu sınıf henüz hiçbir günün sorusuna yanıt vermemiş.
              </div>
            ) : (
              selectedClassAnswers.map((ans) => {
                const isTimeout = ans.answer === "SURE_DOLDU";

                return (
                  <div
                    key={ans.id}
                    className="p-4 rounded-2xl bg-card border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">
                          {ans.dailyDate}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          {ans.category}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm sm:text-base text-foreground">
                        {ans.question}
                      </h4>

                      <div className="text-xs flex items-center gap-3">
                        <span className="text-muted-foreground">
                          Verilen Cevap:{" "}
                          <strong className={ans.is_correct ? "text-emerald-500" : "text-red-500"}>
                            {isTimeout ? "Süre Bitti (Cevapsız)" : ans.answer}
                          </strong>
                        </span>
                        {!ans.is_correct && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            (Doğrusu: {ans.correctAnswer})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <span
                        className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                          ans.is_correct
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                        }`}
                      >
                        {ans.is_correct ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>+{ans.points_awarded || 100} Puan</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            <span>0 Puan</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
