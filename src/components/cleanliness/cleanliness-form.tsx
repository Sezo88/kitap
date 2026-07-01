"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CheckCircle2, AlertCircle, Save, Info, Lock } from "lucide-react";
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

  const today = new Date(new Date().getTime() + 3 * 3600 * 1000).toISOString().split("T")[0];

  // Seçilen sınıfın bugün puanı var mı kontrol et
  const classScores = localScores.filter((s) => s.class_id === selectedClassId);
  const isAlreadyScored = classScores.length > 0;

  // Seçilen sınıf değiştiğinde puanları doldur veya sıfırla
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
  }, [selectedClassId, isAlreadyScored]);

  // Hangi sınıfların bugün puanlandığı eşleştirmesi
  const scoredClassIds = new Set(localScores.map((s) => s.class_id));

  const handleScoreChange = (criteriaId: string, score: number) => {
    if (isAlreadyScored) return; // Kilitliyse değiştirme
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
      score_date: today,
      score: scores[c.id],
      marked_by: userId,
    }));

    const { data, error } = await supabase
      .from("cleanliness_scores")
      .insert(payload)
      .select();

    if (error) {
      toast("Puanlar kaydedilirken hata oluştu: " + error.message, "error");
    } else {
      toast("Puanlar başarıyla kaydedildi", "success");
      if (data) {
        setLocalScores((prev) => [...prev, ...(data as CleanlinessScore[])]);
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
              <p className="text-xs text-muted-foreground mt-1">
                Tarih: {new Date(today).toLocaleDateString("tr-TR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            {isAlreadyScored && (
              <Badge variant="destructive" className="gap-1 bg-red-100 text-red-700 hover:bg-red-100 border-red-300">
                <Lock className="h-3 w-3" /> Kilitli (Bugün Puanlandı)
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {isAlreadyScored && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Puanlama Tamamlanmış</p>
                  <p className="text-xs mt-0.5 text-yellow-700">Bu sınıfın bugünkü puan girişi nöbetçi öğretmen tarafından yapılmıştır. Puanlar kilitlidir.</p>
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
                            disabled={isAlreadyScored}
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
                {!isAlreadyScored && (
                  <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                    <Save className="h-4 w-4 mr-1" /> {saving ? "Kaydediliyor..." : "Puanları Kaydet"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
