"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Shield,
  Trophy,
  BarChart3,
  Clock,
  Sparkles,
  Cake,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  BookOpen,
  Coffee,
  Calendar,
  Layers,
} from "lucide-react";
import Link from "next/link";

export interface TeacherLesson {
  id: string;
  day_of_week: number;
  period_no: number;
  class_name: string;
  subject_name: string;
}

export interface TeacherDuty {
  id: string;
  day_of_week: number;
  location: string;
  time_slot?: string;
  is_extra?: boolean;
}

export interface TeacherDutyStat {
  total_duties: number;
  extra_duties: number;
  last_duty_date?: string;
}

export interface CleanlinessLeader {
  name: string;
  score: number;
  count?: number;
}

export interface BellTime {
  period_no: number;
  start_time: string;
  end_time: string;
}

interface Props {
  teacherName: string;
  lessons: TeacherLesson[];
  duties: TeacherDuty[];
  dutyStat: TeacherDutyStat | null;
  topCleanClass: CleanlinessLeader | null;
  bellTimes: BellTime[];
  birthdays: { full_name: string; class_name: string }[];
  todayDayOfWeek: number; // 1 = Pazartesi ... 5 = Cuma, 6-7 = Hafta sonu
}

const DAY_NAMES = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

export function TeacherDashboardView({
  teacherName,
  lessons,
  duties,
  dutyStat,
  topCleanClass,
  bellTimes,
  birthdays,
  todayDayOfWeek,
}: Props) {
  // Seçili gün sekmesi: Eğer hafta sonuysa Pazartesi (1), değilse bugünün günü
  const initialDay = todayDayOfWeek >= 1 && todayDayOfWeek <= 5 ? todayDayOfWeek : 1;
  const [selectedDay, setSelectedDay] = useState<number>(initialDay);
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");

  // Bugün nöbeti var mı?
  const todayDuty = useMemo(() => {
    return duties.find((d) => d.day_of_week === todayDayOfWeek);
  }, [duties, todayDayOfWeek]);

  // Seçili günün dersleri (period_no'ya göre sıralı)
  const selectedDayLessons = useMemo(() => {
    return lessons
      .filter((l) => l.day_of_week === selectedDay)
      .sort((a, b) => a.period_no - b.period_no);
  }, [lessons, selectedDay]);

  // Maksimum ders saati (varsayılan 8 veya derslerin en büyüğü)
  const maxPeriod = useMemo(() => {
    if (lessons.length === 0) return 8;
    return Math.max(8, ...lessons.map((l) => l.period_no));
  }, [lessons]);

  // Zil saatleri haritası
  const bellMap = useMemo(() => {
    const map = new Map<number, { start: string; end: string }>();
    bellTimes.forEach((b) => {
      // Saatleri "08:30:00" -> "08:30" formatına getir
      const s = b.start_time.slice(0, 5);
      const e = b.end_time.slice(0, 5);
      map.set(b.period_no, { start: s, end: e });
    });
    return map;
  }, [bellTimes]);

  // Toplam haftalık ders saati
  const weeklyTotalLessons = lessons.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* ── 1. ÜST HOŞ GELDİNİZ VE CANLI DURUM ──────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border rounded-2xl p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl">👋</span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Merhaba, {teacherName}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Bugün: <strong>{DAY_NAMES[todayDayOfWeek] || "Hafta sonu"}</strong> • Haftalık toplam{" "}
            <strong>{weeklyTotalLessons} saat</strong> dersiniz ve <strong>{duties.length} nöbet</strong> göreviniz var.
          </p>
        </div>

        {/* Canlı Nöbet Durumu Rozeti */}
        <div>
          {todayDuty ? (
            <div className="flex items-center gap-2.5 bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2.5 rounded-xl shadow-xs animate-pulse">
              <Shield className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                  Bugün Nöbetçisiniz!
                </p>
                <p className="text-xs sm:text-sm font-bold">
                  📍 {todayDuty.location} {todayDuty.is_extra && "(Çift Nöbet)"}
                </p>
              </div>
            </div>
          ) : todayDayOfWeek >= 1 && todayDayOfWeek <= 5 ? (
            <div className="flex items-center gap-2 bg-muted/60 border text-muted-foreground px-3.5 py-2 rounded-xl text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Bugün nöbetiniz yok</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── 2. ÜÇLÜ HIZLI BİLGİ KARTLARI (ÖZET) ─────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* KART 1: NÖBET GÖREVLERİM */}
        <Card className="border shadow-xs hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600">
                <Shield className="h-4 w-4" />
              </div>
              Nöbet Yerim & Günüm
            </CardTitle>
            <Badge variant="outline" className="text-xs font-normal">
              {duties.length} Nöbet
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 pt-1">
            {duties.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                Bu hafta adınıza tanımlı nöbet görevi bulunmuyor.
              </p>
            ) : (
              <div className="space-y-1.5">
                {duties.map((duty, idx) => {
                  const isToday = duty.day_of_week === todayDayOfWeek;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                        isToday
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-950 dark:text-orange-200 font-medium"
                          : "bg-muted/30 border-border/60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{DAY_NAMES[duty.day_of_week]}:</span>
                        <span className="font-semibold text-primary">📍 {duty.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {duty.is_extra && (
                          <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.2 rounded font-bold">
                            Çift Nöbet
                          </span>
                        )}
                        {isToday && (
                          <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">
                            Bugün
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KART 2: KAÇ NÖBET TUTTUM? (ADALET SAYACI) */}
        <Card className="border shadow-xs hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                <BarChart3 className="h-4 w-4" />
              </div>
              Nöbet İstatistiklerim
            </CardTitle>
            <span className="text-[10px] text-muted-foreground">Kümülatif Takip</span>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-muted/30 border">
                <p className="text-[11px] text-muted-foreground">Bu Haftaki</p>
                <p className="text-lg font-bold text-foreground">{duties.length} Nöbet</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <p className="text-[11px] text-muted-foreground">Toplam Fazla Nöbet</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {dutyStat?.extra_duties ? `+${dutyStat.extra_duties}` : "0"} Defa
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              {dutyStat?.extra_duties && dutyStat.extra_duties > 0
                ? `Bu dönem toplam ${dutyStat.extra_duties} defa fazla nöbet görevi üstlendiniz.`
                : "Nöbet dağıtımınız dengeli şekilde ilerliyor."}
            </p>
          </CardContent>
        </Card>

        {/* KART 3: HAFTANIN TEMİZ SINIF LİDERİ */}
        <Card className="border border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/40 via-background to-transparent shadow-xs hover:shadow-sm transition-shadow sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                <Trophy className="h-4 w-4" />
              </div>
              Haftanın Temiz Sınıfı
            </CardTitle>
            <Badge className="bg-amber-500 text-white font-bold text-[10px]">
              🥇 1. Sıra
            </Badge>
          </CardHeader>
          <CardContent className="pt-1">
            {topCleanClass ? (
              <div className="flex items-center justify-between p-3 bg-background/80 rounded-xl border border-amber-200 dark:border-amber-800">
                <div>
                  <p className="text-lg font-extrabold text-foreground tracking-tight">
                    {topCleanClass.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bu haftanın en yüksek puanlı sınıfı
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-amber-600">
                    {topCleanClass.score}
                  </span>
                  <span className="text-[11px] text-muted-foreground"> Puan</span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Bu hafta için henüz temiz sınıf puanı girilmedi.
              </div>
            )}
            <div className="mt-2 text-right">
              <Link
                href="/dashboard/cleanliness"
                className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                Puanlamayı Görüntüle <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. DERS PROGRAMI BÖLÜMÜ (GÜNLÜK & HAFTALIK) ─────── */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Ders Programım
            </CardTitle>
            <CardDescription className="text-xs">
              Haftalık ve günlük ders programınızı kolayca takip edin.
            </CardDescription>
          </div>

          {/* Görünüm Değiştirici: Günlük / Haftalık Grid */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("daily")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "daily"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Günlük Görünüm
            </button>
            <button
              type="button"
              onClick={() => setViewMode("weekly")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "weekly"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Tüm Hafta Tablosu
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* GÜNLÜK GÖRÜNÜM */}
          {viewMode === "daily" && (
            <div className="space-y-4">
              {/* Gün Seçim Butonları (Pills) */}
              <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b">
                {[1, 2, 3, 4, 5].map((dayNum) => {
                  const isSelected = selectedDay === dayNum;
                  const isToday = todayDayOfWeek === dayNum;
                  const count = lessons.filter((l) => l.day_of_week === dayNum).length;

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => setSelectedDay(dayNum)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
                      }`}
                    >
                      <span>{DAY_NAMES[dayNum]}</span>
                      {isToday && (
                        <span
                          className={`text-[9px] px-1 rounded-sm font-bold ${
                            isSelected ? "bg-white/25 text-white" : "bg-emerald-500 text-white"
                          }`}
                        >
                          Bugün
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isSelected ? "bg-white/20" : "bg-muted-foreground/15"
                        }`}
                      >
                        {count} Ders
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Seçili Günün Ders Kartları */}
              {selectedDayLessons.length === 0 ? (
                <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed">
                  <Coffee className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    {DAY_NAMES[selectedDay]} günü dersiniz bulunmuyor 🎉
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Bu günü serbest çalışma veya hazırlık için kullanabilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedDayLessons.map((lesson) => {
                    const bell = bellMap.get(lesson.period_no);
                    return (
                      <div
                        key={lesson.id}
                        className="bg-card border rounded-xl p-3.5 shadow-xs hover:border-primary/50 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          {/* Ders No ve Saat Rozeti */}
                          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center font-bold shrink-0">
                            <span className="text-sm leading-none">{lesson.period_no}</span>
                            <span className="text-[9px] font-medium text-primary/80">DERS</span>
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">
                              {lesson.subject_name || "Ders"}
                            </p>
                            <p className="text-xs font-semibold text-primary/90 mt-0.5">
                              Sınıf: {lesson.class_name || "Belirtilmemiş"}
                            </p>
                          </div>
                        </div>

                        {/* Saat Aralığı */}
                        {bell && (
                          <div className="text-right shrink-0">
                            <Badge variant="outline" className="text-[10px] font-mono font-medium">
                              {bell.start} - {bell.end}
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TÜM HAFTA TABLOSU (WEEKLY GRID) */}
          {viewMode === "weekly" && (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-xs text-center">
                <thead className="bg-muted/60 font-semibold text-foreground border-b">
                  <tr>
                    <th className="py-2.5 px-3 w-16 text-muted-foreground">Saat</th>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <th
                        key={d}
                        className={`py-2.5 px-3 ${
                          todayDayOfWeek === d ? "bg-primary/10 text-primary font-bold" : ""
                        }`}
                      >
                        {DAY_NAMES[d]}
                        {todayDayOfWeek === d && " (Bugün)"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Array.from({ length: maxPeriod }).map((_, idx) => {
                    const periodNo = idx + 1;
                    const bell = bellMap.get(periodNo);

                    return (
                      <tr key={periodNo} className="hover:bg-muted/20">
                        <td className="py-2.5 px-2 bg-muted/30 font-mono text-muted-foreground border-r font-medium">
                          <div>{periodNo}. Ders</div>
                          {bell && (
                            <div className="text-[9px] opacity-75">{bell.start}</div>
                          )}
                        </td>

                        {[1, 2, 3, 4, 5].map((dayNum) => {
                          const lesson = lessons.find(
                            (l) => l.day_of_week === dayNum && l.period_no === periodNo
                          );

                          return (
                            <td
                              key={dayNum}
                              className={`py-2 px-2 border-r last:border-r-0 ${
                                todayDayOfWeek === dayNum ? "bg-primary/5" : ""
                              }`}
                            >
                              {lesson ? (
                                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 text-left">
                                  <div className="font-bold truncate text-[11px]">
                                    {lesson.subject_name}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground font-semibold">
                                    {lesson.class_name}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/30 text-[10px]">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 4. DOĞUM GÜNLERİ (VARSA) ────────────────────────── */}
      {birthdays.length > 0 && (
        <Card className="border-pink-200/70 bg-gradient-to-r from-pink-50/40 via-background to-transparent shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-pink-700 dark:text-pink-300">
              <Cake className="h-4 w-4 text-pink-600" />
              🎂 Bugün Doğum Günü Olan Öğrenciler ({birthdays.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {birthdays.map((s, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="bg-background text-pink-700 dark:text-pink-300 border-pink-300 text-xs py-1 px-2.5"
                >
                  {s.full_name} • <strong>{s.class_name}</strong>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
