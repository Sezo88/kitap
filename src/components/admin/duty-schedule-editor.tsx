"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Save, Plus, Trash2, Shield } from "lucide-react";

interface Props {
  teachers: { id: string; full_name: string }[];
  initialSchedule: any[];
  schoolId: string;
}

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

const NOBET_YERLERI = [
  "1. Kat Koridor",
  "2. Kat Koridor",
  "3. Kat Koridor",
  "Giris / Kapı",
  "Bahce",
  "Kantin",
  "Spor Salonu",
  "Yemekhane",
];

interface DutyEntry {
  id?: string;
  teacher_id: string;
  day_of_week: number;
  location: string;
}

export function DutyScheduleEditor({ teachers, initialSchedule, schoolId }: Props) {
  const [entries, setEntries] = useState<DutyEntry[]>(
    initialSchedule.map((d) => ({
      id: d.id,
      teacher_id: d.teacher_id,
      day_of_week: d.day_of_week,
      location: d.location || "",
    }))
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function addEntry(dayOfWeek: number) {
    setEntries([...entries, { teacher_id: "", day_of_week: dayOfWeek, location: NOBET_YERLERI[0] }]);
  }

  function removeEntry(idx: number) {
    setEntries(entries.filter((_, i) => i !== idx));
  }

  function updateEntry(idx: number, field: keyof DutyEntry, value: string | number) {
    setEntries(entries.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  }

  function getEntriesForDay(day: number) {
    return entries
      .map((e, idx) => ({ ...e, _idx: idx }))
      .filter((e) => e.day_of_week === day);
  }

  async function handleSave() {
    const invalid = entries.some((e) => !e.teacher_id || !e.location);
    if (invalid) {
      toast("Lutfen tum nobet satirlarinda ogretmen ve nobet yeri secin", "error");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    await supabase.from("duty_schedule").delete().eq("school_id", schoolId);

    if (entries.length > 0) {
      const insertData = entries.map((e) => ({
        school_id: schoolId,
        teacher_id: e.teacher_id,
        day_of_week: e.day_of_week,
        time_slot: e.location, // zaman dilimi yerine nobet yeri
        location: e.location,
      }));

      const { error } = await supabase.from("duty_schedule").insert(insertData);
      if (error) {
        toast("Kaydetme hatasi: " + error.message, "error");
        setSaving(false);
        return;
      }
    }

    toast("Nobet programi basariyla kaydedildi", "success");
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Kaydediliyor..." : "Tumunu Kaydet"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {DAY_NAMES.map((dayName, dayIdx) => {
          const dayEntries = getEntriesForDay(dayIdx + 1);
          return (
            <Card key={dayIdx}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" /> {dayName}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => addEntry(dayIdx + 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dayEntries.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">Nobetci eklenmemis</p>
                )}
                {dayEntries.map((entry) => (
                  <div key={entry._idx} className="flex flex-col gap-1.5 bg-muted/30 rounded-md p-2">
                    <select
                      className="text-xs border rounded px-1.5 py-1 bg-background w-full"
                      value={entry.teacher_id}
                      onChange={(e) => updateEntry(entry._idx, "teacher_id", e.target.value)}
                    >
                      <option value="">Ogretmen sec</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                    <div className="flex gap-1.5">
                      <select
                        className="text-xs border rounded px-1.5 py-1 bg-background flex-1"
                        value={entry.location}
                        onChange={(e) => updateEntry(entry._idx, "location", e.target.value)}
                      >
                        {NOBET_YERLERI.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                        onClick={() => removeEntry(entry._idx)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
