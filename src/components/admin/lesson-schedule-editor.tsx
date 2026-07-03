"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Save, CalendarDays } from "lucide-react";
import type { BellSchedule, LessonSchedule } from "@/lib/types/database";

interface Props {
  classes: { id: string; name: string }[];
  teachers: { id: string; full_name: string }[];
  subjects: { id: string; name: string }[];
  bellSchedule: BellSchedule[];
  initialSchedule: LessonSchedule[];
  schoolId: string;
}

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

type CellKey = string; // "classId-day-period"
type CellValue = { teacher_id: string; subject_id: string };

function buildKey(classId: string, day: number, period: number) {
  return `${classId}-${day}-${period}`;
}

export function LessonScheduleEditor({ classes, teachers, subjects, bellSchedule, initialSchedule, schoolId }: Props) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "");
  const [cells, setCells] = useState<Record<CellKey, CellValue>>(() => {
    const init: Record<CellKey, CellValue> = {};
    initialSchedule.forEach((ls) => {
      init[buildKey(ls.class_id, ls.day_of_week, ls.period_no)] = {
        teacher_id: ls.teacher_id,
        subject_id: ls.subject_id,
      };
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function updateCell(day: number, period: number, field: "teacher_id" | "subject_id", value: string) {
    const key = buildKey(selectedClassId, day, period);
    setCells((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  }

  function getCell(day: number, period: number): CellValue {
    return cells[buildKey(selectedClassId, day, period)] || { teacher_id: "", subject_id: "" };
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    // Bu sınıfın mevcut programını sil
    await supabase
      .from("lesson_schedule")
      .delete()
      .eq("school_id", schoolId)
      .eq("class_id", selectedClassId);

    // Dolu hücreleri ekle
    const insertData: any[] = [];
    for (let day = 1; day <= 5; day++) {
      for (const bell of bellSchedule) {
        const cell = getCell(day, bell.period_no);
        if (cell.teacher_id && cell.subject_id) {
          insertData.push({
            school_id: schoolId,
            class_id: selectedClassId,
            teacher_id: cell.teacher_id,
            subject_id: cell.subject_id,
            day_of_week: day,
            period_no: bell.period_no,
          });
        }
      }
    }

    if (insertData.length > 0) {
      const { error } = await supabase.from("lesson_schedule").insert(insertData);
      if (error) {
        toast("Kaydetme hatası: " + error.message, "error");
        setSaving(false);
        return;
      }
    }

    toast(`${classes.find(c => c.id === selectedClassId)?.name || ""} sınıfının ders programı kaydedildi`, "success");
    setSaving(false);
  }

  // Derslere etiket olarak sadece ders saat numarasını göster
  const lessonPeriods = bellSchedule.filter((b) => b.label.toLowerCase().includes("ders"));

  return (
    <div className="space-y-4">
      {/* Sınıf seçici */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="w-48"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Button type="button" onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Kaydediliyor..." : "Bu Sınıfı Kaydet"}
        </Button>
      </div>

      {/* Program tablosu */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5" />
            {classes.find(c => c.id === selectedClassId)?.name} — Haftalık Ders Programı
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="border p-2 text-left font-medium w-24">Ders Saati</th>
                {DAY_NAMES.map((day, idx) => (
                  <th key={idx} className="border p-2 text-center font-medium">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bellSchedule.map((bell) => (
                <tr key={bell.period_no} className="hover:bg-muted/20">
                  <td className="border p-2 text-xs">
                    <div className="font-medium">{bell.label}</div>
                    <div className="text-muted-foreground">{bell.start_time.substring(0,5)}-{bell.end_time.substring(0,5)}</div>
                  </td>
                  {[1, 2, 3, 4, 5].map((day) => {
                    const cell = getCell(day, bell.period_no);
                    return (
                      <td key={day} className="border p-1 min-w-[140px]">
                        <div className="space-y-1">
                          <select
                            className="w-full text-xs border rounded px-1 py-1 bg-background"
                            value={cell.subject_id}
                            onChange={(e) => updateCell(day, bell.period_no, "subject_id", e.target.value)}
                          >
                            <option value="">Ders</option>
                            {subjects.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <select
                            className="w-full text-xs border rounded px-1 py-1 bg-background"
                            value={cell.teacher_id}
                            onChange={(e) => updateCell(day, bell.period_no, "teacher_id", e.target.value)}
                          >
                            <option value="">Öğretmen</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>{t.full_name}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
