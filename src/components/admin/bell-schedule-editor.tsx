"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, Save, Clock } from "lucide-react";
import type { BellSchedule } from "@/lib/types/database";

interface Props {
  initialSchedule: BellSchedule[];
  schoolId: string;
}

interface ScheduleRow {
  id?: string;
  period_no: number;
  start_time: string;
  end_time: string;
  label: string;
}

export function BellScheduleEditor({ initialSchedule, schoolId }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>(
    initialSchedule.length > 0
      ? initialSchedule.map((s) => ({
          id: s.id,
          period_no: s.period_no,
          start_time: s.start_time.substring(0, 5),
          end_time: s.end_time.substring(0, 5),
          label: s.label,
        }))
      : generateDefaultSchedule()
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function generateDefaultSchedule(): ScheduleRow[] {
    const defaults = [
      { period_no: 1, start_time: "08:30", end_time: "09:10", label: "1. Ders" },
      { period_no: 2, start_time: "09:20", end_time: "10:00", label: "2. Ders" },
      { period_no: 3, start_time: "10:10", end_time: "10:50", label: "3. Ders" },
      { period_no: 4, start_time: "11:00", end_time: "11:40", label: "4. Ders" },
      { period_no: 5, start_time: "11:50", end_time: "12:30", label: "5. Ders" },
      { period_no: 6, start_time: "13:10", end_time: "13:50", label: "6. Ders" },
      { period_no: 7, start_time: "14:00", end_time: "14:40", label: "7. Ders" },
      { period_no: 8, start_time: "14:50", end_time: "15:30", label: "8. Ders" },
    ];
    return defaults;
  }

  function addRow() {
    const nextNo = rows.length > 0 ? Math.max(...rows.map((r) => r.period_no)) + 1 : 1;
    setRows([...rows, { period_no: nextNo, start_time: "", end_time: "", label: `${nextNo}. Ders` }]);
  }

  function removeRow(index: number) {
    setRows(rows.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: keyof ScheduleRow, value: string | number) {
    setRows(rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  async function handleSave() {
    // Validate
    for (const row of rows) {
      if (!row.start_time || !row.end_time || !row.label.trim()) {
        toast("Tüm alanları doldurun", "error");
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();

    // Delete all existing then re-insert
    await supabase.from("bell_schedule").delete().eq("school_id", schoolId);

    const insertData = rows.map((r, i) => ({
      school_id: schoolId,
      period_no: i + 1,
      start_time: r.start_time,
      end_time: r.end_time,
      label: r.label,
    }));

    const { error } = await supabase.from("bell_schedule").insert(insertData);

    if (error) {
      toast("Kaydetme hatası: " + error.message, "error");
    } else {
      // Update period_no in local state
      setRows(rows.map((r, i) => ({ ...r, period_no: i + 1 })));
      toast("Ders saatleri başarıyla kaydedildi", "success");
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Ders ve Teneffüs Saatleri
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[60px_1fr_120px_120px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span>Sıra</span>
            <span>Etiket</span>
            <span>Başlangıç</span>
            <span>Bitiş</span>
            <span></span>
          </div>

          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-[60px_1fr_120px_120px_40px] gap-2 items-center bg-muted/30 rounded-lg p-2 sm:p-1">
              <span className="text-sm font-mono text-center font-medium text-muted-foreground">{idx + 1}</span>
              <Input
                value={row.label}
                onChange={(e) => updateRow(idx, "label", e.target.value)}
                placeholder="Ders veya Teneffüs"
                className="h-9"
              />
              <Input
                type="time"
                value={row.start_time}
                onChange={(e) => updateRow(idx, "start_time", e.target.value)}
                className="h-9"
              />
              <Input
                type="time"
                value={row.end_time}
                onChange={(e) => updateRow(idx, "end_time", e.target.value)}
                className="h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => removeRow(idx)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Satır Ekle
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
