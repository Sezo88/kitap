"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Save, Plus, Trash2, Shield } from "lucide-react";

interface Props {
  teachers: { id: string; full_name: string }[];
  initialSchedule: any[];
  schoolId: string;
}

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

const DEFAULT_TIME_SLOTS = [
  "1. Teneffüs",
  "2. Teneffüs",
  "3. Teneffüs",
  "4. Teneffüs",
  "5. Teneffüs",
  "Öğle Arası",
  "Kapı Nöbeti",
  "Bahçe Nöbeti",
];

interface DutyEntry {
  id?: string;
  teacher_id: string;
  day_of_week: number;
  time_slot: string;
  location: string;
}

export function DutyScheduleEditor({ teachers, initialSchedule, schoolId }: Props) {
  const [entries, setEntries] = useState<DutyEntry[]>(
    initialSchedule.map((d) => ({
      id: d.id,
      teacher_id: d.teacher_id,
      day_of_week: d.day_of_week,
      time_slot: d.time_slot,
      location: d.location || "",
    }))
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function addEntry() {
    setEntries([...entries, { teacher_id: "", day_of_week: 1, time_slot: DEFAULT_TIME_SLOTS[0], location: "" }]);
  }

  function removeEntry(idx: number) {
    setEntries(entries.filter((_, i) => i !== idx));
  }

  function updateEntry(idx: number, field: keyof DutyEntry, value: string | number) {
    setEntries(entries.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  }

  // Gruplama: gün bazlı göster
  function getEntriesForDay(day: number) {
    return entries
      .map((e, idx) => ({ ...e, _idx: idx }))
      .filter((e) => e.day_of_week === day);
  }

  async function handleSave() {
    // Validate
    const invalid = entries.some((e) => !e.teacher_id || !e.time_slot);
    if (invalid) {
      toast("Lütfen tüm nöbet satırlarında öğretmen ve zaman dilimi seçin", "error");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    // Hepsini sil, yeniden ekle
    await supabase.from("duty_schedule").delete().eq("school_id", schoolId);

    if (entries.length > 0) {
      const insertData = entries.map((e) => ({
        school_id: schoolId,
        teacher_id: e.teacher_id,
        day_of_week: e.day_of_week,
        time_slot: e.time_slot,
        location: e.location || null,
      }));

      const { error } = await supabase.from("duty_schedule").insert(insertData);
      if (error) {
        toast("Kaydetme hatası: " + error.message, "error");
        setSaving(false);
        return;
      }
    }

    toast("Nöbet programı başarıyla kaydedildi", "success");
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addEntry}>
          <Plus className="h-4 w-4 mr-1" /> Nöbet Ekle
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Kaydediliyor..." : "Tümünü Kaydet"}
        </Button>
      </div>

      {/* Her gün için kart */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {DAY_NAMES.map((dayName, dayIdx) => {
          const dayEntries = getEntriesForDay(dayIdx + 1);
          return (
            <Card key={dayIdx}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {dayName}
                  <span className="text-xs text-muted-foreground font-normal">({dayEntries.length} nöbet)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dayEntries.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">Bu güne nöbet eklenmemiş</p>
                )}
                {dayEntries.map((entry) => (
                  <div key={entry._idx} className="flex flex-wrap gap-1.5 items-center bg-muted/30 rounded-md p-2">
                    <select
                      className="text-xs border rounded px-1.5 py-1 bg-background flex-1 min-w-[100px]"
                      value={entry.time_slot}
                      onChange={(e) => updateEntry(entry._idx, "time_slot", e.target.value)}
                    >
                      {DEFAULT_TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                    <select
                      className="text-xs border rounded px-1.5 py-1 bg-background flex-1 min-w-[120px]"
                      value={entry.teacher_id}
                      onChange={(e) => updateEntry(entry._idx, "teacher_id", e.target.value)}
                    >
                      <option value="">Öğretmen seç</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                    <Input
                      className="text-xs h-7 w-24"
                      placeholder="Konum"
                      value={entry.location}
                      onChange={(e) => updateEntry(entry._idx, "location", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeEntry(entry._idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs h-7"
                  onClick={() => {
                    setEntries([...entries, { teacher_id: "", day_of_week: dayIdx + 1, time_slot: DEFAULT_TIME_SLOTS[0], location: "" }]);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> {dayName}'ye nöbet ekle
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
