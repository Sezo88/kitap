"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Archive, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

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

  function getDefaultSeasonName(): string {
    const now = new Date();
    const year = now.getFullYear();
    // Eylul-Aralik: yeni sezon baslangici
    // Ocak-Haziran: onceki yil-bu yil
    if (now.getMonth() >= 8) {
      return `${year}-${year + 1}`;
    }
    return `${year - 1}-${year}`;
  }

  function openArchive() {
    setSeasonName(getDefaultSeasonName());
    setDialogStep(1);
  }

  async function handleArchive() {
    setArchiving(true);
    const supabase = createClient();

    // 1. Sezon kaydini olustur
    const { data: season, error: seasonError } = await supabase
      .from("archive_seasons")
      .insert({
        school_id: schoolId,
        name: seasonName,
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
        .update({ season_name: seasonName }, { count: "exact" })
        .is("season_name", null);

      if (!error && count) totalUpdated += count;
    }

    if (season) setSeasons((prev) => [...prev, season as Season]);
    toast(
      `"${seasonName}" sezonu arsivlendi! ${totalUpdated} kayit arsive kaldirildi.`,
      "success"
    );
    setArchiving(false);
    setDialogStep(0);
  }

  return (
    <div className="space-y-6">
      {/* Arşivle Butonu */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <Archive className="h-5 w-5" />
            Sezon Arşivleme
          </CardTitle>
          <CardDescription className="text-amber-700">
            Tum ogrenci aktivitelerini (okuma takip, yoklama, projeler, temiz sinif, SMS) bu sezona arsivleyip
            yeni sezona temiz bir baslangic yapabilirsiniz. Ogrenciler, siniflar, ogretmenler ve diger ayarlar korunur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={openArchive} variant="default" size="lg" className="bg-amber-600 hover:bg-amber-700">
            <Archive className="h-4 w-4 mr-2" />
            {getDefaultSeasonName()} Sezonunu Arşivle
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
              Henuz arsivlenmis bir sezon yok.
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

      {/* === DİALOG: 1. UYARI === */}
      <Dialog open={dialogStep === 1} onOpenChange={(open) => !open && setDialogStep(0)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Dikkat! Sezon Arşivleme
          </DialogTitle>
          <DialogDescription>
            <strong>&quot;{seasonName}&quot;</strong> sezonu için arşivleme yapmak üzeresiniz.
          </DialogDescription>
        </DialogHeader>
        <DialogClose onClick={() => setDialogStep(0)} />
        <div className="mt-4 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <p className="font-semibold mb-1">Bu islem sonucunda:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Tum okuma takip kayitlari bu sezona arsivlenecek</li>
              <li>Tum yoklama kayitlari bu sezona arsivlenecek</li>
              <li>Temiz sinif puanlari arsivlenecek</li>
              <li>Proje atamalari arsivlenecek</li>
              <li>SMS gecmisi arsivlenecek</li>
              <li>Ogrenciler, siniflar, ogretmenler, dersler <strong>korunacak</strong></li>
            </ul>
          </div>
          <p className="text-sm font-semibold text-red-600">
            Bu işlem geri alınamaz! Devam etmek istediğinize emin misiniz?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogStep(0)}>Iptal</Button>
            <Button variant="default" onClick={() => setDialogStep(2)} className="bg-amber-600 hover:bg-amber-700">
              Evet, Devam Et
            </Button>
          </div>
        </div>
      </Dialog>

      {/* === DİALOG: 2. SON ONAY === */}
      <Dialog open={dialogStep === 2} onOpenChange={(open) => !open && setDialogStep(0)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Son Onay — Geri Alınamaz!
          </DialogTitle>
          <DialogDescription>
            Bu son uyaridir. &quot;{seasonName}&quot; sezonunu arsivlemek icin lutfen asagidaki butona basin.
          </DialogDescription>
        </DialogHeader>
        <DialogClose onClick={() => setDialogStep(0)} />
        <div className="mt-4 space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-500 mb-2" />
            <p className="text-sm font-bold text-red-700">
              Bu islem geri alinamaz!
            </p>
            <p className="text-xs text-red-600 mt-1">
              Tum mevcut aktivite kayitlari &quot;{seasonName}&quot; sezonuna tasinacak ve yeni sezon sifirdan baslayacak.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogStep(0)}>Iptal</Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiving}>
              {archiving ? "Arsivleniyor..." : `"${seasonName}" Sezonunu Arşivle`}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
