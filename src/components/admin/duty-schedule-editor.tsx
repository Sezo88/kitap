"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  ArrowRight,
  PlusCircle,
  MinusCircle,
  Download,
  Search,
  Sparkles,
  UserCheck,
  Zap,
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
  is_extra?: boolean;
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

  // Başlangıç nöbetlerini yükle ve çift nöbetleri otomatik belirle
  const [entries, setEntries] = useState<DutyEntry[]>(() => {
    const list: DutyEntry[] = initialSchedule.map((d) => ({
      id: d.id,
      teacher_id: d.teacher_id || null,
      teacher_name:
        d.teacher_name ||
        (Array.isArray(d.profiles) ? d.profiles[0]?.full_name : d.profiles?.full_name) ||
        teachers.find((t) => t.id === d.teacher_id)?.full_name ||
        "",
      day_of_week: d.day_of_week,
      location: d.location || "",
      is_extra: d.time_slot === "EK_NOBET" || (d as any).is_extra === true,
    }));

    // Eğer veritabanında henüz is_extra etiketlenmemişse, haftada birden fazla geçen öğretmenlerin
    // 2. nöbetlerini otomatik olarak is_extra = true yap
    const hasAnyTagged = list.some((e) => e.is_extra);
    if (!hasAnyTagged) {
      const seen = new Set<string>();
      list.forEach((e) => {
        const key = (e.teacher_name || e.teacher_id || "").toLocaleUpperCase("tr-TR");
        if (!key) return;
        if (seen.has(key)) {
          e.is_extra = true;
        } else {
          seen.add(key);
          e.is_extra = false;
        }
      });
    }

    return list;
  });

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

  // Rotate Modal & Çift Nöbet Değişim State'i
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [rotateWithStats, setRotateWithStats] = useState(true);
  // Çift nöbet yerlerine sonraki hafta atanacak yeni öğretmenler: { [entryIndex]: { teacher_id, teacher_name } }
  const [extraAssignments, setExtraAssignments] = useState<
    Record<number, { teacher_id: string | null; teacher_name: string }>
  >({});

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

  // Bütün bilinen öğretmen seçenekleri
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
      { count: number; teacher_id: string | null; extraCount: number; assignments: { day: number; location: string; is_extra?: boolean }[] }
    > = {};

    entries.forEach((e) => {
      const name =
        e.teacher_name ||
        teachers.find((t) => t.id === e.teacher_id)?.full_name ||
        "İsimsiz Öğretmen";

      if (!teacherMap[name]) {
        teacherMap[name] = {
          count: 0,
          extraCount: 0,
          teacher_id: e.teacher_id || null,
          assignments: [],
        };
      }
      teacherMap[name].count++;
      if (e.is_extra) teacherMap[name].extraCount++;
      teacherMap[name].assignments.push({ day: e.day_of_week, location: e.location, is_extra: e.is_extra });
    });

    const list = Object.entries(teacherMap).map(([name, data]) => ({
      teacher_name: name,
      teacher_id: data.teacher_id,
      count: data.count,
      extra_duties: data.extraCount > 0 ? data.extraCount : Math.max(0, data.count - 1),
      assignments: data.assignments,
    }));

    list.sort((a, b) => b.count - a.count || a.teacher_name.localeCompare(b.teacher_name, "tr-TR"));

    const extraDutyTeachers = list.filter((t) => t.extra_duties > 0 || t.count > 1);
    const totalExtraDuties = entries.filter((e) => e.is_extra).length || extraDutyTeachers.reduce((acc, t) => acc + t.extra_duties, 0);

    return {
      list,
      totalDuties: entries.length,
      distinctTeachersCount: list.length,
      extraDutyTeachers,
      totalExtraDuties,
    };
  }, [entries, teachers]);

  // ── Çift Nöbet (is_extra) Değiştirme (Tıklama ile Tik Atma) ─
  function toggleIsExtra(idx: number) {
    const targetEntry = entries[idx];
    if (!targetEntry) return;

    const teacherName =
      targetEntry.teacher_name || teachers.find((t) => t.id === targetEntry.teacher_id)?.full_name;

    // Eğer bu öğretmenin 2 nöbeti varsa ve birine tıklandıysa, diğerinin durumunu tersine çevir
    const teacherSameDuties = entries
      .map((e, i) => ({ ...e, originalIndex: i }))
      .filter((e) => {
        const name = e.teacher_name || teachers.find((t) => t.id === e.teacher_id)?.full_name;
        return name && name === teacherName;
      });

    if (teacherSameDuties.length === 2) {
      const otherDuty = teacherSameDuties.find((d) => d.originalIndex !== idx);
      const newExtraState = !targetEntry.is_extra;

      setEntries((prev) =>
        prev.map((e, i) => {
          if (i === idx) return { ...e, is_extra: newExtraState };
          if (otherDuty && i === otherDuty.originalIndex) return { ...e, is_extra: !newExtraState };
          return e;
        })
      );
    } else {
      // Tek nöbeti varsa da serbestçe toggle edebilir
      setEntries((prev) =>
        prev.map((e, i) => (i === idx ? { ...e, is_extra: !e.is_extra } : e))
      );
    }
  }

  // ── Manuel Satır Ekleme / Silme / Düzenleme ─────────────────
  function addEntry(dayOfWeek: number) {
    setEntries([
      ...entries,
      {
        teacher_id: "",
        teacher_name: "",
        day_of_week: dayOfWeek,
        location: nobetYerleri[0] || "ÖN BAHÇE",
        is_extra: false,
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
      await supabase.from("duty_schedule").delete().eq("school_id", schoolId);

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
            time_slot: e.is_extra ? "EK_NOBET" : e.location,
            location: e.location,
          };
        });

        const { error } = await supabase.from("duty_schedule").insert(insertData);
        if (error) throw error;
      }

      if (nobetYerleri.length > 0) {
        await supabase
          .from("panel_config")
          .update({ nobet_yerleri: nobetYerleri.join(", ") })
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

      const newDutyEntries: DutyEntry[] = parsedEntries.map((pe) => {
        const matched = matchTeacher(pe.teacher_name);
        return {
          teacher_id: matched ? matched.id : null,
          teacher_name: pe.teacher_name,
          day_of_week: pe.day_of_week,
          location: pe.location,
          is_extra: pe.is_extra ?? false,
        };
      });

      await supabase.from("duty_schedule").delete().eq("school_id", schoolId);

      const insertData = newDutyEntries.map((e) => ({
        school_id: schoolId,
        teacher_id: e.teacher_id,
        teacher_name: e.teacher_name,
        day_of_week: e.day_of_week,
        time_slot: e.is_extra ? "EK_NOBET" : e.location,
        location: e.location,
      }));

      const { error: insErr } = await supabase.from("duty_schedule").insert(insertData);
      if (insErr) throw insErr;

      await supabase
        .from("panel_config")
        .update({ nobet_yerleri: newPlaces.join(", ") })
        .eq("school_id", schoolId);

      setNobetYerleri(newPlaces);
      setEntries(newDutyEntries);
      setShowImportModal(false);

      toast(
        `Excel'den ${insertData.length} nöbet kaydı yüklendi. Çift nöbetler otomatik olarak işaretlendi!`,
        "success"
      );
    } catch (err: any) {
      toast("Excel aktarımı kaydedilemedi: " + (err.message || err), "error");
    } finally {
      setImporting(false);
    }
  }

  // ── NÖBET DÖNDÜRME SİHİRBAZI & ÇİFT NÖBET ADİL DAĞITIMI ──────

  // Aktif çizelgede çift (ek) olarak işaretlenmiş nöbet satırları
  const extraDutyEntriesWithIdx = useMemo(() => {
    return entries
      .map((e, idx) => ({ ...e, idx }))
      .filter((e) => e.is_extra);
  }, [entries]);

  // Çift nöbet tutmaya en uygun adaylar (Kümülatif fazla nöbeti en az olanlar)
  const candidateTeachersSorted = useMemo(() => {
    const statsMap = new Map<string, number>();
    dutyStats.forEach((s) => statsMap.set(s.teacher_name.toLocaleUpperCase("tr-TR"), s.extra_duties));

    return [...teacherOptions].sort((a, b) => {
      const aCount = statsMap.get(a.name.toLocaleUpperCase("tr-TR")) || 0;
      const bCount = statsMap.get(b.name.toLocaleUpperCase("tr-TR")) || 0;
      if (aCount !== bCount) return aCount - bCount;
      return a.name.localeCompare(b.name, "tr-TR");
    });
  }, [teacherOptions, dutyStats]);

  // Döndürme modalı açıldığında önerileri hazırla
  function handleOpenRotateModal() {
    // Çift nöbet yerleri için başlangıç önerisi oluştur
    const initialAssigns: Record<number, { teacher_id: string | null; teacher_name: string }> = {};

    // Bu hafta çift nöbet tutan öğretmenler (dinlendirilecekler)
    const currentExtraHolders = new Set(
      extraDutyEntriesWithIdx.map((e) => (e.teacher_name || "").toLocaleUpperCase("tr-TR"))
    );

    // Çift tutmayan ve en az fazla nöbeti olan öğretmen havuzu
    const availablePool = candidateTeachersSorted.filter(
      (c) => !currentExtraHolders.has(c.name.toLocaleUpperCase("tr-TR"))
    );

    extraDutyEntriesWithIdx.forEach((extraItem, i) => {
      const candidate = availablePool[i % availablePool.length];
      if (candidate) {
        initialAssigns[extraItem.idx] = {
          teacher_id: candidate.id || null,
          teacher_name: candidate.name,
        };
      }
    });

    setExtraAssignments(initialAssigns);
    setShowRotateModal(true);
  }

  // Otomatik Adil Dağıt Butonu: Sıradaki en adil öğretmenleri otomatik yerleştirir
  function autoAssignFairCandidates() {
    const initialAssigns: Record<number, { teacher_id: string | null; teacher_name: string }> = {};

    const currentExtraHolders = new Set(
      extraDutyEntriesWithIdx.map((e) => (e.teacher_name || "").toLocaleUpperCase("tr-TR"))
    );

    // Bu hafta çift tutmayan ve en az fazla nöbeti olanlar
    const availablePool = candidateTeachersSorted.filter(
      (c) => !currentExtraHolders.has(c.name.toLocaleUpperCase("tr-TR"))
    );

    extraDutyEntriesWithIdx.forEach((extraItem, i) => {
      // Mümkünse aynı gün nöbeti olmayan bir aday seç
      const candidatesWithoutDutyOnThisDay = availablePool.filter((c) => {
        return !entries.some(
          (e) =>
            e.day_of_week === extraItem.day_of_week &&
            !e.is_extra &&
            (e.teacher_name || "").toLocaleUpperCase("tr-TR") === c.name.toLocaleUpperCase("tr-TR")
        );
      });

      const selected =
        candidatesWithoutDutyOnThisDay[i % candidatesWithoutDutyOnThisDay.length] ||
        availablePool[i % availablePool.length];

      if (selected) {
        initialAssigns[extraItem.idx] = {
          teacher_id: selected.id || null,
          teacher_name: selected.name,
        };
      }
    });

    setExtraAssignments(initialAssigns);
    toast("Çift nöbet yerleri en az fazla nöbet tutmuş öğretmenlere adil şekilde paylaştırıldı.", "info");
  }

  // Döndürmeyi Uygula ve Veritabanına Kaydet
  async function handleRotateSchedule() {
    setSaving(true);
    const supabase = createClient();

    try {
      // 1. Nöbet yerlerini rotasyon kuralına göre döndür
      const rotatedEntries: DutyEntry[] = entries.map((e, idx) => {
        const nextLoc = rotateDutyLocation(e.location, nobetYerleri);

        // Eğer bu bir ÇİFT (EK) nöbet satırıysa:
        if (e.is_extra) {
          const assigned = extraAssignments[idx];
          return {
            ...e,
            location: nextLoc,
            // Yeni atanan öğretmen (önceki çift tutan kişi oradan kaldırıldı!)
            teacher_id: assigned ? assigned.teacher_id : null,
            teacher_name: assigned ? assigned.teacher_name : "",
            is_extra: true, // Bir sonraki haftada da ek nöbet olarak takip edilsin
          };
        }

        // ASIL NÖBET: Öğretmenin orijinal nöbeti bir sonraki yere geçer
        return {
          ...e,
          location: nextLoc,
          is_extra: false,
        };
      });

      // 2. Bu haftanın nöbetlerini kümülatif istatistik sayacına işle
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
          time_slot: e.is_extra ? "EK_NOBET" : e.location,
          location: e.location,
        };
      });

      const { error } = await supabase.from("duty_schedule").insert(insertData);
      if (error) throw error;

      setEntries(rotatedEntries);
      setShowRotateModal(false);

      toast(
        "Nöbet programı döndürüldü! Asıl nöbetler sonraki yere geçti, çift nöbet yerleri yeni öğretmenlere aktarıldı.",
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

    dutyStats.forEach((st) => {
      updatedStatsMap.set(st.teacher_name.toLocaleUpperCase("tr-TR"), { ...st });
    });

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

    setDutyStats(newStatsList);
    try {
      localStorage.setItem(statsStorageKey, JSON.stringify(newStatsList));
    } catch (e) {}

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
      console.warn("duty_stats tablosuna kaydedilemedi:", err);
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
        .map((a) => `${DAY_NAMES[a.day - 1]}: ${a.location}${a.is_extra ? " (Çift)" : ""}`)
        .join(", ") || "Yok",
      "Bu Hafta Çift/Fazla Nöbet": t.week_extra > 0 ? `${t.week_extra} Çift Nöbet` : "Normal",
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
        week_assignments: { day: number; location: string; is_extra?: boolean }[];
        total_duties: number;
        extra_duties: number;
      }
    >();

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
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
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
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === "stats"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Fazla Nöbet & İstatistikler
            {currentWeekAnalysis.totalExtraDuties > 0 && (
              <span className="bg-amber-500 text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold">
                {currentWeekAnalysis.totalExtraDuties} Çift Nöbet
              </span>
            )}
          </button>
        </div>

        {/* Sağ: Aksiyon Butonları */}
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={handleOpenRotateModal}
            className="border-indigo-600/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 font-medium"
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
            className="bg-primary text-primary-foreground shadow font-medium"
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
          {/* Çift Nöbet Bilgi & İpucu Kartı */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                <strong>Çift Nöbet İşaretleme:</strong> Haftada birden fazla nöbet tutan öğretmenlerin hangi nöbetinin{" "}
                <strong>&quot;Asıl&quot;</strong>, hangisinin <strong>&quot;Çift (Ek)&quot;</strong> nöbet olduğunu aşağıdaki kartların üzerindeki{" "}
                <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded font-semibold text-[10px]">
                  ✓ Çift Nöbet
                </span>{" "}
                butonuna tıklayarak belirleyebilirsiniz.
              </p>
              <p className="text-muted-foreground text-[11px]">
                💡 <em>Nöbet Döndür</em> yapıldığında, öğretmenin asıl nöbeti rotasyona göre kaydırılırken; çift nöbet tuttuğu yere o hafta çift tutmayan başka bir öğretmen adil şekilde yerleştirilecektir.
              </p>
            </div>
          </div>

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

                  <CardContent className="p-2.5 flex-1 space-y-2.5 overflow-y-auto max-h-[600px]">
                    {dayEntries.length === 0 && (
                      <div className="text-center py-8 text-xs text-muted-foreground">
                        Nöbetçi eklenmemiş
                      </div>
                    )}

                    {dayEntries.map((entry) => {
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
                          className={`flex flex-col gap-2 rounded-lg p-2.5 text-xs border transition-all ${
                            entry.is_extra
                              ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700/60 shadow-xs ring-1 ring-amber-400/20"
                              : hasMultipleDuties
                              ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
                              : "bg-background border-border/70"
                          }`}
                        >
                          {/* Üst Kısım: Asıl / Çift Nöbet Tiki/Rozeti */}
                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => toggleIsExtra(entry._idx)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                                entry.is_extra
                                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                                  : hasMultipleDuties
                                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                              title="Bu nöbetin türünü (Asıl / Çift) değiştirmek için tıklayın"
                            >
                              {entry.is_extra ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  ✓ Çift Nöbet (Döndürmede Değişecek)
                                </>
                              ) : hasMultipleDuties ? (
                                <>
                                  <UserCheck className="h-3 w-3" />
                                  Asıl Nöbeti (Sabit Kalacak)
                                </>
                              ) : (
                                <>
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                                  Asıl Nöbet
                                </>
                              )}
                            </button>

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

                          {/* Öğretmen Seçimi */}
                          <div>
                            <select
                              className="text-xs font-medium border rounded px-1.5 py-1.5 bg-background w-full focus:ring-1 focus:ring-primary truncate"
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
                          </div>

                          {/* Nöbet Yeri Seçimi */}
                          <div>
                            <select
                              className="text-xs border rounded px-1.5 py-1 bg-background w-full focus:ring-1 focus:ring-primary truncate"
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
                  <p className="text-xs text-muted-foreground">Bu Hafta Çift Nöbet Tutan</p>
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
                  <p className="text-xs text-muted-foreground">Toplam Çift/Fazla Nöbet</p>
                  <p className="text-xl font-bold text-indigo-600">
                    +{currentWeekAnalysis.totalExtraDuties} Görev
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bu Hafta Çift Nöbet Tutanlar Detay Kartı */}
          {currentWeekAnalysis.extraDutyTeachers.length > 0 && (
            <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Bu Hafta Çift Nöbet Tutan Öğretmenler ({currentWeekAnalysis.extraDutyTeachers.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Nöbetçi sayısı nöbet noktalarından az olduğu için bu öğretmenler bu hafta 1&apos;den fazla nöbet tutmaktadır.
                  Bir sonraki hafta döndürmede bu öğretmenler dinlendirilecek ve yerlerine başkaları geçecektir.
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
                      <div className="text-xs text-muted-foreground space-y-1 mt-1">
                        {t.assignments.map((a, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span>{DAY_NAMES[a.day - 1]}: <strong>{a.location}</strong></span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                a.is_extra
                                  ? "bg-amber-500 text-white"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {a.is_extra ? "Çift Nöbet" : "Asıl"}
                            </span>
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
                  Her öğretmenin kümülatif olarak kaç defa çift/fazla nöbet tuttuğunun dökümü. Nöbet döndürülürken bu sayaca göre en az tutanlar önerilir.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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
                                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    a.is_extra
                                      ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-medium"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {DAY_NAMES[a.day - 1]}: <strong>{a.location}</strong>
                                  {a.is_extra && " (Çift)"}
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
              Çift nöbet tutan öğretmenlerin 2. nöbetleri otomatik olarak işaretlenmiştir.
            </DialogDescription>
          </DialogHeader>

          {importResult && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
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
                  <p className="text-muted-foreground">Çift Nöbet</p>
                  <p className="text-base font-bold text-amber-600">
                    {importResult.summary.teacherDutyCounts.filter((t) => t.extra_duties > 0).length} Öğretmen
                  </p>
                </div>
              </div>

              {importResult.summary.teacherDutyCounts.some((t) => t.extra_duties > 0) && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Otomatik Tespit Edilen Çift Nöbetçiler:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {importResult.summary.teacherDutyCounts
                      .filter((t) => t.extra_duties > 0)
                      .map((t, i) => (
                        <Badge key={i} className="bg-amber-500 hover:bg-amber-600 text-white text-[10px]">
                          {t.teacher_name} ({t.count} Nöbet - 1 Çift)
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              <div className="border rounded-lg p-2.5 space-y-2 bg-card">
                <p className="text-xs font-semibold text-muted-foreground">Günlük Dağılım:</p>
                <div className="space-y-1.5">
                  {DAY_NAMES.map((dayName, idx) => {
                    const dayEntries = importResult.entries.filter((e) => e.day_of_week === idx + 1);
                    return (
                      <div key={idx} className="text-xs flex items-center justify-between border-b pb-1 last:border-0">
                        <span className="font-medium text-foreground">{dayName}</span>
                        <span className="text-muted-foreground">
                          {dayEntries.map((e) => `${e.teacher_name}${e.is_extra ? " [Çift]" : ""}`).join(", ")}
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {importing ? "Yükleniyor..." : "Mevcutu Sil ve Bu Çizelgeyi Yükle"}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>

      {/* ── NÖBET DÖNDÜRME VE ÇİFT NÖBET DEĞİŞİM MODALI ──────── */}
      <Dialog open={showRotateModal} onOpenChange={setShowRotateModal}>
        <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 text-base">
              <RotateCw className="h-5 w-5" />
              Nöbet Programını Döndür & Çift Nöbet Değişimi
            </DialogTitle>
            <DialogDescription className="text-xs">
              Bu haftanın asıl nöbetçileri rotasyon kuralına göre sonraki yere geçecek; çift nöbet tutanlar dinlendirilecek ve yerlerine başkaları atanacaktır.
            </DialogDescription>
          </DialogHeader>

          {/* 1. Rotasyon Kuralı Şeması */}
          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 text-xs">
            <p className="font-semibold text-indigo-950 dark:text-indigo-200 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              Asıl Nöbetler İçin Rotasyon Akışı:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] font-medium text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">ÖN BAHÇE</Badge>
                <ArrowRight className="h-3 w-3 text-indigo-500" />
                <Badge variant="secondary" className="text-[10px]">ARKA BAHÇE</Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">ARKA BAHÇE</Badge>
                <ArrowRight className="h-3 w-3 text-indigo-500" />
                <Badge variant="secondary" className="text-[10px]">ZEMİN KAT</Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">ZEMİN KAT</Badge>
                <ArrowRight className="h-3 w-3 text-indigo-500" />
                <Badge variant="secondary" className="text-[10px]">1. KAT</Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">1. KAT</Badge>
                <ArrowRight className="h-3 w-3 text-indigo-500" />
                <Badge variant="secondary" className="text-[10px]">2. KAT</Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">2. KAT</Badge>
                <ArrowRight className="h-3 w-3 text-indigo-500" />
                <Badge variant="secondary" className="text-[10px]">ÖN BAHÇE</Badge>
              </div>
            </div>
          </div>

          {/* 2. ÇİFT NÖBET DEĞİŞİM BÖLÜMÜ */}
          <div className="border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 rounded-lg p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="font-semibold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Çift Nöbet Yerleri ve Yeni Nöbetçi Dağıtımı ({extraDutyEntriesWithIdx.length})
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Bu hafta çift nöbet tutanlar dinlendirildi. Boşalan bu noktalara sonraki hafta için öğretmen atayınız:
                </p>
              </div>

              {/* Otomatik Adil Dağıt Butonu */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={autoAssignFairCandidates}
                className="text-xs bg-amber-100 dark:bg-amber-900/40 border-amber-400 text-amber-900 dark:text-amber-100 hover:bg-amber-200"
              >
                <Zap className="h-3.5 w-3.5 mr-1 text-amber-600 fill-amber-600" />
                Otomatik Adil Dağıt
              </Button>
            </div>

            {extraDutyEntriesWithIdx.length === 0 ? (
              <div className="bg-background/80 p-3 rounded text-xs text-muted-foreground text-center">
                Çizelgede çift nöbet olarak işaretlenmiş satır bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2.5">
                {extraDutyEntriesWithIdx.map((item) => {
                  const rotatedLoc = rotateDutyLocation(item.location, nobetYerleri);
                  const currentAssign = extraAssignments[item.idx];

                  return (
                    <div
                      key={item.idx}
                      className="bg-background/90 border rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground">
                            {DAY_NAMES[item.day_of_week - 1]}
                          </span>
                          <span className="text-muted-foreground">➔</span>
                          <Badge variant="outline" className="font-semibold">
                            {rotatedLoc}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Önceki Çift Nöbetçi:{" "}
                          <span className="line-through text-amber-700 dark:text-amber-300">
                            {item.teacher_name}
                          </span>{" "}
                          (Dinlendirildi)
                        </div>
                      </div>

                      {/* Yeni Öğretmen Seçici */}
                      <div className="w-full sm:w-60">
                        <select
                          className="text-xs border rounded px-2 py-1.5 bg-background w-full focus:ring-1 focus:ring-primary font-medium"
                          value={currentAssign?.teacher_id || currentAssign?.teacher_name || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const matched = teachers.find((t) => t.id === val);
                            setExtraAssignments((prev) => ({
                              ...prev,
                              [item.idx]: {
                                teacher_id: matched ? matched.id : null,
                                teacher_name: matched ? matched.full_name : val,
                              },
                            }));
                          }}
                        >
                          <option value="">-- Yeni Nöbetçi Seçin --</option>
                          {candidateTeachersSorted.map((cand, ci) => {
                            const st = dutyStats.find(
                              (s) => s.teacher_name.toLocaleUpperCase("tr-TR") === cand.name.toLocaleUpperCase("tr-TR")
                            );
                            const extraCount = st ? st.extra_duties : 0;
                            return (
                              <option key={ci} value={cand.id || cand.name}>
                                {cand.name} ({extraCount === 0 ? "⭐ 0 Fazla Nöbet" : `${extraCount} Fazla`})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* İstatistik Seçeneği Checkbox */}
          <label className="flex items-start gap-2 text-xs cursor-pointer p-2.5 rounded-lg border bg-muted/30">
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
                Döndürmeden önce mevcut haftada çift nöbet tutan öğretmenlerin sayıları genel fazla nöbet sayacına eklenir.
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
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
