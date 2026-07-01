"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CheckCircle2, Save, Info } from "lucide-react";
import type { CleanlinessCriteria, CleanlinessScore } from "@/lib/types/database";

interface ClassRow {
  id: string;
  name: string;
  school_id: string;
}

interface Props {
  classes: ClassRow[];
  criterias: CleanlinessCriteria[];
  todayScores: CleanlinessScore[];
  userId: string;
}

export function CleanlinessForm({ classes, criterias, todayScores, userId }: Props) {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [localScores, setLocalScores] = useState<CleanlinessScore[]>(todayScores);
  const { toast } = useToast();

  // Bu haftanın Pazartesi gününü hesapla
  function getMondayOfCurrentWeek(): string {
    const now = new Date(new Date().getTime() + 3 * 3600 * 1000);
    const day = now.getDay(); // 0=Pazar, 1=Pazartesi, ...
    const diff = day === 0 ? 6 : day - 1; // Pazartesiye kaç gün geri gidilecek
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return monday.toISOString().split("T")[0];
  }

  const today = new Date(new Date().getTime() + 3 * 3600 * 1000).toISOString().split("T")[0];
  const mondayOfWeek = getMondayOfCurrentWeek();

  const [selectedDate, setSelectedDate] = useState(today);

  // Seçilen sınıfın seçili tarihte puanı var mı kontrol et
  const classScores = localScores.filter((s) => s.class_id === selectedClassId && s.score_date === selectedDate);
  const isAlreadyScored = classScores.length > 0;

  // Tarih veya sınıf değiştiğinde puanları doldur veya sıfırla
  useEffect(() => {
    if (isAlreadyScored) {
      const initialScores: Record<string, number> = {};
      classScores.forEach((s) => {
        initialScores[s.criteria_id] = s.score;
      });
      setScores(initialScores);
    } else {
      // Varsayılan olarak tüm kriterlere 5 puan seçelim (kolaylık olsun)
      const defaultScores: Record<string, number> = {};
      criterias.forEach((c) => {
        defaultScores[c.id] = 5;
      });
      setScores(defaultScores);
    }
  }, [selectedClassId, isAlreadyScored, selectedDate]);

  // Tarih değiştiğinde o tarihe ait puanları çek
  useEffect(() => {
    async function fetchScoresForDate() {
      const supabase = createClient();
      const classIds = classes.map((c) => c.id);
      if (classIds.length === 0) return;
      const { data } = await supabase
        .from("cleanliness_scores")
        .select("*")
        .eq("score_date", selectedDate)
        .in("class_id", classIds);
      if (data) {
        setLocalScores(data as CleanlinessScore[]);
      }
    }
    fetchScoresForDate();
  }, [selectedDate, classes]);

  // Hangi sınıfların seçili tarihte puanlandığı eşleştirmesi
  const scoredClassIds = new Set(localScores.filter((s) => s.score_date === selectedDate).map((s) => s.class_id));

  const handleScoreChange = (criteriaId: string, score: number) => {
    setScores((prev) => ({ ...prev, [criteriaId]: score }));
  };

  const handleSave = async () => {
    // Tüm kriterlerin puanlandığından emin ol
    const missing = criterias.filter((c) => !scores[c.id]);
    if (missing.length > 0) {
      toast("Lütfen tüm kriterleri puanlayın", "error");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const payload = criterias.map((c) => ({
      class_id: selectedClassId,
      criteria_id: c.id,
      score_date: selectedDate,
      score: scores[c.id],
      marked_by: userId,
    }));

    const { data, error } = await supabase
      .from("cleanliness_scores")
      .upsert(payload, { onConflict: "class_id, criteria_id, score_date" })
      .select();

    if (error) {
      toast("Puanlar kaydedilirken hata oluştu: " + error.message, "error");
    } else {
      toast(isAlreadyScored ? "Puanlar başarıyla güncellendi" : "Puanlar başarıyla kaydedildi", "success");
      if (data) {
        setLocalScores((prev) => {
          const filtered = prev.filter(
            (s) => !(s.class_id === selectedClassId && s.score_date === selectedDate)
          );
          return [...filtered, ...(data as CleanlinessScore[])];
        });
      }
    }
    setSaving(false);
  };

  const totalScore = Object.values(scores).reduce((sum, val) => sum + val, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Sınıf Seçim Listesi (Dikey) */}
      <div className="md:col-span-1 space-y-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Sınıf Seçin</span>
              <Badge variant="secondary">{classes.length} Sınıf</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 max-h-[500px] overflow-y-auto space-y-1">
            {classes.map((c) => {
              const scored = scoredClassIds.has(c.id);
              const active = c.id === selectedClassId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassId(c.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left text-sm transition-all ${
                    active
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span>{c.name}</span>
                  {scored ? (
                    <Badge variant={active ? "default" : "success"} className="gap-1 bg-green-500/20 text-green-700 hover:bg-green-500/20 border-green-300">
                      <CheckCircle2 className="h-3 w-3" /> Puanlandı
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-muted-foreground/30 text-muted-foreground">
                      ⏳ Bekliyor
                    </Badge>
                  )}
                </button>
              );
            })}
            {classes.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">Sınıf bulunamadı</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Puanlama Formu */}
      <div className="md:col-span-2 space-y-4">
        <Card className="shadow-sm border-t-4 border-t-primary">
          <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span>{classes.find((c) => c.id === selectedClassId)?.name || "Seçili Sınıf"} Puan tablosu</span>
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Tarih:</span>
                <input
                  type="date"
                  value={selectedDate}
                  min={mondayOfWeek}
                  max={today}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs border rounded-md px-2 py-1 bg-background"
                />
                <span className="text-xs text-muted-foreground">
                  ({new Date(selectedDate).toLocaleDateString("tr-TR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
                </span>
              </div>
            </div>
            {isAlreadyScored && (
              <Badge variant="success" className="gap-1 bg-green-100 text-green-700 hover:bg-green-100 border-green-300">
                <CheckCircle2 className="h-3 w-3" /> Puanlandı (Düzenlenebilir)
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {isAlreadyScored && (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Bu Tarihe Ait Puanlar Yüklendi</p>
                  <p className="text-xs mt-0.5 text-green-700">Bu sınıfın seçili tarihe ait puanları daha önce girilmiştir. Puanlar üzerinde değişiklik yapıp tekrar kaydedebilirsiniz.</p>
                </div>
              </div>
            )}

            {/* Hafta başından eskiye gitme uyarısı */}
            {selectedDate < mondayOfWeek && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Geçersiz Tarih</p>
                  <p className="text-xs mt-0.5 text-amber-700">Sadece bu haftanın Pazartesi gününden ({new Date(mondayOfWeek).toLocaleDateString("tr-TR")}) itibaren puan girişi yapabilirsiniz.</p>
                </div>
              </div>
            )}

            {/* Kriter Kartları (Alt Alta) */}
            <div className="space-y-4">
              {criterias.map((c) => {
                const currentScore = scores[c.id] || 0;
                return (
                  <div key={c.id} className="p-4 rounded-xl border bg-card/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-card transition-colors">
                    <span className="font-medium text-sm text-foreground">{c.name}</span>
                    
                    {/* 1-5 Şık Puan Butonları */}
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isSelected = currentScore === val;
                        return (
                          <button
                            key={val}
                            onClick={() => handleScoreChange(c.id, val)}
                            className={`w-9 h-9 rounded-full text-xs font-bold transition-all flex items-center justify-center border ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-sm scale-110"
                                : "bg-background hover:bg-muted border-input text-foreground disabled:opacity-50"
                            }`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {criterias.length === 0 && (
                <div className="text-center text-muted-foreground py-8">Kriter bulunamadı. Lütfen SQL scriptini Supabase'de çalıştırın.</div>
              )}
            </div>

            {/* Toplam Skor & Kaydet */}
            {criterias.length > 0 && (
              <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  Toplam Puan: <span className="text-xl font-bold text-primary">{totalScore}</span> / 25
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  <Save className="h-4 w-4 mr-1" /> {saving ? "Kaydediliyor..." : isAlreadyScored ? "Puanları Güncelle" : "Puanları Kaydet"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
