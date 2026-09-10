"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatTurkishDate, formatDayName, getSubjectTheme } from "./types";
import type { ExamPeriod, ExamScheduleWithDetails, Subject } from "@/lib/types/database";
import { Calendar, Clock, BookOpen, GraduationCap, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: ExamPeriod;
  existingSchedules: ExamScheduleWithDetails[];
  editingSchedule: ExamScheduleWithDetails | null;
  defaultGrade?: number;
  defaultDate?: string;
  subjects: Subject[];
  gradeLevels: number[];
  schoolId: string;
  userId: string;
  role: "super_admin" | "idareci" | "ogretmen";
  onSaved: (schedule: ExamScheduleWithDetails, isDelete?: boolean) => void;
}

export function ExamEntryDialog({
  open,
  onOpenChange,
  period,
  existingSchedules,
  editingSchedule,
  defaultGrade,
  defaultDate,
  subjects,
  gradeLevels,
  schoolId,
  userId,
  role,
  onSaved,
}: Props) {
  const [gradeLevel, setGradeLevel] = useState<number | "ALL">(defaultGrade || gradeLevels[0] || 5);
  const [subjectId, setSubjectId] = useState<string>("");
  const [examDate, setExamDate] = useState<string>(defaultDate || "");
  const [lessonPeriod, setLessonPeriod] = useState<number>(2);
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const { toast } = useToast();

  const allowedDates = useMemo(() => {
    return Array.isArray(period.allowed_dates) && period.allowed_dates.length > 0
      ? period.allowed_dates
      : [];
  }, [period.allowed_dates]);

  useEffect(() => {
    if (editingSchedule) {
      setGradeLevel(editingSchedule.grade_level);
      setSubjectId(editingSchedule.subject_id);
      setExamDate(editingSchedule.exam_date);
      setLessonPeriod(editingSchedule.lesson_period || 2);
      setNotes(editingSchedule.notes || "");
      setDeleteConfirm(false);
    } else {
      setGradeLevel(defaultGrade || (gradeLevels.length > 1 ? "ALL" : gradeLevels[0]) || 5);
      setSubjectId(subjects[0]?.id || "");
      setExamDate(defaultDate || allowedDates[0] || "");
      setLessonPeriod(2);
      setNotes("");
      setDeleteConfirm(false);
    }
  }, [editingSchedule, defaultGrade, defaultDate, subjects, allowedDates, gradeLevels, open]);

  // Çakışan kademeleri kontrol et
  const targetGrades = useMemo(() => {
    return gradeLevel === "ALL" ? gradeLevels : [Number(gradeLevel)];
  }, [gradeLevel, gradeLevels]);

  const gradesWithFullDay = useMemo(() => {
    if (!examDate) return [];
    return targetGrades.filter((g) => {
      const count = existingSchedules.filter(
        (s) =>
          s.period_id === period.id &&
          s.grade_level === g &&
          s.exam_date === examDate &&
          s.id !== editingSchedule?.id
      ).length;
      return count >= (period.max_exams_per_day || 2);
    });
  }, [existingSchedules, period.id, period.max_exams_per_day, targetGrades, examDate, editingSchedule]);

  const gradesWithPeriodConflict = useMemo(() => {
    if (!examDate) return [];
    return targetGrades.filter((g) => {
      return existingSchedules.some(
        (s) =>
          s.period_id === period.id &&
          s.grade_level === g &&
          s.exam_date === examDate &&
          s.lesson_period === Number(lessonPeriod) &&
          s.id !== editingSchedule?.id
      );
    });
  }, [existingSchedules, period.id, targetGrades, examDate, lessonPeriod, editingSchedule]);

  const isDayFull = gradesWithFullDay.length > 0;
  const isLessonPeriodConflict = gradesWithPeriodConflict.length > 0;

  async function handleSave() {
    if (!subjectId) {
      toast("Lütfen sınav yapılacak dersi seçin", "error");
      return;
    }
    if (!gradeLevel) {
      toast("Lütfen sınıf kademesini seçin", "error");
      return;
    }
    if (!examDate) {
      toast("Lütfen sınav tarihini seçin", "error");
      return;
    }

    // Kota kontrolü
    if (isDayFull) {
      toast(
        `Bu tarihte ${gradesWithFullDay.join(", ")}. sınıflar için maksimum sınav limitine (${period.max_exams_per_day} sınav) ulaşıldı! Lütfen başka bir gün seçin.`,
        "error"
      );
      return;
    }

    if (isLessonPeriodConflict) {
      toast(
        `Bu tarihte ${gradesWithPeriodConflict.join(", ")}. sınıflar için ${lessonPeriod}. derste zaten başka bir sınav planlanmış!`,
        "error"
      );
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      if (editingSchedule) {
        const payload = {
          school_id: schoolId,
          period_id: period.id,
          grade_level: Number(gradeLevel),
          subject_id: subjectId,
          exam_date: examDate,
          lesson_period: Number(lessonPeriod),
          teacher_id: userId,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("exam_schedules")
          .update(payload)
          .eq("id", editingSchedule.id)
          .select("*, subjects(name), profiles(full_name)")
          .single();

        if (error) throw error;
        toast("Sınav tarihi başarıyla güncellendi", "success");
        onSaved(data as ExamScheduleWithDetails);
      } else if (gradeLevel === "ALL") {
        // Tüm kademeler için toplu kaydet
        let savedCount = 0;
        for (const g of gradeLevels) {
          const payload = {
            school_id: schoolId,
            period_id: period.id,
            grade_level: g,
            subject_id: subjectId,
            exam_date: examDate,
            lesson_period: Number(lessonPeriod),
            teacher_id: userId,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          };

          // Var olan varsa güncelle, yoksa ekle
          const existing = existingSchedules.find(
            (s) => s.period_id === period.id && s.grade_level === g && s.subject_id === subjectId
          );

          if (existing) {
            const { data, error } = await supabase
              .from("exam_schedules")
              .update(payload)
              .eq("id", existing.id)
              .select("*, subjects(name), profiles(full_name)")
              .single();
            if (!error && data) {
              onSaved(data as ExamScheduleWithDetails);
              savedCount++;
            }
          } else {
            const { data, error } = await supabase
              .from("exam_schedules")
              .insert(payload)
              .select("*, subjects(name), profiles(full_name)")
              .single();
            if (!error && data) {
              onSaved(data as ExamScheduleWithDetails);
              savedCount++;
            }
          }
        }
        toast(`Tüm kademeler (${gradeLevels.join(", ")}. Sınıflar) için sınav takvime eklendi (${savedCount} kayıt)`, "success");
      } else {
        const payload = {
          school_id: schoolId,
          period_id: period.id,
          grade_level: Number(gradeLevel),
          subject_id: subjectId,
          exam_date: examDate,
          lesson_period: Number(lessonPeriod),
          teacher_id: userId,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("exam_schedules")
          .insert(payload)
          .select("*, subjects(name), profiles(full_name)")
          .single();

        if (error) {
          if (error.code === "23505") {
            throw new Error("Bu kademe için bu dersin sınavı veya aynı ders saatinde başka bir sınav zaten mevcut!");
          }
          throw error;
        }
        toast("Ortak sınav takvime eklendi", "success");
        onSaved(data as ExamScheduleWithDetails);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast(`İşlem başarısız: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingSchedule) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("exam_schedules").delete().eq("id", editingSchedule.id);
      if (error) throw error;
      toast("Sınav kaydı silindi", "success");
      onSaved(editingSchedule, true);
      onOpenChange(false);
    } catch (err: any) {
      toast(`Silme hatası: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const theme = getSubjectTheme(selectedSubject?.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {editingSchedule ? "Ortak Sınav Tarihini Düzenle" : "Ortak Sınav Tarihi Belirle"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {period.name} — Kademe ve ders için uygun sınav gününü kaydedin.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Seçim Pasif Uyarısı */}
        {!period.is_active && role === "ogretmen" && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              İdare tarafından tarih seçimi kilitlenmiştir. Yalnızca idareciler değişiklik yapabilir.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Kademe Seçimi */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-primary" />
              Sınıf Düzeyi (Kademe) *
            </Label>
            <Select
              value={String(gradeLevel)}
              onChange={(e) => setGradeLevel(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
              disabled={!!editingSchedule}
              className="h-10 font-medium"
            >
              {!editingSchedule && (
                <option value="ALL">
                  🌟 Tüm Kademeler ({gradeLevels.join(", ")}. Sınıflar)
                </option>
              )}
              {gradeLevels.map((gl) => (
                <option key={gl} value={gl}>
                  {gl}. Sınıflar (Tüm Şubeler)
                </option>
              ))}
            </Select>
          </div>

          {/* Ders Seçimi */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              Ders *
            </Label>
            <Select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="h-10 font-medium"
            >
              <option value="" disabled>Ders Seçiniz</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Tarih Seçimi (Görsel Kota Kartları) */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Sınav Tarihi *
            </span>
            <span className="text-[11px] font-normal text-muted-foreground">
              Günlük Kota: Maks. {period.max_exams_per_day} Sınav
            </span>
          </Label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border">
            {allowedDates.map((dateStr) => {
              const targetGradesList = gradeLevel === "ALL" ? gradeLevels : [Number(gradeLevel)];
              const maxCountInGrades = Math.max(
                0,
                ...targetGradesList.map((g) =>
                  existingSchedules.filter(
                    (s) =>
                      s.period_id === period.id &&
                      s.grade_level === g &&
                      s.exam_date === dateStr &&
                      s.id !== editingSchedule?.id
                  ).length
                )
              );
              const isSelected = examDate === dateStr;
              const full = maxCountInGrades >= (period.max_exams_per_day || 2);
              const count = maxCountInGrades;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setExamDate(dateStr)}
                  className={`p-2.5 rounded-xl text-left transition-all border flex flex-col justify-between relative ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                      : full
                      ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-muted-foreground opacity-70"
                      : "bg-background border-border hover:border-primary/50 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {formatDayName(dateStr)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : full
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                      }`}
                    >
                      {count}/{period.max_exams_per_day}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-sm font-black">
                      {dateStr.split("-")[2]} {formatTurkishDate(dateStr).split(" ")[1]}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] truncate">
                    {full ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">Dolu (Maks)</span>
                    ) : (
                      <span className={isSelected ? "text-primary-foreground/90" : "text-emerald-600 dark:text-emerald-400"}>
                        {period.max_exams_per_day - count} Kontenjan
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ders Saati Seçimi & Kota Durumu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Uygulanacak Ders Saati *
            </Label>
            <Select
              value={String(lessonPeriod)}
              onChange={(e) => setLessonPeriod(Number(e.target.value))}
              className="h-10"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((lp) => (
                <option key={lp} value={lp}>
                  {lp}. Ders Saati
                </option>
              ))}
            </Select>
          </div>

          {/* Canlı Durum Bildirimi */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-border flex flex-col justify-center">
            {isDayFull ? (
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Bu tarihte kota doludur! Başka gün seçiniz.</span>
              </div>
            ) : isLessonPeriodConflict ? (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Bu ders saatinde başka bir sınav var!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Tarih ve ders saati uygun.</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              Seçilen Gün: {examDate ? formatTurkishDate(examDate) : "-"} ({lessonPeriod}. Ders)
            </p>
          </div>
        </div>

        {/* Not veya Konu Kapsamı */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Öğretmen / Sınav Notu (Opsiyonel)</Label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Örn: 1. ve 2. ünite konuları dahildir"
            className="w-full text-xs h-9 px-3 rounded-lg border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Butonlar */}
        <div className="pt-2 flex items-center justify-between border-t border-border">
          {editingSchedule ? (
            deleteConfirm ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-destructive font-semibold">Silinsin mi?</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={saving}
                  onClick={handleDelete}
                  className="h-8 text-xs"
                >
                  Evet, Sil
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirm(false)}
                  className="h-8 text-xs"
                >
                  Vazgeç
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirm(true)}
                className="text-destructive hover:bg-destructive/10 text-xs h-9"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Sınavı Kaldır
              </Button>
            )
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9"
            >
              İptal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || isDayFull || isLessonPeriodConflict || (!period.is_active && role === "ogretmen")}
              onClick={handleSave}
              className="h-9 px-5 font-bold"
            >
              {saving ? "Kaydediliyor..." : editingSchedule ? "Güncelle" : "Takvime Kaydet"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
