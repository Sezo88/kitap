"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, Calendar, Sparkles, Trophy, ListOrdered, BarChart2, Star } from "lucide-react";
import * as XLSX from "xlsx";

interface ClassRow { id: string; name: string; school_id: string; }
interface CriteriaRow { id: string; name: string; school_id: string; }
interface Props {
  classes: ClassRow[];
  criterias: CriteriaRow[];
  schoolFilter: { school_id?: string };
}

// Tarihin ISO Hafta ve Yıl bilgisini döndüren yardımcı fonksiyon
function getISOWeek(dateStr: string) {
  const date = new Date(dateStr);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

// Seçilen tarihin pazartesi ve cuma gününü veren yardımcı fonksiyon
function getWeekRange(date: Date) {
  const day = date.getDay();
  const diffToMon = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diffToMon));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    monday: monday.toISOString().split("T")[0],
    friday: friday.toISOString().split("T")[0],
  };
}

export function CleanlinessReportClient({ classes, criterias, schoolFilter }: Props) {
  // Varsayılan olarak içinde bulunduğumuz haftayı seçelim
  const [selectedWeekDate, setSelectedWeekDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  
  const [loading, setLoading] = useState(true);
  const [scoresData, setScoresData] = useState<any[]>([]);

  // Seçilen haftanın pazartesi ve cuma tarih aralığı
  const { monday, friday } = useMemo(() => {
    return getWeekRange(new Date(selectedWeekDate));
  }, [selectedWeekDate]);

  useEffect(() => {
    fetchScores();
  }, [schoolFilter.school_id]);

  async function fetchScores() {
    setLoading(true);
    const supabase = createClient();

    // Tüm zamanların puanlarını çek (aylık ve yıllık liderliği hesaplayabilmek için)
    let query = supabase
      .from("cleanliness_scores")
      .select("class_id, criteria_id, score_date, score, classes!inner(name)");

    if (schoolFilter.school_id) {
      query = query.eq("classes.school_id", schoolFilter.school_id);
    }

    const { data, error } = await query;
    if (data) {
      setScoresData(data);
    }
    setLoading(false);
  }

  // ── 1. SEÇİLEN HAFTANIN PUAN TABLOSU VE BİRİNCİSİ ───────────────────
  const weeklyReport = useMemo(() => {
    const weekScores = scoresData.filter(
      (s) => s.score_date >= monday && s.score_date <= friday
    );

    // Her sınıf için günlük toplam puanları topla
    // classId -> date -> sum_score
    const classDailyScores = new Map<string, Map<string, number>>();
    // classId -> criteriaId -> total_score
    const classCriteriaScores = new Map<string, Map<string, number>>();

    weekScores.forEach((s) => {
      // Günlük puanlama toplamı
      if (!classDailyScores.has(s.class_id)) {
        classDailyScores.set(s.class_id, new Map());
      }
      const dayMap = classDailyScores.get(s.class_id)!;
      dayMap.set(s.score_date, (dayMap.get(s.score_date) || 0) + s.score);

      // Kriter bazlı toplamı
      if (!classCriteriaScores.has(s.class_id)) {
        classCriteriaScores.set(s.class_id, new Map());
      }
      const critMap = classCriteriaScores.get(s.class_id)!;
      critMap.set(s.criteria_id, (critMap.get(s.criteria_id) || 0) + s.score);
    });

    // Sonuçları sınıflarla eşleştir
    const list = classes.map((c) => {
      const dayMap = classDailyScores.get(c.id) || new Map<string, number>();
      
      // Pazartesi'den Cuma'ya günlerin puanlarını çıkar
      const dailyPoints: Record<string, number | null> = {};
      let total = 0;
      let scoredDaysCount = 0;

      const daysOfWeek = [];
      const curr = new Date(monday);
      for (let i = 0; i < 5; i++) {
        daysOfWeek.push(curr.toISOString().split("T")[0]);
        curr.setDate(curr.getDate() + 1);
      }

      daysOfWeek.forEach((d) => {
        const val = dayMap.get(d);
        if (val !== undefined) {
          dailyPoints[d] = val;
          total += val;
          scoredDaysCount++;
        } else {
          dailyPoints[d] = null;
        }
      });

      return {
        class_id: c.id,
        class_name: c.name,
        pazartesi: dailyPoints[daysOfWeek[0]],
        sali: dailyPoints[daysOfWeek[1]],
        carsamba: dailyPoints[daysOfWeek[2]],
        persembe: dailyPoints[daysOfWeek[3]],
        cuma: dailyPoints[daysOfWeek[4]],
        total_score: scoredDaysCount > 0 ? total : 0,
        scored_days_count: scoredDaysCount
      };
    }).sort((a, b) => b.total_score - a.total_score);

    // O haftanın en az bir gün puanlanmış ve en yüksek puana sahip sınıfını bul
    const activeList = list.filter((l) => l.scored_days_count > 0);
    const winner = activeList.length > 0 ? activeList[0] : null;

    return { list, winner };
  }, [scoresData, monday, friday, classes]);

  // ── 2. AYLIK VE YILLIK LİDERLİK TABLOSU (TÜM ZAMANLARDA EN ÇOK 1. OLANLAR) ──
  const leadershipBoard = useMemo(() => {
    // 1. Tüm puan verilerini ISO haftalarına göre grupla
    // key: "year-week" -> classId -> total_score
    const weekTotals = new Map<string, Map<string, { total: number; scoredDays: number }>>();

    scoresData.forEach((s) => {
      const { year, week } = getISOWeek(s.score_date);
      const key = `${year}-${week}`;

      if (!weekTotals.has(key)) {
        weekTotals.set(key, new Map());
      }
      const classMap = weekTotals.get(key)!;
      if (!classMap.has(s.class_id)) {
        classMap.set(s.class_id, { total: 0, scoredDays: 0 });
      }
      const val = classMap.get(s.class_id)!;
      
      // Her (class, date) için puanı topla
      val.total += s.score;
    });

    // 2. Her haftanın birincisini hesapla
    // classId -> win_count
    const winCounts = new Map<string, number>();

    weekTotals.forEach((classMap, weekKey) => {
      let maxScore = -1;
      let winnerClassId = "";

      classMap.forEach((info, classId) => {
        if (info.total > maxScore) {
          maxScore = info.total;
          winnerClassId = classId;
        }
      });

      if (winnerClassId) {
        winCounts.set(winnerClassId, (winCounts.get(winnerClassId) || 0) + 1);
      }
    });

    // Sınıflara göre sırala
    const board = classes.map((c) => ({
      class_id: c.id,
      class_name: c.name,
      wins: winCounts.get(c.id) || 0,
    })).sort((a, b) => b.wins - a.wins);

    const ultimateWinner = board.length > 0 && board[0].wins > 0 ? board[0] : null;

    return { board, ultimateWinner };
  }, [scoresData, classes]);

  // ── 3. KRİTER ANALİZİ (OKUL GENELİNDE HANGİ KRİTER NE DURUMDA) ────────
  const criteriaAnalysis = useMemo(() => {
    // criteriaId -> { sum: number, count: number }
    const critTotals = new Map<string, { sum: number; count: number }>();

    scoresData.forEach((s) => {
      if (!critTotals.has(s.criteria_id)) {
        critTotals.set(s.criteria_id, { sum: 0, count: 0 });
      }
      const val = critTotals.get(s.criteria_id)!;
      val.sum += s.score;
      val.count++;
    });

    return criterias.map((c) => {
      const stats = critTotals.get(c.id);
      const avg = stats && stats.count > 0 ? parseFloat((stats.sum / stats.count).toFixed(2)) : 0;
      return {
        id: c.id,
        name: c.name,
        average: avg,
        total_evaluations: stats?.count || 0
      };
    }).sort((a, b) => b.average - a.average);
  }, [scoresData, criterias]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    
    // 1. Haftalık Tablo
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weeklyReport.list.map((r) => ({
      Sınıf: r.class_name,
      Pazartesi: r.pazartesi ?? "—",
      Salı: r.sali ?? "—",
      Çarşamba: r.carsamba ?? "—",
      Perşembe: r.persembe ?? "—",
      Cuma: r.cuma ?? "—",
      "Haftalık Toplam": r.total_score
    }))), "Haftalık Puan Durumu");

    // 2. Genel Liderlik
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leadershipBoard.board.map((b) => ({
      Sınıf: b.class_name,
      "Haftalık Birincilik Sayısı": b.wins
    }))), "Genel Liderlik");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "binary" });
    const buf = new ArrayBuffer(wbout.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < wbout.length; i++) {
      view[i] = wbout.charCodeAt(i) & 0xFF;
    }
    
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `temiz-sinif-raporu-${monday}_${friday}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* ── Tarih Filtresi ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground shrink-0">Hafta Seç (Herhangi bir gün):</span>
          <Input type="date" value={selectedWeekDate} onChange={(e) => setSelectedWeekDate(e.target.value)} className="w-auto" />
        </div>
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded-lg">
          Seçilen Hafta Aralığı: <span className="font-semibold text-foreground">{new Date(monday).toLocaleDateString("tr-TR")}</span> - <span className="font-semibold text-foreground">{new Date(friday).toLocaleDateString("tr-TR")}</span>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel} disabled={loading} className="sm:ml-auto">
          <Download className="h-4 w-4 mr-1" /> Excel İndir
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground animate-pulse">Veriler yükleniyor...</div>
      ) : (
        <>
          {/* ── Haftalık Kazanan Kartı (Şampiyon) ────────────────────── */}
          {weeklyReport.winner ? (
            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-amber-100 rounded-full border border-amber-200 shrink-0">
                    <Trophy className="h-8 w-8 text-amber-600 animate-bounce" />
                  </div>
                  <div>
                    <Badge variant="warning" className="bg-amber-600 text-white border-amber-500 mb-1">👑 HAFTANIN ŞAMPİYONU</Badge>
                    <h3 className="text-xl sm:text-2xl font-bold text-amber-950">{weeklyReport.winner.class_name} Sınıfı</h3>
                    <p className="text-sm text-amber-800/80 mt-1">
                      Bu hafta toplamda <span className="font-bold text-amber-900">{weeklyReport.winner.total_score}</span> puan alarak serbest kıyafet ödülünü kazandı! 🎉
                    </p>
                  </div>
                </div>
                <div className="bg-white/80 border border-amber-200/50 px-4 py-3 rounded-xl text-center shrink-0">
                  <div className="text-xs text-amber-800 font-medium">Toplam Puanı</div>
                  <div className="text-3xl font-extrabold text-amber-600">{weeklyReport.winner.total_score}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{weeklyReport.winner.scored_days_count} gün üzerinden</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-muted/50 border border-dashed text-center py-8">
              <CardContent className="space-y-2">
                <Sparkles className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                <h3 className="font-semibold text-muted-foreground">Bu Hafta Henüz Puanlama Yapılmamış</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">Seçtiğiniz haftaya ait sınıfların temizlik puan kayıtları henüz girilmemiştir.</p>
              </CardContent>
            </Card>
          )}

          {/* ── Sekmeler ─────────────────────────────────────────── */}
          <Tabs defaultValue="weekly">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="weekly"><ListOrdered className="h-3.5 w-3.5 mr-1" />Haftalık Puan Durumu</TabsTrigger>
              <TabsTrigger value="leadership"><Trophy className="h-3.5 w-3.5 mr-1" />En Çok Birinci Olanlar</TabsTrigger>
              <TabsTrigger value="criterias"><BarChart2 className="h-3.5 w-3.5 mr-1" />Kriter Analizi</TabsTrigger>
            </TabsList>

            {/* ── TAB: HAFTALIK PUAN DURUMU ────────────────────────── */}
            <TabsContent value="weekly">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Sınıfların Günlük & Haftalık Puan Tablosu</CardTitle>
                  <CardDescription>Pazartesi - Cuma günleri alınan 25 puan üzerinden günlük puanların toplamı</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sınıf</TableHead>
                        <TableHead className="text-center">Pazartesi</TableHead>
                        <TableHead className="text-center">Salı</TableHead>
                        <TableHead className="text-center">Çarşamba</TableHead>
                        <TableHead className="text-center">Perşembe</TableHead>
                        <TableHead className="text-center">Cuma</TableHead>
                        <TableHead className="text-center font-bold">Toplam Puan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weeklyReport.list.map((row, i) => (
                        <TableRow key={row.class_id} className={i === 0 && row.scored_days_count > 0 ? "bg-amber-50/50 font-medium" : ""}>
                          <TableCell className="font-semibold flex items-center gap-2">
                            {row.class_name}
                            {i === 0 && row.scored_days_count > 0 && <span title="Birinci">👑</span>}
                          </TableCell>
                          <TableCell className="text-center">{row.pazartesi ?? <span className="text-muted-foreground/40">—</span>}</TableCell>
                          <TableCell className="text-center">{row.sali ?? <span className="text-muted-foreground/40">—</span>}</TableCell>
                          <TableCell className="text-center">{row.carsamba ?? <span className="text-muted-foreground/40">—</span>}</TableCell>
                          <TableCell className="text-center">{row.persembe ?? <span className="text-muted-foreground/40">—</span>}</TableCell>
                          <TableCell className="text-center">{row.cuma ?? <span className="text-muted-foreground/40">—</span>}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={row.total_score > 0 ? "default" : "outline"} className={row.total_score > 0 ? "bg-primary font-bold" : "text-muted-foreground/40"}>
                              {row.total_score > 0 ? `${row.total_score} Puan` : "Girilmemiş"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── TAB: EN ÇOK BİRİNCİ OLANLAR (LİDERLİK TABLOSU) ───────── */}
            <TabsContent value="leadership">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Liderlik Kartı */}
                {leadershipBoard.ultimateWinner ? (
                  <Card className="md:col-span-1 border-amber-200 bg-gradient-to-b from-amber-50/50 to-orange-50/20">
                    <CardHeader className="text-center pb-2">
                      <div className="w-16 h-16 bg-amber-100 border border-amber-200 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Trophy className="h-8 w-8" />
                      </div>
                      <CardTitle className="text-base font-bold">Tüm Zamanların En Temizi</CardTitle>
                      <CardDescription>Okul genelinde en çok haftalık birincilik kazanan sınıf</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                      <div>
                        <h4 className="text-2xl font-black text-amber-950">{leadershipBoard.ultimateWinner.class_name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">Liderlik tahtasının zirvesinde yer alıyor.</p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-amber-200 rounded-full shadow-sm">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-bold text-amber-950">{leadershipBoard.ultimateWinner.wins} Kez Şampiyon</span>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="md:col-span-1 text-center py-10">
                    <CardContent className="text-muted-foreground text-sm">Henüz birincilik kaydı bulunmamaktadır.</CardContent>
                  </Card>
                )}

                {/* Sıralama Tablosu */}
                <Card className="md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Haftalık Birincilik Liderlik Tablosu</CardTitle>
                    <CardDescription>Sınıfların haftalık en yüksek puanı alıp 1. olma sayıları</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Sıra</TableHead>
                          <TableHead>Sınıf</TableHead>
                          <TableHead className="text-center">Kazanılan Hafta Sayısı</TableHead>
                          <TableHead className="text-right">Durum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leadershipBoard.board.map((row, i) => (
                          <TableRow key={row.class_id}>
                            <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-semibold">{row.class_name}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={row.wins > 0 ? "secondary" : "outline"} className={row.wins > 0 ? "font-bold text-amber-700 bg-amber-100 border-amber-200" : ""}>
                                {row.wins} Hafta
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {i === 0 && row.wins > 0 ? (
                                <Badge className="bg-amber-500 hover:bg-amber-500">🏆 Zirvede</Badge>
                              ) : row.wins > 0 ? (
                                <Badge variant="secondary">Kürsüde</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground/50">Kayıt Yok</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── TAB: KRİTER OKUL ORTALAMALARI ─────────────────────── */}
            <TabsContent value="criterias">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Kriter Bazlı Okul Ortalamaları</CardTitle>
                  <CardDescription>Okuldaki tüm sınıfların tüm zamanlarda kriterlerden aldığı ortalama puan (5 üzerinden)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {criteriaAnalysis.map((crit, idx) => (
                    <div key={crit.id} className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium">{crit.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{crit.total_evaluations} Değerlendirme</span>
                          <Badge variant={crit.average >= 4.0 ? "success" : crit.average >= 3.0 ? "warning" : "destructive"}>
                            {crit.average} / 5
                          </Badge>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            crit.average >= 4.0 ? "bg-green-500" : crit.average >= 3.0 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${(crit.average / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {criteriaAnalysis.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">Kriter analiz verisi yok</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
