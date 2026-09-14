"use client";

import { useState, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Save,
  Plus,
  Trash2,
  Shield,
  FileSpreadsheet,
  RotateCw,
  BarChart3,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Upload,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  Download,
  Info,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  parseDutyScheduleExcel,
  rotateDutyLocation,
  type ParseDutyScheduleResult,
} from "@/lib/utils/duty-schedule-parser";

interface Teacher {
  id: string;
  full_name: string;
}

interface DutyEntry {
  id?: string;
  teacher_id?: string | null;
  teacher_name?: string;
  day_of_week: number;
  location: string;
}

export interface DutyStatItem {
  id?: string;
  teacher_name: string;
  teacher_id?: string | null;
  total_duties: number;
  extra_duties: number;
  last_duty_date?: string;
  notes?: string | null;
}

interface Props {
  teachers: Teacher[];
  initialSchedule: any[];
  schoolId: string;
  initialNobetYerleri: string[];
  initialDutyStats?: DutyStatItem[];
}

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

export function DutyScheduleEditor({
  teachers,
  initialSchedule,
  schoolId,
  initialNobetYerleri,
  initialDutyStats = [],
}: Props) {
  // ── State ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"schedule" | "stats">("schedule");
  const [nobetYerleri, setNobetYerleri] = useState<string[]>(
    initialNobetYerleri.length > 0
      ? initialNobetYerleri
      : ["ÖN BAHÇE", "ARKA BAHÇE", "ZEMİN KAT", "1. KAT", "2. KAT"]
  );

  const [entries, setEntries] = useState<DutyEntry[]>(
    initialSchedule.map((d) => ({
      id: d.id,
      teacher_id: d.teacher_id || null,
      teacher_name:
        d.teacher_name ||
        (Array.isArray(d.profiles) ? d.profiles[0]?.full_name : d.profiles?.full_name) ||
        teachers.find((t) => t.id === d.teacher_id)?.full_name ||
        "",
      day_of_week: d.day_of_week,
      location: d.location || "",
    }))
  );

  // Kümülatif İstatistikler (DB + LocalStorage fallback)
  const statsStorageKey = `kitap_duty_stats_${schoolId}`;
  const [dutyStats, setDutyStats] = useState<DutyStatItem[]>(() => {
    if (initialDutyStats && initialDutyStats.length > 0) {
      return initialDutyStats;
    }
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(statsStorageKey);
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });

  const [saving, setSaving] = useState(false);
  const [statsSaving, setStatsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<ParseDutyScheduleResult | null>(null);
  const [importing, setImporting] = useState(false);

  // Rotate Modal
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [rotateWithStats, setRotateWithStats] = useState(true);

  // ── Helper: Öğretmen Eşleştirme ───────────────────────────
  function matchTeacher(name: string): Teacher | null {
    if (!name) return null;
    const clean = (s: string) =>
      s
        .toLowerCase()
        .replace(/[\s\-_.]+/g, "")
        .replace(/i̇/g, "i")
        .replace(/ı/g, "i")
        .replace(/ç/g, "c")
        .replace(/ğ/g, "g")
        .replace(/ö/g, "o")
        .replace(/ş/g, "s")
        .replace(/ü/g, "u");

    const target = clean(name);
    return teachers.find((t) => clean(t.full_name) === target) || null;
  }

  // Bütün bilinen öğretmen seçenekleri (Profilde olanlar + Excel'den gelenler)
  const teacherOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    teachers.forEach((t) => {
      map.set(t.full_name.toLocaleUpperCase("tr-TR"), { id: t.id, name: t.full_name });
    });
    entries.forEach((e) => {
      if (e.teacher_name) {
        const key = e.teacher_name.toLocaleUpperCase("tr-TR");
        if (!map.has(key)) {
          map.set(key, { id: e.teacher_id || "", name: e.teacher_name });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
  }, [teachers, entries]);

  // ── Bu Haftanın Nöbet Sayıları & İstatistikleri ─────────────
  const currentWeekAnalysis = useMemo(() => {
    const teacherMap: Record<
      string,
      { count: number; teacher_id: string | null; assignments: { day: number; location: string }[] }
    > = {};

    entries.forEach((e) => {
      const name =
        e.teacher_name ||
        teachers.find((t) => t.id === e.teacher_id)?.full_name ||
        "İsimsiz Öğretmen";

      if (!teacherMap[name]) {
        teacherMap[name] = {
          count: 0,
          teacher_id: e.teacher_id || null,
          assignments: [],
        };
      }
      teacherMap[name].count++;
      teacherMap[name].assignments.push({ day: e.day_of_week, location: e.location });
    });

    const list = Object.entries(teacherMap).map(([name, data]) => ({
      teacher_name: name,
      teacher_id: data.teacher_id,
      count: data.count,
      extra_duties: Math.max(0, data.count - 1),
      assignments: data.assignments,
    }));

    list.sort((a, b) => b.count - a.count || a.teacher_name.localeCompare(b.teacher_name, "tr-TR"));

    const extraDutyTeachers = list.filter((t) => t.extra_duties > 0);
    const totalExtraDuties = extraDutyTeachers.reduce((acc, t) => acc + t.extra_duties, 0);

    return {
      list,
      totalDuties: entries.length,
      distinctTeachersCount: list.length,
      extraDutyTeachers,
      totalExtraDuties,
    };
  }, [entries, teachers]);

  // ── Manuel Satır Ekleme / Silme / Düzenleme ─────────────────
  function addEntry(dayOfWeek: number) {
    setEntries([
      ...entries,
      {
        teacher_id: "",
        teacher_name: "",
        day_of_week: dayOfWeek,
        location: nobetYerleri[0] || "ÖN BAHÇE",
      },
    ]);
  }

  function removeEntry(idx: number) {
    setEntries(entries.filter((_, i) => i !== idx));
  }

  function updateEntry(idx: number, patch: Partial<DutyEntry>) {
    setEntries(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function getEntriesForDay(day: number) {
    return entries
      .map((e, idx) => ({ ...e, _idx: idx }))
      .filter((e) => e.day_of_week === day);
  }

  // ── Tümünü Kaydet (Veritabanına) ───────────────────────────
  async function handleSave() {
    const invalid = entries.some((e) => (!e.teacher_id && !e.teacher_name) || !e.location);
    if (invalid) {
      toast("Lütfen tüm nöbet satırlarında öğretmen ve nöbet yeri seçin.", "error");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      // 1. Önce eski nöbetleri sil
      await supabase.from("duty_schedule").delete().eq("school_id", schoolId);

      // 2. Yeni nöbetleri ekle
      if (entries.length > 0) {
        const insertData = entries.map((e) => {
          const matched = e.teacher_name ? matchTeacher(e.teacher_name) : null;
          return {
            school_id: schoolId,
            teacher_id: e.teacher_id || matched?.id || null,
            teacher_name:
              e.teacher_name ||
              teachers.find((t) => t.id === e.teacher_id)?.full_name ||
              "",
            day_of_week: e.day_of_week,
            time_slot: e.location,
            location: e.location,
          };
        });

        const { error } = await supabase.from("duty_schedule").insert(insertData);
        if (error) throw error;
      }

      // 3. Nöbet yerlerini panel_config tablosuna kaydet
      if (nobetYerleri.length > 0) {
        const placesStr = nobetYerleri.join(", ");
        await supabase
          .from("panel_config")
          .update({ nobet_yerleri: placesStr })
          .eq("school_id", schoolId);
      }

      toast("Nöbet programı başarıyla kaydedildi.", "success");
    } catch (err: any) {
      toast("Kaydetme hatası: " + (err.message || err), "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Excel Dosyası Seçme ve Önizleme ─────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const result = parseDutyScheduleExcel(buffer);
      setImportResult(result);
      setShowImportModal(true);
    } catch (err: any) {
      toast("Excel okunamadı: " + (err.message || err), "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Excel Verisini Uygula ve Kaydet ─────────────────────────
  async function handleApplyExcel() {
    if (!importResult) return;
    setImporting(true);
    const supabase = createClient();

    try {
      const newPlaces = importResult.places;
      const parsedEntries = importResult.entries;

      // entries formatına dönüştür ve öğretmenleri eşle
      const newDutyEntries: DutyEntry[] = parsedEntries.map((pe) => {
        const matched = matchTeacher(pe.teacher_name);
        return {
          teacher_id: matched ? matched.id : null,
          teacher_name: pe.teacher_name,
          day_of_week: pe.day_of_week,
          location: pe.location,
        };
      });

      // Veritabanındaki eski nöbetleri temizle ve yenilerini kaydet
      await supabase.from("duty_schedule").delete().eq("school_id", schoolId);

      const insertData = newDutyEntries.map((e) => ({
        school_id: schoolId,
        teacher_id: e.teacher_id,
        teacher_name: e.teacher_name,
        day_of_week: e.day_of_week,
        time_slot: e.location,
        location: e.location,
      }));

      const { error: insErr } = await supabase.from("duty_schedule").insert(insertData);
      if (insErr) throw insErr;

      // Nöbet yerlerini de A sütunundan alınanlarla güncelle
      await supabase
        .from("panel_config")
        .update({ nobet_yerleri: newPlaces.join(", ") })
        .eq("school_id", schoolId);

      // State'leri güncelle
      setNobetYerleri(newPlaces);
      setEntries(newDutyEntries);
      setShowImportModal(false);

      toast(
        `Excel'den ${insertData.length} nöbet kaydı ve ${newPlaces.length} nöbet yeri başarıyla yüklendi!`,
        "success"
      );
    } catch (err: any) {
      toast("Excel aktarımı kaydedilemedi: " + (err.message || err), "error");
    } finally {
      setImporting(false);
    }
  }

  // ── Nöbet Döndürme (Rotasyon) ────────────────────────────────
  async function handleRotateSchedule() {
    setSaving(true);
    const supabase = createClient();

    try {
      // 1. Yeni döndürülmüş nöbet yerlerini hesapla
      const rotatedEntries: DutyEntry[] = entries.map((e) => ({
        ...e,
        location: rotateDutyLocation(e.location, nobetYerleri),
      }));

      // 2. İstatistik sayacını güncelle (eğer seçiliyse)
      if (rotateWithStats) {
        await addCurrentWeekToStatsInternal(currentWeekAnalysis.list);
      }

      // 3. Veritabanına kaydet
      await supabase.from("duty_schedule").delete().eq("school_id", schoolId);

      const insertData = rotatedEntries.map((e) => {
        const matched = e.teacher_name ? matchTeacher(e.teacher_name) : null;
        return {
          school_id: schoolId,
          teacher_id: e.teacher_id || matched?.id || null,
          teacher_name:
            e.teacher_name ||
            teachers.find((t) => t.id === e.teacher_id)?.full_name ||
            "",
          day_of_week: e.day_of_week,
          time_slot: e.location,
          location: e.location,
        };
      });

      const { error } = await supabase.from("duty_schedule").insert(insertData);
      if (error) throw error;

      setEntries(rotatedEntries);
      setShowRotateModal(false);

      toast(
        "Nöbetler bir sonraki haftaya başarıyla döndürüldü ve kaydedildi (Ön Bahçe ➔ Arka Bahçe ➔ Zemin ➔ 1. Kat ➔ 2. Kat ➔ Ön Bahçe).",
        "success"
      );
    } catch (err: any) {
      toast("Döndürme sırasında hata oluştu: " + (err.message || err), "error");
    } finally {
      setSaving(false);
    }
  }

  // ── İstatistik Sayacını Güncelleme ─────────────────────────
  async function addCurrentWeekToStatsInternal(
    weekList: typeof currentWeekAnalysis.list
  ) {
    const updatedStatsMap = new Map<string, DutyStatItem>();

    // Mevcut istatistikleri haritaya al
    dutyStats.forEach((st) => {
      updatedStatsMap.set(st.teacher_name.toLocaleUpperCase("tr-TR"), { ...st });
    });

    // Bu haftayı ekle
    weekList.forEach((w) => {
      const key = w.teacher_name.toLocaleUpperCase("tr-TR");
      const existing = updatedStatsMap.get(key);
      if (existing) {
        existing.total_duties += w.count;
        existing.extra_duties += w.extra_duties;
        existing.last_duty_date = new Date().toISOString();
        if (w.teacher_id && !existing.teacher_id) existing.teacher_id = w.teacher_id;
      } else {
        updatedStatsMap.set(key, {
          teacher_name: w.teacher_name,
          teacher_id: w.teacher_id,
          total_duties: w.count,
          extra_duties: w.extra_duties,
          last_duty_date: new Date().toISOString(),
        });
      }
    });

    const newStatsList = Array.from(updatedStatsMap.values()).sort(
      (a, b) => b.extra_duties - a.extra_duties || b.total_duties - a.total_duties
    );

    // Local storage & State
    setDutyStats(newStatsList);
    try {
      localStorage.setItem(statsStorageKey, JSON.stringify(newStatsList));
    } catch (e) {}

    // Supabase duty_stats tablosuna kaydet
    const supabase = createClient();
    try {
      for (const item of newStatsList) {
        await supabase
          .from("duty_stats")
          .upsert(
            {
              school_id: schoolId,
              teacher_name: item.teacher_name,
              teacher_id: item.teacher_id || null,
              total_duties: item.total_duties,
              extra_duties: item.extra_duties,
              last_duty_date: item.last_duty_date,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "school_id,teacher_name" }
          );
      }
    } catch (err) {
      console.warn("duty_stats tablosuna kaydedilemedi (migration gerekebilir):", err);
    }
  }

  async function handleAddCurrentWeekToStats() {
    if (entries.length === 0) {
      toast("Aktif nöbet çizelgesinde henüz kayıt bulunmuyor.", "info");
      return;
    }
    setStatsSaving(true);
    try {
      await addCurrentWeekToStatsInternal(currentWeekAnalysis.list);
      toast("Bu haftanın nöbetleri ve fazla nöbetler başarıyla istatistik sayacına eklendi!", "success");
    } catch (err: any) {
      toast("Hata: " + (err.message || err), "error");
    } finally {
      setStatsSaving(false);
    }
  }

  // ── Hızlı Sayaç Değiştirme (+1 / -1) ───────────────────────
  async function adjustExtraDuty(teacherName: string, delta: number) {
    const updated = dutyStats.map((item) => {
      if (item.teacher_name === teacherName) {
        const nextExtra = Math.max(0, item.extra_duties + delta);
        const nextTotal = Math.max(0, item.total_duties + delta);
        return { ...item, extra_duties: nextExtra, total_duties: nextTotal };
      }
      return item;
    });

    // Eğer listede yoksa ekle
    if (!updated.some((item) => item.teacher_name === teacherName)) {
      const matched = matchTeacher(teacherName);
      updated.push({
        teacher_name: teacherName,
        teacher_id: matched ? matched.id : null,
        total_duties: Math.max(0, delta),
        extra_duties: Math.max(0, delta),
        last_duty_date: new Date().toISOString(),
      });
    }

    updated.sort((a, b) => b.extra_duties - a.extra_duties || b.total_duties - a.total_duties);
    setDutyStats(updated);

    try {
      localStorage.setItem(statsStorageKey, JSON.stringify(updated));
    } catch (e) {}

    const supabase = createClient();
    const target = updated.find((i) => i.teacher_name === teacherName);
    if (target) {
      try {
        await supabase
          .from("duty_stats")
          .upsert(
            {
              school_id: schoolId,
              teacher_name: target.teacher_name,
              teacher_id: target.teacher_id || null,
              total_duties: target.total_duties,
              extra_duties: target.extra_duties,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "school_id,teacher_name" }
          );
      } catch (err) {
        console.warn("duty_stats güncellenemedi:", err);
      }
    }
  }

  // ── İstatistikleri Sıfırlama ───────────────────────────────
  async function handleResetStats() {
    if (!confirm("Tüm kümülatif nöbet ve fazla nöbet istatistiklerini sıfırlamak istediğinize emin misiniz?")) {
      return;
    }

    setDutyStats([]);
    try {
      localStorage.removeItem(statsStorageKey);
    } catch (e) {}

    const supabase = createClient();
    try {
      await supabase.from("duty_stats").delete().eq("school_id", schoolId);
    } catch (e) {}

    toast("Nöbet istatistikleri sıfırlandı.", "info");
  }

  // ── Excel Raporu İndir ─────────────────────────────────────
  function handleDownloadStatsExcel() {
    const data = combinedTeacherStats.map((t, idx) => ({
      "Sıra No": idx + 1,
      "Öğretmen Adı": t.teacher_name,
      "Bu Haftaki Nöbet Sayısı": t.week_count,
      "Bu Haftaki Nöbet Yerleri": t.week_assignments
        .map((a) => `${DAY_NAMES[a.day - 1]}: ${a.location}`)
        .join(", ") || "Yok",
      "Bu Hafta Fazla Nöbet": t.week_extra > 0 ? `${t.week_extra} Fazla` : "Normal",
      "Toplam Tutulan Nöbet": t.total_duties,
      "Toplam Fazla Nöbet Sayacı": t.extra_duties,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nöbet İstatistikleri");
    XLSX.writeFile(wb, `nobet_istatistikleri_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  // ── Kümülatif & Haftalık Birleşik Liste ─────────────────────
  const combinedTeacherStats = useMemo(() => {
    const map = new Map<
      string,
      {
        teacher_name: string;
        teacher_id: string | null;
        week_count: number;
        week_extra: number;
        week_assignments: { day: number; location: string }[];
        total_duties: number;
        extra_duties: number;
      }
    >();

    // 1. Önce aktif haftadaki öğretmenleri ekle
    currentWeekAnalysis.list.forEach((w) => {
      const key = w.teacher_name.toLocaleUpperCase("tr-TR");
      map.set(key, {
        teacher_name: w.teacher_name,
        teacher_id: w.teacher_id,
        week_count: w.count,
        week_extra: w.extra_duties,
        week_assignments: w.assignments,
        total_duties: w.count,
        extra_duties: w.extra_duties,
      });
    });

    // 2. Kümülatif istatistikleri birleştir
    dutyStats.forEach((st) => {
      const key = st.teacher_name.toLocaleUpperCase("tr-TR");
      const existing = map.get(key);
      if (existing) {
        existing.total_duties = Math.max(existing.total_duties, st.total_duties);
        existing.extra_duties = Math.max(existing.extra_duties, st.extra_duties);
      } else {
        map.set(key, {
          teacher_name: st.teacher_name,
          teacher_id: st.teacher_id || null,
          week_count: 0,
          week_extra: 0,
          week_assignments: [],
          total_duties: st.total_duties,
          extra_duties: st.extra_duties,
        });
      }
    });

    // 3. Okulun kayıtlı diğer öğretmenlerini de ekle
    teachers.forEach((t) => {
      const key = t.full_name.toLocaleUpperCase("tr-TR");
      if (!map.has(key)) {
        map.set(key, {
          teacher_name: t.full_name,
          teacher_id: t.id,
          week_count: 0,
          week_extra: 0,
          week_assignments: [],
          total_duties: 0,
          extra_duties: 0,
        });
      }
    });

    let res = Array.from(map.values());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      res = res.filter((t) => t.teacher_name.toLowerCase().includes(q));
    }

    return res.sort(
      (a, b) =>
        b.extra_duties - a.extra_duties ||
        b.week_count - a.week_count ||
        b.total_duties - a.total_duties ||
        a.teacher_name.localeCompare(b.teacher_name, "tr-TR")
    );
  }, [currentWeekAnalysis, dutyStats, teachers, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── ÜST ARAÇ ÇUBUĞU (ACTION BAR) ────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border rounded-xl p-4 shadow-sm">
        {/* Sol: Tab Butonları */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab("schedule")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "schedule"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-4 w-4" />
            Haftalık Çizelge ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stats")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "stats"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Fazla Nöbet & İstatistikler
            {currentWeekAnalysis.totalExtraDuties > 0 && (
              <span className="bg-amber-500 text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold">
                {currentWeekAnalysis.totalExtraDuties} Fazla
              </span>
            )}
          </button>
        </div>

        {/* Sağ: Aksiyon Butonları */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Gizli Dosya Seçici */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx,.xls"
            className="hidden"
          />

          {/* Excel'den Yükle Butonu */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
            Excel'den Yükle
          </Button>

          {/* Nöbet Döndür Butonu */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowRotateModal(true)}
            className="border-indigo-600/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
          >
            <RotateCw className="h-4 w-4 mr-1.5 text-indigo-600 animate-spin-reverse" />
            Nöbet Döndür (Sonraki Hafta)
          </Button>

          {/* Tümünü Kaydet */}
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground shadow"
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Kaydediliyor..." : "Tümünü Kaydet"}
          </Button>
        </div>
      </div>

      {/* ── NÖBET YERLERİ ROZETLERİ ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-xs bg-muted/40 p-3 rounded-lg border">
        <span className="font-semibold text-muted-foreground flex items-center gap-1">
          <Shield className="h-3.5 w-3.5 text-primary" />
          Aktif Nöbet Yerleri ({nobetYerleri.length}):
        </span>
        {nobetYerleri.map((loc, i) => (
          <Badge key={i} variant="secondary" className="font-medium">
            {loc}
          </Badge>
        ))}
      </div>

      {/* ── TAB 1: HAFTALIK ÇİZELGE GÖRÜNÜMÜ ────────────────── */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          {/* Fazla Nöbet Uyarısı (Eğer varsa) */}
          {currentWeekAnalysis.extraDutyTeachers.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">
                  Bu hafta {currentWeekAnalysis.extraDutyTeachers.length} öğretmen fazla nöbet tutmaktadır:
                </span>{" "}
                {currentWeekAnalysis.extraDutyTeachers.map((t, idx) => (
                  <span key={idx} className="inline-block mr-2">
                    <strong>{t.teacher_name}</strong> ({t.count} nöbet -{" "}
                    <span className="text-amber-700 dark:text-amber-300">
                      +{t.extra_duties} fazla
                    </span>
                    )
                    {idx < currentWeekAnalysis.extraDutyTeachers.length - 1 ? "," : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 5 Gün Kolonları */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {DAY_NAMES.map((dayName, dayIdx) => {
              const dayNum = dayIdx + 1;
              const dayEntries = getEntriesForDay(dayNum);

              return (
                <Card key={dayIdx} className="flex flex-col shadow-sm border">
                  <CardHeader className="py-3 px-3.5 bg-muted/30 border-b flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-primary" />
                      {dayName}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                        {dayEntries.length} Nöbetçi
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => addEntry(dayNum)}
                        title="Yeni Nöbetçi Ekle"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-2.5 flex-1 space-y-2 overflow-y-auto max-h-[600px]">
                    {dayEntries.length === 0 && (
                      <div className="text-center py-8 text-xs text-muted-foreground">
                        Nöbetçi eklenmemiş
                      </div>
                    )}

                    {dayEntries.map((entry) => {
                      // Bu öğretmenin bu hafta başka nöbeti var mı kontrolü
                      const teacherName =
                        entry.teacher_name ||
                        teachers.find((t) => t.id === entry.teacher_id)?.full_name;
                      const hasMultipleDuties =
                        teacherName &&
                        (currentWeekAnalysis.list.find((t) => t.teacher_name === teacherName)
                          ?.count || 0) > 1;

                      return (
                        <div
                          key={entry._idx}
                          className={`flex flex-col gap-1.5 rounded-lg p-2 text-xs border transition-colors ${
                            hasMultipleDuties
                              ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/40"
                              : "bg-background border-border/70"
                          }`}
                        >
                          {/* Öğretmen Seçimi */}
                          <div className="flex items-center gap-1">
                            <select
                              className="text-xs font-medium border rounded px-1.5 py-1 bg-background w-full focus:ring-1 focus:ring-primary truncate"
                              value={
                                entry.teacher_id ||
                                entry.teacher_name ||
                                ""
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                const matched = teachers.find((t) => t.id === val);
                                if (matched) {
                                  updateEntry(entry._idx, {
                                    teacher_id: matched.id,
                                    teacher_name: matched.full_name,
                                  });
                                } else {
                                  const opt = teacherOptions.find((o) => o.name === val || o.id === val);
                                  updateEntry(entry._idx, {
                                    teacher_id: opt?.id || null,
                                    teacher_name: opt?.name || val,
                                  });
                                }
                              }}
                            >
                              <option value="">Öğretmen Seçin</option>
                              {teacherOptions.map((opt, i) => (
                                <option key={i} value={opt.id || opt.name}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>

                            {hasMultipleDuties && (
                              <span
                                title="Bu öğretmen bu hafta 1'den fazla nöbet tutmaktadır"
                                className="bg-amber-500 text-white rounded px-1 py-0.5 text-[9px] font-bold shrink-0"
                              >
                                2x
                              </span>
                            )}
                          </div>

                          {/* Nöbet Yeri ve Sil Butonu */}
                          <div className="flex items-center gap-1.5">
                            <select
                              className="text-xs border rounded px-1.5 py-1 bg-background flex-1 focus:ring-1 focus:ring-primary truncate"
                              value={entry.location}
                              onChange={(e) => updateEntry(entry._idx, { location: e.target.value })}
                            >
                              {nobetYerleri.map((loc, i) => (
                                <option key={i} value={loc}>
                                  {loc}
                                </option>
                              ))}
                              {!nobetYerleri.includes(entry.location) && entry.location && (
                                <option value={entry.location}>{entry.location}</option>
                              )}
                            </select>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeEntry(entry._idx)}
                              title="Sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: FAZLA NÖBET & İSTATİSTİKLER ───────────────── */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {/* İstatistik Özet Kartları */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Haftalık Nöbet Yeri / Görevi</p>
                  <p className="text-xl font-bold">{currentWeekAnalysis.totalDuties}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nöbet Tutan Öğretmen</p>
                  <p className="text-xl font-bold">{currentWeekAnalysis.distinctTeachersCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-400/40 bg-amber-50/20 dark:bg-amber-950/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bu Hafta Fazla Nöbet Tutan</p>
                  <p className="text-xl font-bold text-amber-600">
                    {currentWeekAnalysis.extraDutyTeachers.length} Öğretmen
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-indigo-400/40 bg-indigo-50/20 dark:bg-indigo-950/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                  <RotateCw className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Toplam Fazla Nöbet Sayısı</p>
                  <p className="text-xl font-bold text-indigo-600">
                    +{currentWeekAnalysis.totalExtraDuties} Görev
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bu Hafta Fazla Nöbet Tutanlar Detay Kartı */}
          {currentWeekAnalysis.extraDutyTeachers.length > 0 && (
            <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Bu Hafta Fazla Nöbet Tutan Öğretmenler ({currentWeekAnalysis.extraDutyTeachers.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Nöbetçi sayısı nöbet noktalarına yetmediği için bu öğretmenler bu hafta 1'den fazla nöbet tutmaktadır.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {currentWeekAnalysis.extraDutyTeachers.map((t, idx) => (
                    <div
                      key={idx}
                      className="bg-background/80 rounded-lg p-3 border border-amber-200 dark:border-amber-800 flex flex-col gap-1.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{t.teacher_name}</span>
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px]">
                          {t.count} Nöbet (+{t.extra_duties} Fazla)
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {t.assignments.map((a, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{DAY_NAMES[a.day - 1]}:</span>
                            <span className="font-medium text-foreground">{a.location}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Kümülatif Fazla Nöbet Tablosu ve Sayacı */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Öğretmen Nöbet ve Fazla Nöbet Takip Sayacı
                </CardTitle>
                <CardDescription className="text-xs">
                  Her öğretmenin bu haftaki ve kümülatif olarak kaç defa fazla nöbet tuttuğunun dökümü.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Arama Input */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Öğretmen ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-xs border rounded-md pl-8 pr-2.5 py-1.5 w-44 bg-background focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Bu Haftayı Sayaca Ekle */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCurrentWeekToStats}
                  disabled={statsSaving}
                  className="text-xs"
                  title="Aktif haftadaki nöbet sayılarını kümülatif istatistik sayacına ekler"
                >
                  <PlusCircle className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Bu Haftayı Sayaca Ekle
                </Button>

                {/* Excel İndir */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadStatsExcel}
                  className="text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Excel İndir
                </Button>

                {/* Sıfırla */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetStats}
                  className="text-xs text-muted-foreground hover:text-destructive"
                  title="Sayaçları Sıfırla"
                >
                  Sıfırla
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 font-medium text-muted-foreground border-b">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Öğretmen Adı</th>
                      <th className="py-2.5 px-3 text-center">Bu Haftaki Nöbet</th>
                      <th className="py-2.5 px-3">Bu Haftaki Yer & Günler</th>
                      <th className="py-2.5 px-3 text-center">Toplam Tutulan</th>
                      <th className="py-2.5 px-3 text-center">Toplam Fazla Nöbet</th>
                      <th className="py-2.5 px-3 text-center">Sayaç Düzeltme</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {combinedTeacherStats.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-muted-foreground">
                          Kayıtlı öğretmen veya nöbet bulunamadı.
                        </td>
                      </tr>
                    )}

                    {combinedTeacherStats.map((t, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-muted/30 transition-colors ${
                          t.week_extra > 0 ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                        }`}
                      >
                        <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-foreground">
                          {t.teacher_name}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {t.week_count > 0 ? (
                            <Badge
                              variant={t.week_count > 1 ? "default" : "secondary"}
                              className={
                                t.week_count > 1
                                  ? "bg-amber-500 hover:bg-amber-600 text-white font-bold"
                                  : ""
                              }
                            >
                              {t.week_count} Nöbet
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {t.week_assignments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {t.week_assignments.map((a, i) => (
                                <span
                                  key={i}
                                  className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground"
                                >
                                  {DAY_NAMES[a.day - 1]}: <strong>{a.location}</strong>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Nöbeti yok</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-medium">
                          {t.total_duties}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs ${
                              t.extra_duties > 0
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200"
                                : "text-muted-foreground"
                            }`}
                          >
                            {t.extra_duties > 0 ? `+${t.extra_duties} defa` : "0"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-emerald-600"
                              onClick={() => adjustExtraDuty(t.teacher_name, 1)}
                              title="+1 Fazla Nöbet Ekle"
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => adjustExtraDuty(t.teacher_name, -1)}
                              title="-1 Fazla Nöbet Eksilt"
                            >
                              <MinusCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── EXCEL YÜKLEME VE ÖNİZLEME MODALI ─────────────────── */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
              Excel Nöbet Çizelgesi Önizleme
            </DialogTitle>
            <DialogDescription className="text-xs">
              Excel dosyasından tespit edilen nöbet yerleri ve öğretmen eşleşmeleri aşağıdadır.
              Yüklemeyi onayladığınızda mevcut veritabanındaki kayıtlar silinip bu çizelgeyle güncellenecektir.
            </DialogDescription>
          </DialogHeader>

          {importResult && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {/* Tespit Edilen Nöbet Yerleri */}
              <div className="bg-muted/40 p-3 rounded-lg border space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  A Sütunundan Tespit Edilen Nöbet Yerleri ({importResult.places.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {importResult.places.map((p, i) => (
                    <Badge key={i} variant="secondary" className="font-medium text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* İstatistik Özeti */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-background border rounded-lg">
                  <p className="text-muted-foreground">Toplam Görev</p>
                  <p className="text-base font-bold text-primary">{importResult.summary.totalAssignments}</p>
                </div>
                <div className="p-2.5 bg-background border rounded-lg">
                  <p className="text-muted-foreground">Farklı Öğretmen</p>
                  <p className="text-base font-bold text-emerald-600">{importResult.summary.distinctTeachers}</p>
                </div>
                <div className="p-2.5 bg-background border rounded-lg">
                  <p className="text-muted-foreground">Fazla Nöbet</p>
                  <p className="text-base font-bold text-amber-600">
                    {importResult.summary.teacherDutyCounts.filter((t) => t.extra_duties > 0).length} Öğretmen
                  </p>
                </div>
              </div>

              {/* Fazla Nöbet Uyarısı */}
              {importResult.summary.teacherDutyCounts.some((t) => t.extra_duties > 0) && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Haftalık 1'den Fazla Nöbet Tutan Öğretmenler:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {importResult.summary.teacherDutyCounts
                      .filter((t) => t.extra_duties > 0)
                      .map((t, i) => (
                        <Badge key={i} className="bg-amber-500 hover:bg-amber-600 text-white text-[10px]">
                          {t.teacher_name} ({t.count} Nöbet)
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              {/* Gün Bazında Özet */}
              <div className="border rounded-lg p-2.5 space-y-2 bg-card">
                <p className="text-xs font-semibold text-muted-foreground">Günlük Dağılım:</p>
                <div className="space-y-1.5">
                  {DAY_NAMES.map((dayName, idx) => {
                    const dayEntries = importResult.entries.filter((e) => e.day_of_week === idx + 1);
                    return (
                      <div key={idx} className="text-xs flex items-center justify-between border-b pb-1 last:border-0">
                        <span className="font-medium text-foreground">{dayName}</span>
                        <span className="text-muted-foreground">
                          {dayEntries.map((e) => e.teacher_name).join(", ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(false)}
              disabled={importing}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyExcel}
              disabled={importing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {importing ? "Yükleniyor..." : "Mevcutu Sil ve Bu Çizelgeyi Yükle"}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>

      {/* ── NÖBET DÖNDÜRME MODALI ────────────────────────────── */}
      <Dialog open={showRotateModal} onOpenChange={setShowRotateModal}>
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <RotateCw className="h-5 w-5" />
              Nöbet Programını Döndür (Sonraki Hafta)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Bu işlem, her öğretmenin nöbet yerini bir sonraki haftanın rotasyon kurallarına göre kaydırır ve günceller.
            </DialogDescription>
          </DialogHeader>

          {/* Rotasyon Döngüsü Şeması */}
          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3.5 space-y-2 text-xs">
            <p className="font-semibold text-indigo-950 dark:text-indigo-200">
              Rotasyon Akışı:
            </p>
            <div className="grid grid-cols-1 gap-1.5 font-medium">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-background">🌿 ÖN BAHÇE</Badge>
                <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
                <Badge variant="secondary">🌲 ARKA BAHÇE</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-background">🌲 ARKA BAHÇE</Badge>
                <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
                <Badge variant="secondary">🏢 ZEMİN KAT</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-background">🏢 ZEMİN KAT</Badge>
                <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
                <Badge variant="secondary">1️⃣ 1. KAT</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-background">1️⃣ 1. KAT</Badge>
                <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
                <Badge variant="secondary">2️⃣ 2. KAT</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-background">2️⃣ 2. KAT</Badge>
                <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
                <Badge variant="secondary">🌿 ÖN BAHÇE</Badge>
              </div>
            </div>
          </div>

          {/* İstatistik Seçeneği Checkbox */}
          <label className="flex items-start gap-2 text-xs cursor-pointer p-2 rounded-lg border bg-muted/30">
            <input
              type="checkbox"
              checked={rotateWithStats}
              onChange={(e) => setRotateWithStats(e.target.checked)}
              className="mt-0.5 rounded text-primary focus:ring-primary"
            />
            <div>
              <span className="font-semibold text-foreground">
                Bu haftanın nöbetlerini istatistik sayacına işle
              </span>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                Döndürmeden önce mevcut haftada nöbet tutan ve fazla nöbet alan öğretmenlerin sayıları genel sayaca eklenir.
              </p>
            </div>
          </label>

          <DialogFooter className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRotateModal(false)}
              disabled={saving}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRotateSchedule}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <RotateCw className="h-3.5 w-3.5 mr-1" />
              {saving ? "Döndürülüyor..." : "Döndür ve Kaydet"}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>
    </div>
  );
}
