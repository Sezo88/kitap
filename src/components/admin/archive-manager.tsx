"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Archive, AlertTriangle, CheckCircle2, Clock, Calendar, ArrowRight } from "lucide-react";

interface Season {
  id: string;
  name: string;
  archived_at: string;
  created_by: string;
  profiles?: { full_name: string } | null;
}

interface Props {
  schoolId: string;
  userId: string;
  initialSeasons: Season[];
}

export function ArchiveManager({ schoolId, userId, initialSeasons }: Props) {
  const [seasons, setSeasons] = useState<Season[]>(initialSeasons);
  const [dialogStep, setDialogStep] = useState<0 | 1 | 2>(0); // 0=kapali, 1=uyari, 2=onay
  const [seasonName, setSeasonName] = useState(getDefaultSeasonName());
  const [archiving, setArchiving] = useState(false);
  const { toast } = useToast();

  // Arşivlenen veriler sistemde birikmiş olan biten/geçen sezona aittir.
  // Örneğin 2026 yılı Eylül ayında yapılan arşivleme 2025-2026 verileridir.
  function getDefaultSeasonName(): string {
    const now = new Date();
    const year = now.getFullYear();
    return `${year - 1}-${year}`;
  }

  function getNewSeasonName(archiveName: string): string {
    const parts = archiveName.split("-").map((p) => parseInt(p.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return `${parts[1]}-${parts[1] + 1}`;
    }
    const year = new Date().getFullYear();
    return `${year}-${year + 1}`;
  }

  const currentYear = new Date().getFullYear();
  const quickOptions = [
    `${currentYear - 2}-${currentYear - 1}`,
    `${currentYear - 1}-${currentYear}`,
    `${currentYear}-${currentYear + 1}`,
  ];

  function openArchive() {
    if (!seasonName.trim()) {
      toast("Lütfen arşivlenecek sezon adını girin.", "error");
      return;
    }
    setDialogStep(1);
  }

  async function handleArchive() {
    const trimmedName = seasonName.trim();
    if (!trimmedName) {
      toast("Sezon adı boş olamaz.", "error");
      return;
    }

    setArchiving(true);
    const supabase = createClient();

    // 1. Sezon kaydini olustur
    const { data: season, error: seasonError } = await supabase
      .from("archive_seasons")
      .insert({
        school_id: schoolId,
        name: trimmedName,
        created_by: userId,
      })
      .select()
      .single();

    if (seasonError) {
      toast("Sezon olusturma hatasi: " + seasonError.message, "error");
      setArchiving(false);
      setDialogStep(0);
      return;
    }

    // 2. Tum aktivite tablolarinda season_name NULL olanlari guncelle
    const tables = [
      "reading_logs",
      "attendance_logs",
      "student_projects",
      "cleanliness_scores",
      "sms_logs",
    ];

    let totalUpdated = 0;
    for (const table of tables) {
      const { error, count } = await supabase
        .from(table)
        .update({ season_name: trimmedName }, { count: "exact" })
        .is("season_name", null);

      if (!error && count) totalUpdated += count;
    }

    if (season) setSeasons((prev) => [...prev, season as Season]);
    toast(
      `"${trimmedName}" sezonu arşivlendi! ${totalUpdated} kayıt arşive kaldırıldı. Yeni sezon (${getNewSeasonName(trimmedName)}) başladı.`,
      "success"
    );
    setArchiving(false);
    setDialogStep(0);
  }

  return (
    <div className="space-y-6">
      {/* Arşivle Butonu & Ayarı */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <Archive className="h-5 w-5" />
            Sezon Arşivleme
          </CardTitle>
          <CardDescription className="text-amber-700">
            Tüm öğrenci aktivitelerini (okuma takip, yoklama, projeler, temiz sınıf, SMS) belirleyeceğiniz sezona arşivleyip
            yeni sezona temiz bir başlangıç yapabilirsiniz. Öğrenciler, sınıflar, öğretmenler ve ders programı korunur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-2">
            <Label htmlFor="season-name-input" className="text-sm font-semibold text-amber-950">
              Arşivlenecek Sezon Adı (Mevcut Veriler):
            </Label>
            <Input
              id="season-name-input"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              placeholder="Örn: 2025-2026"
              className="bg-white border-amber-300 focus-visible:ring-amber-500 font-semibold"
            />
            {/* Hızlı Seçim Butonları */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-xs text-amber-800 font-medium">Önerilenler:</span>
              {quickOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSeasonName(opt)}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                    seasonName === opt
                      ? "bg-amber-600 text-white border-amber-600 font-bold"
                      : "bg-white text-amber-900 border-amber-300 hover:bg-amber-100"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-white/90 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start sm:items-center gap-2 max-w-xl">
            <Calendar className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div className="space-y-0.5">
              <div>Mevcut kayıtlar <strong>&quot;{seasonName || "..."}&quot;</strong> sezonu olarak mühürlenecektir.</div>
              <div className="text-muted-foreground flex items-center gap-1">
                <span>Arşivleme sonrası aktif sistem:</span>
                <strong className="text-amber-700">{getNewSeasonName(seasonName)}</strong>
                <ArrowRight className="h-3 w-3 inline text-emerald-600" />
                <span className="text-emerald-700 font-medium">Sıfırdan temiz başlar</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={openArchive} 
            variant="default" 
            size="lg" 
            disabled={!seasonName.trim()}
            className="bg-amber-600 hover:bg-amber-700 font-semibold"
          >
            <Archive className="h-4 w-4 mr-2" />
            {seasonName.trim() ? `"${seasonName}" Sezonunu Arşivle` : "Sezonu Arşivle"}
          </Button>
        </CardContent>
      </Card>

      {/* Gecmis Sezonlar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Arşivlenmiş Sezonlar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {seasons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Henüz arşivlenmiş bir sezon yok.
            </p>
          ) : (
            <div className="space-y-2">
              {seasons.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                >
                  <div>
                    <p className="font-semibold text-sm">{s.name} Sezonu</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.archived_at).toLocaleDateString("tr-TR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Arşivlendi
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* === DİALOG: 1. UYARI === */}
      <Dialog open={dialogStep === 1} onOpenChange={(open) => !open && setDialogStep(0)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Dikkat! Sezon Arşivleme
          </DialogTitle>
          <DialogDescription>
            Mevcut verileri <strong>&quot;{seasonName}&quot;</strong> sezonuna arşivlemek ve <strong>&quot;{getNewSeasonName(seasonName)}&quot;</strong> sezonuna geçmek üzeresiniz.
          </DialogDescription>
        </DialogHeader>
        <DialogClose onClick={() => setDialogStep(0)} />
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="dialog-season-input" className="text-xs text-muted-foreground">Arşiv Sezon Adı:</Label>
            <Input
              id="dialog-season-input"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              className="font-semibold text-sm"
              placeholder="2025-2026"
            />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <p className="font-semibold mb-1">Bu işlem sonucunda:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Tüm okuma takip kayıtları <strong>&quot;{seasonName}&quot;</strong> sezonuna mühürlenecek</li>
              <li>Tüm yoklama kayıtları bu sezona arşivlenecek</li>
              <li>Temiz sınıf puanları arşivlenecek</li>
              <li>Proje atamaları arşivlenecek</li>
              <li>SMS geçmişi arşivlenecek</li>
              <li>Öğrenciler, sınıflar, öğretmenler, dersler <strong>korunacak</strong></li>
              <li>Sistem <strong>&quot;{getNewSeasonName(seasonName)}&quot;</strong> sezonuna tertemiz başlayacak</li>
            </ul>
          </div>
          <p className="text-sm font-semibold text-red-600">
            Bu işlem geri alınamaz! Devam etmek istediğinize emin misiniz?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogStep(0)}>İptal</Button>
            <Button 
              variant="default" 
              onClick={() => setDialogStep(2)} 
              disabled={!seasonName.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Evet, Devam Et
            </Button>
          </div>
        </div>
      </Dialog>

      {/* === DİALOG: 2. SON ONAY === */}
      <Dialog open={dialogStep === 2} onOpenChange={(open) => !open && setDialogStep(0)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Son Onay — Geri Alınamaz!
          </DialogTitle>
          <DialogDescription>
            Bu son uyarıdır. Mevcut verileri &quot;{seasonName}&quot; sezonuna arşivlemek için aşağıdaki butona basın.
          </DialogDescription>
        </DialogHeader>
        <DialogClose onClick={() => setDialogStep(0)} />
        <div className="mt-4 space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-500 mb-2" />
            <p className="text-sm font-bold text-red-700">
              Bu işlem geri alınamaz!
            </p>
            <p className="text-xs text-red-600 mt-1">
              Tüm mevcut aktivite kayıtları &quot;{seasonName}&quot; sezonuna taşınacak ve yeni sezon ({getNewSeasonName(seasonName)}) sıfırdan başlayacak.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogStep(0)}>İptal</Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiving || !seasonName.trim()}>
              {archiving ? "Arşivleniyor..." : `"${seasonName}" Sezonunu Arşivle`}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
