"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatTurkishDate, formatDayName } from "./types";
import type { ExamPeriod, ExamScheduleWithDetails } from "@/lib/types/database";
import { Copy, Check, Share2, MessageCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: ExamPeriod;
  schedules: ExamScheduleWithDetails[];
  gradeLevels: number[];
  schoolName: string;
}

export function ExamWhatsAppModal({
  open,
  onOpenChange,
  period,
  schedules,
  gradeLevels,
  schoolName,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const { toast } = useToast();

  function generateText() {
    let text = `📢 *${schoolName?.toLocaleUpperCase("tr-TR") || "OKULUMUZ"}*\n`;
    text += `📅 *${period.academic_year} ${period.name.toLocaleUpperCase("tr-TR")}*\n`;
    text += `🗓️ Tarih Aralığı: ${formatTurkishDate(period.start_date)} - ${formatTurkishDate(period.end_date)}\n\n`;

    const targetGrades = selectedGrade === "ALL" 
      ? gradeLevels 
      : [Number(selectedGrade)];

    targetGrades.forEach((grade) => {
      const exams = schedules
        .filter((s) => s.period_id === period.id && s.grade_level === grade)
        .sort((a, b) => a.exam_date.localeCompare(b.exam_date) || a.lesson_period - b.lesson_period);

      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      text += `🎯 *${grade}. SINIFLAR SINAV TAKVİMİ*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;

      if (exams.length === 0) {
        text += `_Henüz sınav planlanmadı._\n\n`;
      } else {
        exams.forEach((ex) => {
          text += `🔹 *${formatTurkishDate(ex.exam_date)} (${formatDayName(ex.exam_date)})*\n`;
          text += `   📖 *${ex.subjects?.name}* — ${ex.lesson_period}. Ders Saati\n`;
          if (ex.notes) {
            text += `   ℹ️ _${ex.notes}_\n`;
          }
        });
        text += `\n`;
      }
    });

    if (period.notes) {
      text += `📌 *Önemli Not:*\n${period.notes}\n\n`;
    }
    text += `✨ _Tüm öğrencilerimize başarılar dileriz._`;

    return text;
  }

  const generatedText = generateText();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      toast("WhatsApp metni panoya kopyalandı!", "success");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast("Kopyalama başarısız oldu, metni manuel seçebilirsiniz", "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="max-w-xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                WhatsApp Veli Grubu Duyuru Metni
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Tek tıkla kopyalayıp veli veya zümre gruplarına gönderebilirsiniz.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Kademe Filtresi */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Kapsam:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedGrade("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                selectedGrade === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tüm Sınıflar
            </button>
            {gradeLevels.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGrade(String(g))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  selectedGrade === String(g)
                    ? "bg-primary text-primary-foreground"
                    : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
                }`}
              >
                {g}. Sınıflar
              </button>
            ))}
          </div>
        </div>

        {/* Önizleme Kutusu */}
        <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-sans text-xs whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto border border-slate-800 selection:bg-emerald-500">
          {generatedText}
        </pre>

        {/* Butonlar */}
        <div className="pt-2 flex items-center justify-between border-t border-border">
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
            onClick={handleCopy}
            className="h-9 px-4 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1.5 text-white" />
                Kopyalandı!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1.5" />
                Metni Kopyala
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
