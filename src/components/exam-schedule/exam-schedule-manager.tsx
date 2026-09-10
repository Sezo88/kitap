"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  formatTurkishDate,
  formatDayName,
  formatShortDate,
  getSubjectTheme,
  type ExamScheduleProps,
} from "./types";
import { ExamPeriodDialog } from "./exam-period-dialog";
import { ExamEntryDialog } from "./exam-entry-dialog";
import { ExamPrintView } from "./exam-print-view";
import { ExamWhatsAppModal } from "./exam-whatsapp-modal";
import type { ExamPeriod, ExamScheduleWithDetails } from "@/lib/types/database";
import {
  Calendar,
  CalendarCheck2,
  Clock,
  Plus,
  Settings2,
  Printer,
  Share2,
  Sparkles,
  Lock,
  Unlock,
  AlertCircle,
  GraduationCap,
  BookOpen,
  Filter,
  Pencil,
  Trash2,
  CheckCircle2,
  Info,
} from "lucide-react";

export function ExamScheduleManager({
  initialPeriods,
  initialSchedules,
  subjects,
  gradeLevels,
  schoolName,
  role,
  userId,
  schoolId,
}: ExamScheduleProps) {
  const [periods, setPeriods] = useState<ExamPeriod[]>(initialPeriods);
  const [schedules, setSchedules] = useState<ExamScheduleWithDetails[]>(initialSchedules);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    initialPeriods[0]?.id || ""
  );
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>("ALL");
  const [isPrintView, setIsPrintView] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);

  // Dialog States
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<ExamPeriod | null>(null);

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ExamScheduleWithDetails | null>(null);
  const [defaultGradeForEntry, setDefaultGradeForEntry] = useState<number | undefined>();
  const [defaultDateForEntry, setDefaultDateForEntry] = useState<string | undefined>();

  const [creatingPreset, setCreatingPreset] = useState(false);
  const { toast } = useToast();

  const isAdmin = role === "super_admin" || role === "idareci";

  // Aktif Dönem
  const currentPeriod = useMemo(() => {
    return periods.find((p) => p.id === selectedPeriodId) || periods[0] || null;
  }, [periods, selectedPeriodId]);

  // Seçilebilir Günler
  const allowedDates = useMemo(() => {
    if (!currentPeriod) return [];
    return Array.isArray(currentPeriod.allowed_dates) && currentPeriod.allowed_dates.length > 0
      ? currentPeriod.allowed_dates
      : [];
  }, [currentPeriod]);

  // Aktif dönemin sınav kayıtları
  const currentSchedules = useMemo(() => {
    if (!currentPeriod) return [];
    return schedules.filter((s) => s.period_id === currentPeriod.id);
  }, [schedules, currentPeriod]);

  // 4 Standart Dönemi Otomatik Oluştur (Eğer hiç dönem yoksa idareci için tek tık kolaylık)
  async function handleCreateDefaultPeriods() {
    setCreatingPreset(true);
    const supabase = createClient();
    const defaults = [
      { name: "1. Dönem 1. Ortak Sınavlar", start: "2024-11-04", end: "2024-11-15" },
      { name: "1. Dönem 2. Ortak Sınavlar", start: "2024-12-23", end: "2025-01-03" },
      { name: "2. Dönem 1. Ortak Sınavlar", start: "2025-03-24", end: "2025-04-04" },
      { name: "2. Dönem 2. Ortak Sınavlar", start: "2025-05-26", end: "2025-06-06" },
    ];

    try {
      const inserts = defaults.map((d) => ({
        school_id: schoolId,
        name: d.name,
        academic_year: "2024-2025",
        start_date: d.start,
        end_date: d.end,
        allowed_dates: [],
        max_exams_per_day: 2,
        is_active: true,
        is_published: true,
      }));

      const { data, error } = await supabase.from("exam_periods").insert(inserts).select();
      if (error) throw error;

      toast("4 standart ortak sınav dönemi oluşturuldu!", "success");
      const created = data as ExamPeriod[];
      setPeriods(created);
      setSelectedPeriodId(created[0]?.id || "");
    } catch (err: any) {
      toast(`Oluşturma hatası: ${err.message}`, "error");
    } finally {
      setCreatingPreset(false);
    }
  }

  // Sınav Dönemi Kaydedildiğinde
  function handlePeriodSaved(savedPeriod: ExamPeriod, isDelete?: boolean) {
    if (isDelete) {
      const remaining = periods.filter((p) => p.id !== savedPeriod.id);
      setPeriods(remaining);
      setSelectedPeriodId(remaining[0]?.id || "");
      setSchedules(schedules.filter((s) => s.period_id !== savedPeriod.id));
    } else {
      const index = periods.findIndex((p) => p.id === savedPeriod.id);
      if (index >= 0) {
        const updated = [...periods];
        updated[index] = savedPeriod;
        setPeriods(updated);
      } else {
        setPeriods([savedPeriod, ...periods]);
        setSelectedPeriodId(savedPeriod.id);
      }
    }
  }

  // Sınav Girişi Kaydedildiğinde
  function handleScheduleSaved(saved: ExamScheduleWithDetails, isDelete?: boolean) {
    if (isDelete) {
      setSchedules(schedules.filter((s) => s.id !== saved.id));
    } else {
      const index = schedules.findIndex((s) => s.id === saved.id);
      if (index >= 0) {
        const updated = [...schedules];
        updated[index] = saved;
        setSchedules(updated);
      } else {
        setSchedules([saved, ...schedules]);
      }
    }
  }

  // Hızlı Yeni Sınav Açma
  function handleOpenAddExam(grade?: number, date?: string) {
    setEditingSchedule(null);
    setDefaultGradeForEntry(grade);
    setDefaultDateForEntry(date);
    setEntryDialogOpen(true);
  }

  function handleOpenEditExam(schedule: ExamScheduleWithDetails) {
    setEditingSchedule(schedule);
    setEntryDialogOpen(true);
  }

  // Eğer baskı/veli önizleme modu açıksa onu render et
  if (isPrintView && currentPeriod) {
    return (
      <ExamPrintView
        period={currentPeriod}
        schedules={currentSchedules}
        gradeLevels={gradeLevels}
        schoolName={schoolName}
        onBack={() => setIsPrintView(false)}
        onOpenWhatsApp={() => setWhatsAppModalOpen(true)}
      />
    );
  }

  const displayedGradeLevels =
    selectedGradeFilter === "ALL"
      ? gradeLevels
      : [Number(selectedGradeFilter)];

  return (
    <div className="space-y-6">
      {/* ── Üst Başlık & Kontrol Çubuğu ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-indigo-500/10 flex items-center justify-center text-primary border border-primary/20 shadow-xs">
            <CalendarCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Ortak Sınav Takvimi
              </h2>
              {currentPeriod && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    currentPeriod.is_active
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {currentPeriod.is_active ? (
                    <>
                      <Unlock className="w-3 h-3" /> Seçim Açık
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" /> Seçim Kilitli
                    </>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Yılda 4 kez düzenlenen ortak sınavların zümre öğretmenlerince planlanması ve veli bilgilendirmesi
            </p>
          </div>
        </div>

        {/* Aksiyon Butonları */}
        <div className="flex flex-wrap items-center gap-2">
          {currentPeriod && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWhatsAppModalOpen(true)}
                className="h-9 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                WhatsApp
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPrintView(true)}
                className="h-9 text-xs font-semibold border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Veli Tablosu / PDF
              </Button>

              {(currentPeriod.is_active || isAdmin) && (
                <Button
                  size="sm"
                  onClick={() => handleOpenAddExam()}
                  className="h-9 text-xs font-bold shadow-xs"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Sınav Tarihi Belirle
                </Button>
              )}

              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingPeriod(currentPeriod);
                    setPeriodDialogOpen(true);
                  }}
                  className="h-9 text-xs"
                  title="Dönem Ayarları (Tarihler, Günlük Kota, Aktif/Pasif)"
                >
                  <Settings2 className="w-4 h-4 mr-1.5" />
                  Ayarlar
                </Button>
              )}
            </>
          )}

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingPeriod(null);
                setPeriodDialogOpen(true);
              }}
              className="h-9 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Yeni Dönem
            </Button>
          )}
        </div>
      </div>

      {/* ── Eğer Hiç Sınav Dönemi Yoksa ── */}
      {periods.length === 0 ? (
        <div className="text-center py-16 px-6 bg-white dark:bg-slate-900 rounded-3xl border shadow-xs space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
            <CalendarCheck2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Ortak Sınav Dönemi Tanımlanmamış</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Öğretmenlerin sınav tarihlerini belirleyebilmesi için önce idare tarafından sınav dönemi ve tarih aralığı açılmalıdır.
            </p>
          </div>

          {isAdmin ? (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button
                onClick={handleCreateDefaultPeriods}
                disabled={creatingPreset}
                className="font-bold h-10 w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                {creatingPreset ? "Oluşturuluyor..." : "Yılda 4 Standart Dönemi Başlat"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingPeriod(null);
                  setPeriodDialogOpen(true);
                }}
                className="h-10 w-full sm:w-auto"
              >
                Özel Dönem Oluştur
              </Button>
            </div>
          ) : (
            <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
              Lütfen okul idaresi ile iletişime geçerek sınav döneminin aktif edilmesini talep edin.
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── Dönem Seçim ve Özet Bilgi Kartı ── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Dönem Seçici */}
            <div className="md:col-span-2 p-4 rounded-2xl bg-white dark:bg-slate-900 border shadow-2xs flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Aktif Sınav Dönemi
                </span>
                <span className="text-[11px] font-semibold text-primary">
                  {currentPeriod?.academic_year}
                </span>
              </div>
              <Select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="h-11 font-bold text-sm bg-slate-50 dark:bg-slate-800 border-none"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.is_active ? "(Seçim Açık)" : "(Kilitli)"}
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>
                  {formatTurkishDate(currentPeriod?.start_date || "")} —{" "}
                  {formatTurkishDate(currentPeriod?.end_date || "")}
                </span>
              </div>
            </div>

            {/* İstatistik 1: Planlanan Sınavlar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xl border border-blue-100 dark:border-blue-900/40">
                {currentSchedules.length}
              </div>
              <div>
                <div className="text-xs font-bold text-muted-foreground uppercase">
                  Planlanan Sınav
                </div>
                <div className="text-base font-black text-slate-800 dark:text-slate-100">
                  {currentSchedules.length} Ders Sınavı
                </div>
                <div className="text-[11px] text-slate-500">
                  {gradeLevels.length} Kademede Dağılım
                </div>
              </div>
            </div>

            {/* İstatistik 2: Günlük Kota & Durum */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-xl border border-purple-100 dark:border-purple-900/40">
                {currentPeriod?.max_exams_per_day || 2}
              </div>
              <div>
                <div className="text-xs font-bold text-muted-foreground uppercase">
                  Günlük Limit
                </div>
                <div className="text-base font-black text-slate-800 dark:text-slate-100">
                  Maks. {currentPeriod?.max_exams_per_day || 2} Sınav
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {allowedDates.length} Seçilebilir Gün
                </div>
              </div>
            </div>
          </div>

          {/* ── Kademe Filtresi ve Uyarı ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">Kademe Filtrele:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedGradeFilter("ALL")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    selectedGradeFilter === "ALL"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-white dark:bg-slate-900 text-muted-foreground hover:text-foreground border"
                  }`}
                >
                  Tümü ({gradeLevels.length} Kademe)
                </button>
                {gradeLevels.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGradeFilter(String(g))}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      selectedGradeFilter === String(g)
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-white dark:bg-slate-900 text-muted-foreground hover:text-foreground border"
                    }`}
                  >
                    {g}. Sınıf
                  </button>
                ))}
              </div>
            </div>

            {!currentPeriod.is_active && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 font-medium">
                <Lock className="w-3.5 h-3.5" />
                <span>İdare tarafından tarih seçimi dondurulmuştur.</span>
              </div>
            )}
          </div>

          {/* ── İNTERAKTİF MATRİS TAKVİMİ ── */}
          <div className="overflow-x-auto rounded-3xl border bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-slate-800/80 border-b">
                  <th className="p-4 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider w-36 border-r text-center">
                    Kademe
                  </th>
                  {allowedDates.map((dateStr) => (
                    <th
                      key={dateStr}
                      className="p-3.5 text-center border-r last:border-r-0 min-w-[150px]"
                    >
                      <div className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                        {formatDayName(dateStr)}
                      </div>
                      <div className="text-[10px] font-semibold text-muted-foreground">
                        {dateStr.split("-")[2]} {formatTurkishDate(dateStr).split(" ")[1]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayedGradeLevels.map((grade) => {
                  return (
                    <tr
                      key={grade}
                      className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      {/* Sol Kademe Başlığı */}
                      <td className="p-4 border-r bg-slate-50/50 dark:bg-slate-800/40 text-center align-middle">
                        <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/10 text-primary font-black text-lg shadow-2xs">
                          {grade}
                        </div>
                        <div className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1">
                          {grade}. Sınıflar
                        </div>
                      </td>

                      {/* Tarih Hücreleri */}
                      {allowedDates.map((dateStr) => {
                        const exams = currentSchedules
                          .filter((s) => s.grade_level === grade && s.exam_date === dateStr)
                          .sort((a, b) => (a.lesson_period || 0) - (b.lesson_period || 0));

                        const maxLimit = currentPeriod.max_exams_per_day || 2;
                        const isFull = exams.length >= maxLimit;
                        const canAdd = (currentPeriod.is_active || isAdmin) && !isFull;

                        return (
                          <td
                            key={dateStr}
                            className="p-2 border-r last:border-r-0 align-top group relative"
                          >
                            <div className="space-y-1.5 min-h-[90px] flex flex-col justify-between">
                              {/* Mevcut Sınavlar */}
                              <div className="space-y-1.5">
                                {exams.map((exam) => {
                                  const theme = getSubjectTheme(exam.subjects?.name);
                                  const canEdit =
                                    isAdmin ||
                                    (currentPeriod.is_active && exam.teacher_id === userId);

                                  return (
                                    <div
                                      key={exam.id}
                                      onClick={() => canEdit && handleOpenEditExam(exam)}
                                      className={`p-2 rounded-xl border transition-all ${
                                        theme.badgeBg
                                      } ${theme.badgeBorder} ${
                                        canEdit
                                          ? "cursor-pointer hover:shadow-sm hover:scale-[1.02]"
                                          : ""
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-white/90 dark:bg-black/40 text-slate-700 dark:text-slate-200 shadow-2xs">
                                          {exam.lesson_period}. Ders
                                        </span>
                                        {canEdit && (
                                          <Pencil className="w-2.5 h-2.5 text-muted-foreground hover:text-foreground" />
                                        )}
                                      </div>
                                      <div
                                        className={`text-xs font-black tracking-tight mt-0.5 ${theme.badgeText}`}
                                      >
                                        {exam.subjects?.name}
                                      </div>
                                      {exam.profiles?.full_name && (
                                        <div className="text-[9px] text-muted-foreground truncate mt-0.5">
                                          {exam.profiles.full_name}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Alt Bölüm: Ekleme Butonu veya Doluluk Bildirimi */}
                              <div className="pt-1">
                                {canAdd ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddExam(grade, dateStr)}
                                    className="w-full py-1.5 px-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all text-[10px] font-semibold flex items-center justify-center gap-1 opacity-40 group-hover:opacity-100"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Ekle</span>
                                  </button>
                                ) : isFull ? (
                                  <div className="text-[9px] text-center font-bold text-rose-500/80 bg-rose-50/50 dark:bg-rose-950/20 py-0.5 rounded-md">
                                    Dolu ({maxLimit}/{maxLimit})
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Dialoglar ── */}
      {currentPeriod && (
        <>
          <ExamEntryDialog
            open={entryDialogOpen}
            onOpenChange={setEntryDialogOpen}
            period={currentPeriod}
            existingSchedules={schedules}
            editingSchedule={editingSchedule}
            defaultGrade={defaultGradeForEntry}
            defaultDate={defaultDateForEntry}
            subjects={subjects}
            gradeLevels={gradeLevels}
            schoolId={schoolId}
            userId={userId}
            role={role}
            onSaved={handleScheduleSaved}
          />

          <ExamWhatsAppModal
            open={whatsAppModalOpen}
            onOpenChange={setWhatsAppModalOpen}
            period={currentPeriod}
            schedules={currentSchedules}
            gradeLevels={gradeLevels}
            schoolName={schoolName}
          />
        </>
      )}

      {isAdmin && (
        <ExamPeriodDialog
          open={periodDialogOpen}
          onOpenChange={setPeriodDialogOpen}
          period={editingPeriod}
          schoolId={schoolId}
          onSaved={handlePeriodSaved}
        />
      )}
    </div>
  );
}
