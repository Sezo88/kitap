"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { generateBusinessDays, formatTurkishDate, formatDayName } from "./types";
import type { ExamPeriod } from "@/lib/types/database";
import { Calendar, Settings2, Sparkles, AlertCircle, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: ExamPeriod | null;
  schoolId: string;
  onSaved: (period: ExamPeriod, isDelete?: boolean) => void;
}

const PRESET_NAMES = [
  "1. Dönem 1. Ortak Sınavlar",
  "1. Dönem 2. Ortak Sınavlar",
  "2. Dönem 1. Ortak Sınavlar",
  "2. Dönem 2. Ortak Sınavlar",
];

export function ExamPeriodDialog({ open, onOpenChange, period, schoolId, onSaved }: Props) {
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState("2024-2025");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allowedDates, setAllowedDates] = useState<string[]>([]);
  const [maxExamsPerDay, setMaxExamsPerDay] = useState(2);
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (period) {
      setName(period.name);
      setAcademicYear(period.academic_year || "2024-2025");
      setStartDate(period.start_date || "");
      setEndDate(period.end_date || "");
      setAllowedDates(Array.isArray(period.allowed_dates) && period.allowed_dates.length > 0 
        ? period.allowed_dates 
        : generateBusinessDays(period.start_date, period.end_date));
      setMaxExamsPerDay(period.max_exams_per_day || 2);
      setIsActive(period.is_active ?? true);
      setNotes(period.notes || "");
      setDeleteConfirm(false);
    } else {
      // Varsayılan yeni dönem
      setName(PRESET_NAMES[0]);
      setAcademicYear("2024-2025");
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const twoWeeksLater = new Date(today);
      twoWeeksLater.setDate(today.getDate() + 18);

      const s = nextWeek.toISOString().split("T")[0];
      const e = twoWeeksLater.toISOString().split("T")[0];
      setStartDate(s);
      setEndDate(e);
      setAllowedDates(generateBusinessDays(s, e));
      setMaxExamsPerDay(2);
      setIsActive(true);
      setNotes("Sınavlar ilan edilen ders saatlerinde sınıflarda uygulanacaktır. Tüm öğrencilerimize başarılar dileriz.");
      setDeleteConfirm(false);
    }
  }, [period, open]);

  // Başlangıç ve bitiş değiştikçe varsayılan günleri güncelle
  function handleDateRangeChange(newStart: string, newEnd: string) {
    setStartDate(newStart);
    setEndDate(newEnd);
    if (newStart && newEnd && newStart <= newEnd) {
      setAllowedDates(generateBusinessDays(newStart, newEnd));
    }
  }

  function toggleDate(dateStr: string) {
    if (allowedDates.includes(dateStr)) {
      setAllowedDates(allowedDates.filter((d) => d !== dateStr));
    } else {
      setAllowedDates([...allowedDates, dateStr].sort());
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast("Lütfen sınav dönemi adını girin", "error");
      return;
    }
    if (!startDate || !endDate) {
      toast("Lütfen başlangıç ve bitiş tarihlerini belirleyin", "error");
      return;
    }
    if (startDate > endDate) {
      toast("Başlangıç tarihi bitiş tarihinden sonra olamaz", "error");
      return;
    }
    if (allowedDates.length === 0) {
      toast("Lütfen en az bir seçilebilir sınav tarihi belirleyin", "error");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      const payload = {
        school_id: schoolId,
        name: name.trim(),
        academic_year: academicYear.trim(),
        start_date: startDate,
        end_date: endDate,
        allowed_dates: allowedDates,
        max_exams_per_day: Math.max(1, maxExamsPerDay),
        is_active: isActive,
        is_published: true,
        notes: notes.trim(),
        updated_at: new Date().toISOString(),
      };

      if (period) {
        const { data, error } = await supabase
          .from("exam_periods")
          .update(payload)
          .eq("id", period.id)
          .select()
          .single();

        if (error) throw error;
        toast("Sınav dönemi güncellendi", "success");
        onSaved(data as ExamPeriod);
      } else {
        const { data, error } = await supabase
          .from("exam_periods")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        toast("Yeni sınav dönemi oluşturuldu", "success");
        onSaved(data as ExamPeriod);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast(`Kayıt hatası: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!period) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("exam_periods").delete().eq("id", period.id);
      if (error) throw error;
      toast("Sınav dönemi ve bu döneme ait tüm sınavlar silindi", "success");
      onSaved(period, true);
      onOpenChange(false);
    } catch (err: any) {
      toast(`Silme hatası: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  const allPossibleDays = generateBusinessDays(startDate, endDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {period ? "Sınav Dönemini Düzenle" : "Yeni Ortak Sınav Dönemi Oluştur"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Yılda 4 kez yapılan ortak sınav takvimini, seçilebilir günleri ve günlük kotaları belirleyin.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Hızlı Seçim Butonları */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Sınav Dönemi Şablonu (Yılda 4 Sınav)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESET_NAMES.map((pName) => (
              <Button
                key={pName}
                type="button"
                variant={name === pName ? "default" : "outline"}
                size="sm"
                className="text-xs h-9 justify-center px-2 truncate"
                onClick={() => setName(pName)}
              >
                <Sparkles className="w-3 h-3 mr-1 shrink-0" />
                <span className="truncate">{pName.replace(" Ortak Sınavlar", "")}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* İsim ve Eğitim Yılı */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold">Dönem Adı *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: 1. Dönem 1. Ortak Sınavlar"
              className="h-10 text-sm font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Eğitim Yılı</Label>
            <Input
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2024-2025"
              className="h-10 text-sm"
            />
          </div>
        </div>

        {/* Tarih Aralığı */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-border">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Sınav Başlangıç Tarihi *</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => handleDateRangeChange(e.target.value, endDate)}
              className="h-10 bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Sınav Bitiş Tarihi *</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => handleDateRangeChange(startDate, e.target.value)}
              className="h-10 bg-background"
            />
          </div>
        </div>

        {/* Kotalar ve Aktiflik Durumu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Günlük Maksimum Sınav Sayısı */}
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-bold text-blue-950 dark:text-blue-200">
                  Günlük Sınav Limiti (Sınıf Başına)
                </Label>
                <p className="text-[11px] text-blue-700 dark:text-blue-300">
                  Bir sınıfın (örn. 6/B) 1 günde girebileceği en fazla sınav
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border shadow-sm">
                <button
                  type="button"
                  onClick={() => setMaxExamsPerDay(Math.max(1, maxExamsPerDay - 1))}
                  className="w-6 h-6 flex items-center justify-center font-bold text-base hover:bg-slate-100 rounded"
                >
                  -
                </button>
                <span className="text-base font-black w-6 text-center text-primary">
                  {maxExamsPerDay}
                </span>
                <button
                  type="button"
                  onClick={() => setMaxExamsPerDay(Math.min(5, maxExamsPerDay + 1))}
                  className="w-6 h-6 flex items-center justify-center font-bold text-base hover:bg-slate-100 rounded"
                >
                  +
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              * MEB standartlarında bir sınıf/şube (örn: 6/B, 8/A) günde en fazla 2 sınava girebilir.
            </p>
          </div>

          {/* Tarih Ekleme Aktif / Pasif */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-border flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold">Öğretmen Seçimi</Label>
              <p className="text-[11px] text-muted-foreground">
                {isActive 
                  ? "Aktif (Öğretmenler sınav tarihi seçebilir)" 
                  : "Pasif (Seçim kilitli, sadece izlenebilir)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isActive 
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" 
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}>
                {isActive ? "AKTİF" : "KİLİTLİ"}
              </span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </div>

        {/* Seçilebilir Günler Havuzu */}
        {allPossibleDays.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">
                Seçilebilir Sınav Günleri ({allowedDates.length} Gün Seçili)
              </Label>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[11px] h-7 px-2"
                  onClick={() => setAllowedDates(allPossibleDays)}
                >
                  Tümünü Seç
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[11px] h-7 px-2 text-muted-foreground"
                  onClick={() => setAllowedDates([])}
                >
                  Temizle
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border">
              {allPossibleDays.map((dateStr) => {
                const isSelected = allowedDates.includes(dateStr);
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => toggleDate(dateStr)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs transition-all border ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-sm"
                        : "bg-background border-dashed border-border text-muted-foreground opacity-60 hover:opacity-100"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-semibold">
                      {formatDayName(dateStr)}
                    </span>
                    <span className="text-sm font-black">
                      {dateStr.split("-")[2]} {formatTurkishDate(dateStr).split(" ")[1]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Veli Bilgilendirme Notu */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Veli Bilgilendirme & Takvim Alt Notu</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full text-xs p-3 rounded-lg border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Velilere ve öğrencilere duyurulacak sınav kuralları..."
          />
        </div>

        {/* Silme Onayı veya Butonlar */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border">
          {period ? (
            deleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive font-semibold">Emin misiniz?</span>
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
                  İptal
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
                Bu Dönemi Sil
              </Button>
            )
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 self-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9"
            >
              Kapat
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleSave}
              className="h-9 px-5 font-bold"
            >
              {saving ? "Kaydediliyor..." : period ? "Değişiklikleri Kaydet" : "Dönemi Başlat"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
