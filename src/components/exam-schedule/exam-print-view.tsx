"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  formatTurkishDate,
  formatDayName,
  formatShortDate,
  getSubjectTheme,
} from "./types";
import type { ExamPeriod, ExamScheduleWithDetails } from "@/lib/types/database";
import { Printer, ArrowLeft, Calendar, Share2, Sparkles, LayoutGrid, Rows } from "lucide-react";

interface Props {
  period: ExamPeriod;
  schedules: ExamScheduleWithDetails[];
  gradeLevels: number[];
  schoolName: string;
  onBack: () => void;
  onOpenWhatsApp: () => void;
}

export function ExamPrintView({
  period,
  schedules,
  gradeLevels,
  schoolName,
  onBack,
  onOpenWhatsApp,
}: Props) {
  const [viewMode, setViewMode] = useState<"matrix" | "cards">("matrix");

  const dates = useMemo(() => {
    if (Array.isArray(period.allowed_dates) && period.allowed_dates.length > 0) {
      return period.allowed_dates;
    }
    // Eğer allowed_dates boşsa takvimdeki tüm tarihleri topla
    const unique = Array.from(new Set(schedules.map((s) => s.exam_date))).sort();
    return unique;
  }, [period.allowed_dates, schedules]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* ── Üst Kontrol Paneli (Yazdırmada Gizlenir: no-print) ── */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="h-9">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Panele Dön
          </Button>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              Veli Grubu & Baskı Önizleme
            </h3>
            <p className="text-xs text-muted-foreground">
              Standart excel tablosu yerine velilere ve panoya özel modern tasarım
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border">
            <button
              type="button"
              onClick={() => setViewMode("matrix")}
              className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === "matrix"
                  ? "bg-white dark:bg-slate-900 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Tüm Kademeler Matrisi
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === "cards"
                  ? "bg-white dark:bg-slate-900 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
              Sınıf Sınıf Kartlar
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenWhatsApp}
            className="h-9 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            WhatsApp Metni
          </Button>

          <Button size="sm" onClick={handlePrint} className="h-9 font-bold shadow-sm">
            <Printer className="w-4 h-4 mr-1.5" />
            Yazdır / PDF İndir
          </Button>
        </div>
      </div>

      {/* ── YAZDIRMA CSS STİLLERİ ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            color: #0f172a !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 landscape;
            margin: 8mm 8mm 8mm 8mm;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }
          .avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}} />

      {/* ── BASKI & VELİ GÖRÜNÜMÜ ALANI (print-container) ── */}
      <div className="print-container bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-3xl border shadow-md space-y-6 text-slate-900 dark:text-slate-100">
        
        {/* 1. ÜST BAŞLIK (OFFICIAL MEB & SCHOOL BANNER) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 shadow-inner border border-slate-800">
          <div className="relative z-10 flex flex-col items-center text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-[11px] uppercase tracking-widest font-semibold text-slate-200">
              <span>T.C. MİLLÎ EĞİTİM BAKANLIĞI</span>
              <span>•</span>
              <span>{schoolName || "OKUL MÜDÜRLÜĞÜ"}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
              {period.academic_year} EĞİTİM ÖĞRETİM YILI
            </h1>

            <div className="inline-block px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black text-lg sm:text-xl tracking-wide shadow-md">
              {period.name.toLocaleUpperCase("tr-TR")}
            </div>

            <p className="text-xs text-slate-300 font-medium max-w-2xl">
              Sınav Tarih Aralığı: {formatTurkishDate(period.start_date)} — {formatTurkishDate(period.end_date)}
            </p>
          </div>

          {/* Arka plan dekorasyonları */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-indigo-500/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-purple-500/20 blur-2xl pointer-events-none" />
        </div>

        {/* 2. GÖRÜNÜM 1: TÜM KADEMELER MATRİS TABLOSU (PREMIUM GRID) */}
        {viewMode === "matrix" && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-3.5 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider w-32 border-r border-slate-200 dark:border-slate-800 text-center">
                    Sınıf Düzeyi
                  </th>
                  {dates.map((dateStr) => (
                    <th
                      key={dateStr}
                      className="p-3 text-center border-r last:border-r-0 border-slate-200 dark:border-slate-800 min-w-[130px]"
                    >
                      <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                        {formatDayName(dateStr)}
                      </div>
                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        {dateStr.split("-")[2]} {formatTurkishDate(dateStr).split(" ")[1]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {gradeLevels.map((grade) => {
                  return (
                    <tr
                      key={grade}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Sol Kademe Başlığı */}
                      <td className="p-3.5 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-center">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-black text-base shadow-sm">
                          {grade}
                        </div>
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1">
                          {grade}. Sınıflar
                        </div>
                      </td>

                      {/* Günlük Sınav Kartları */}
                      {dates.map((dateStr) => {
                        const exams = schedules
                          .filter(
                            (s) =>
                              s.period_id === period.id &&
                              s.grade_level === grade &&
                              s.exam_date === dateStr
                          )
                          .sort((a, b) => (a.lesson_period || 0) - (b.lesson_period || 0));

                        return (
                          <td
                            key={dateStr}
                            className="p-2 border-r last:border-r-0 border-slate-200 dark:border-slate-800 align-top"
                          >
                            {exams.length > 0 ? (
                              <div className="space-y-1.5">
                                {exams.map((exam) => {
                                  const theme = getSubjectTheme(exam.subjects?.name);
                                  return (
                                    <div
                                      key={exam.id}
                                      className={`p-2 rounded-xl border shadow-xs transition-all ${theme.badgeBg} ${theme.badgeBorder} avoid-break`}
                                    >
                                      <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-white/80 dark:bg-black/40 text-slate-700 dark:text-slate-300 shadow-2xs">
                                          {exam.lesson_period}. Ders
                                        </span>
                                      </div>
                                      <div className={`text-xs font-black tracking-tight leading-tight ${theme.badgeText}`}>
                                        {exam.subjects?.name || "Ders"}
                                      </div>
                                      {exam.notes && (
                                        <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                          {exam.notes}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="h-14 flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-600 font-medium select-none">
                                —
                              </div>
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

        {/* 3. GÖRÜNÜM 2: KADEME KADEME MODERN KARTLAR (VELİ GRUBUNA ÖZEL) */}
        {viewMode === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {gradeLevels.map((grade) => {
              const gradeExams = schedules
                .filter((s) => s.period_id === period.id && s.grade_level === grade)
                .sort((a, b) => a.exam_date.localeCompare(b.exam_date) || a.lesson_period - b.lesson_period);

              return (
                <div
                  key={grade}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm avoid-break"
                >
                  {/* Kart Başlığı */}
                  <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-black text-lg">
                        {grade}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm leading-tight">
                          {grade}. Sınıflar Ortak Sınav Takvimi
                        </h4>
                        <p className="text-[10px] text-slate-300">
                          {gradeExams.length} Sınav Planlandı
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sınav Listesi */}
                  <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800">
                    {gradeExams.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        Bu kademe için henüz sınav tarihi girilmedi.
                      </div>
                    ) : (
                      gradeExams.map((exam) => {
                        const theme = getSubjectTheme(exam.subjects?.name);
                        return (
                          <div
                            key={exam.id}
                            className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                          >
                            <div className="flex items-center gap-3">
                              {/* Tarih Rozeti */}
                              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                                <span className="text-[9px] font-bold uppercase text-slate-500">
                                  {formatShortDate(exam.exam_date).split(" ")[1]}
                                </span>
                                <span className="text-base font-black leading-none text-slate-900 dark:text-slate-100">
                                  {exam.exam_date.split("-")[2]}
                                </span>
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-black tracking-tight ${theme.badgeText}`}>
                                    {exam.subjects?.name}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    {exam.lesson_period}. Ders
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {formatDayName(exam.exam_date)} günü uygulanacaktır.
                                </p>
                              </div>
                            </div>

                            {exam.notes && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border max-w-[120px] truncate">
                                {exam.notes}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. ALT BİLGİLENDİRME & VELİ NOTU KUTUSU */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-amber-950 dark:text-amber-200 text-xs space-y-2 avoid-break">
          <div className="font-bold text-sm flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
            <span>📌</span>
            <span>Önemli Veli ve Öğrenci Bilgilendirmesi</span>
          </div>
          <p className="leading-relaxed">
            {period.notes ||
              "Sınavlar ilan edilen ders saatinde sınıflarda uygulanacaktır. Öğrencilerimizin sınav saatlerinde eksiksiz olarak sınıflarında hazır bulunmaları ve gerekli araç-gereçlerini yanlarında bulundurmaları önemle rica olunur."}
          </p>
        </div>

        {/* 5. RESMÎ İMZA ALANI (YAZDIRILDIĞINDA GÖRÜNÜR) */}
        <div className="pt-6 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 avoid-break">
          <div>
            <div className="font-semibold">{schoolName}</div>
            <div className="text-[11px] text-muted-foreground">Sınav Yürütme Komisyonu</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-slate-800 dark:text-slate-200">UYGUNDUR</div>
            <div className="text-[11px] mt-4 font-semibold">Okul Müdürü</div>
          </div>
        </div>

      </div>
    </div>
  );
}
