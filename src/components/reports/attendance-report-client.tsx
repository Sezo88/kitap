"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, Users, ClipboardList, AlertTriangle, MessageSquare, Calendar, Phone } from "lucide-react";
import * as XLSX from "xlsx";

interface Class { id: string; name: string; school_id: string; }
interface Props {
  classes: Class[];
  schoolFilter: { school_id?: string };
}

function RateBadge({ rate }: { rate: number }) {
  const color = rate >= 90 ? "bg-green-100 text-green-700" : rate >= 75 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>%{rate}</span>;
}

export function AttendanceReportClient({ classes, schoolFilter }: Props) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [loading, setLoading] = useState(true);

  // Tab 1: Genel Devamsızlık Listesi & İstatistikler
  const [attendanceStats, setAttendanceStats] = useState<any[]>([]);
  const [smsSummary, setSmsSummary] = useState<any>({ total: 0, sent: 0, failed: 0, pending: 0, totalCost: 0 });

  // Tab 2: Günlük Detay Yoklama Durumu (Kullanıcı İsteği: Belirli günde gelmeyen/geç kalanlar)
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dailyAttendance, setDailyAttendance] = useState<any[]>([]);

  useEffect(() => {
    fetchGeneralData();
  }, [startDate, endDate, selectedClassId]);

  useEffect(() => {
    fetchDailyData();
  }, [targetDate, selectedClassId]);

  async function fetchGeneralData() {
    setLoading(true);
    const supabase = createClient();

    // ── 1. Attendance logs query ─────────────────────────────────
    let attendanceQuery = supabase
      .from("attendance_logs")
      .select("student_id, class_id, log_date, status, reason, students!inner(full_name, classes!inner(name))")
      .gte("log_date", startDate)
      .lte("log_date", endDate);
    if (selectedClassId !== "all") attendanceQuery = attendanceQuery.eq("class_id", selectedClassId);
    if (schoolFilter.school_id) {
      const { data: schoolClassIds } = await supabase.from("classes").select("id").eq("school_id", schoolFilter.school_id);
      const ids = schoolClassIds?.map((c: any) => c.id) || [];
      if (ids.length > 0) attendanceQuery = attendanceQuery.in("class_id", ids);
    }

    // ── 2. SMS logs query ────────────────────────────────────────
    let smsQuery = supabase
      .from("sms_logs")
      .select("id, status, message_type, created_at, student_id, students!inner(full_name, class_id, classes!inner(name))")
      .gte("created_at", startDate + "T00:00:00Z")
      .lte("created_at", endDate + "T23:59:59Z");
    if (selectedClassId !== "all") smsQuery = smsQuery.eq("students.class_id", selectedClassId);
    if (schoolFilter.school_id) {
      const { data: schoolClassIds } = await supabase.from("classes").select("id").eq("school_id", schoolFilter.school_id);
      const ids = schoolClassIds?.map((c: any) => c.id) || [];
      if (ids.length > 0) smsQuery = smsQuery.in("students.class_id", ids);
    }

    // ── 3. SMS Cost Settings ─────────────────────────────────────
    let smsCostQuery = supabase
      .from("sms_provider_settings")
      .select("sms_unit_cost")
      .match(schoolFilter);

    const [
      { data: attendanceData },
      { data: smsData },
      smsCostSettings
    ] = await Promise.all([
      attendanceQuery,
      smsQuery,
      smsCostQuery.maybeSingle() as any
    ]);

    const unitCost = (smsCostSettings as any)?.data?.sms_unit_cost || 0;

    // ── GÜN BAZLI DOĞRU DEVAMSIZLIK HESAPLAMA ───────────────────────
    // Aynı öğrencinin aynı gün içindeki farklı ders kayıtlarını grupluyoruz.
    // Öncelik: hem absent hem present varsa corrected_present (sonradan geldi) kabul edilir
    const dayRecords = new Map<string, { status: string; reason: string | null; class_id: string }[]>();
    (attendanceData || []).forEach((a: any) => {
      const key = `${a.student_id}_${a.log_date}`;
      const list = dayRecords.get(key) || [];
      list.push({ status: a.status, reason: a.reason, class_id: a.class_id });
      dayRecords.set(key, list);
    });

    const dayMap = new Map<string, { status: string; reason: string | null; class_id: string }>();
    dayRecords.forEach((records, key) => {
      const hasAbsent = records.some(r => r.status === "absent");
      const hasPresent = records.some(r => r.status === "present");
      const hasCorrected = records.some(r => r.status === "corrected_present");
      const firstRecord = records[0];

      let finalStatus = "present";
      if (hasAbsent && (hasPresent || hasCorrected)) {
        finalStatus = "corrected_present";
      } else if (hasAbsent) {
        finalStatus = "absent";
      } else if (hasCorrected) {
        finalStatus = "corrected_present";
      }

      const absentRecord = records.find(r => r.status === "absent");
      const reason = absentRecord ? absentRecord.reason : (records.find(r => r.reason)?.reason || null);

      dayMap.set(key, { status: finalStatus, reason, class_id: firstRecord.class_id });
    });

    const attMap = new Map<string, any>();
    dayMap.forEach((val, key) => {
      const [studentId] = key.split("_");
      const a = (attendanceData || []).find((x: any) => x.student_id === studentId) as any;
      if (!a) return;

      if (!attMap.has(studentId)) {
        attMap.set(studentId, {
          student_id: studentId,
          student_name: a.students?.full_name || "",
          class_name: a.students?.classes?.name || "",
          class_id: val.class_id,
          total_days: 0,
          absent_days: 0,
          present_days: 0,
          corrected_days: 0,
        });
      }
      const row = attMap.get(studentId)!;
      row.total_days++;
      if (val.status === "absent") row.absent_days++;
      else if (val.status === "present") row.present_days++;
      else if (val.status === "corrected_present") row.corrected_days++;
    });

    const attArr = Array.from(attMap.values()).map(r => ({
      ...r,
      attendance_rate: r.total_days > 0 ? Math.round(((r.total_days - r.absent_days) / r.total_days) * 100) : 100
    })).sort((a, b) => b.absent_days - a.absent_days);

    setAttendanceStats(attArr);

    // ── SMS SUMMARY ──────────────────────────────────────────────
    let smsSent = 0, smsFailed = 0, smsPending = 0;
    (smsData || []).forEach((s: any) => {
      if (s.status === "sent") smsSent++;
      else if (s.status === "failed") smsFailed++;
      else if (s.status === "pending") smsPending++;
    });
    setSmsSummary({
      total: (smsData || []).length,
      sent: smsSent,
      failed: smsFailed,
      pending: smsPending,
      totalCost: parseFloat((smsSent * unitCost).toFixed(2)),
    });

    setLoading(false);
  }

  async function fetchDailyData() {
    const supabase = createClient();
    let query = supabase
      .from("attendance_logs")
      .select("student_id, status, lesson_no, students!inner(full_name, veli_telefon, class_id, classes!inner(name))")
      .eq("log_date", targetDate);

    if (selectedClassId !== "all") {
      query = query.eq("class_id", selectedClassId);
    }
    if (schoolFilter.school_id) {
      const { data: schoolClassIds } = await supabase.from("classes").select("id").eq("school_id", schoolFilter.school_id);
      const ids = schoolClassIds?.map((c: any) => c.id) || [];
      if (ids.length > 0) query = query.in("class_id", ids);
    }

    const { data } = await query;
    
    // Gün içindeki en güncel/kritik durumu belirle
    const dailyRecords = new Map<string, { status: string; lesson: number; name: string; class: string; phone: string | null }[]>();
    (data || []).forEach((d: any) => {
      const sid = d.student_id;
      const list = dailyRecords.get(sid) || [];
      list.push({
        status: d.status,
        lesson: d.lesson_no,
        name: d.students?.full_name || "",
        class: (d.students as any)?.classes?.name || "",
        phone: d.students?.veli_telefon || null
      });
      dailyRecords.set(sid, list);
    });

    const dailyMap = new Map<string, { status: string; lessons: number[]; name: string; class: string; phone: string | null }>();
    dailyRecords.forEach((records, sid) => {
      const hasAbsent = records.some(r => r.status === "absent");
      const hasPresent = records.some(r => r.status === "present");
      const hasCorrected = records.some(r => r.status === "corrected_present");
      const first = records[0];

      let finalStatus = "present";
      if (hasAbsent && (hasPresent || hasCorrected)) {
        finalStatus = "corrected_present";
      } else if (hasAbsent) {
        finalStatus = "absent";
      } else if (hasCorrected) {
        finalStatus = "corrected_present";
      }

      dailyMap.set(sid, {
        status: finalStatus,
        lessons: records.map(r => r.lesson),
        name: first.name,
        class: first.class,
        phone: first.phone
      });
    });

    setDailyAttendance(Array.from(dailyMap.entries()).map(([id, info]) => ({
      student_id: id,
      ...info
    })));
  }

  const frequentAbsentees = useMemo(() => attendanceStats.filter((a) => a.absent_days >= 5), [attendanceStats]);

  // Tablo bazlı günlük kırılımlar
  const dailyAbsents = useMemo(() => dailyAttendance.filter(d => d.status === "absent"), [dailyAttendance]);
  const dailyCorrected = useMemo(() => dailyAttendance.filter(d => d.status === "corrected_present"), [dailyAttendance]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attendanceStats.map((a) => ({
      Öğrenci: a.student_name, Sınıf: a.class_name,
      "Toplam Gün": a.total_days, "Devamsız Gün": a.absent_days,
      "Geldiği Gün": a.present_days, "Sonradan Geldiği Gün": a.corrected_days,
      "Devam Oranı": `%${a.attendance_rate}`,
    }))), "Devamsızlık Raporu");
    XLSX.writeFile(wb, `devamsizlik-raporu-${startDate}_${endDate}.xlsx`);
  }

  return (
    <div className="space-y-5">
      {/* ── Sınıf Filtresi ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-auto">
          <option value="all">Tüm Sınıflar</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="daily"><Calendar className="h-3.5 w-3.5 mr-1" />Günün Yoklama Durumu</TabsTrigger>
          <TabsTrigger value="analysis"><ClipboardList className="h-3.5 w-3.5 mr-1" />Genel Analiz & Detaylar</TabsTrigger>
          <TabsTrigger value="sms"><MessageSquare className="h-3.5 w-3.5 mr-1" />SMS Bildirim Özeti</TabsTrigger>
        </TabsList>

        {/* ── TAB: GÜNLÜK DETAY (GELMEYEN / GEÇ KALANLAR) ──────────────── */}
        <TabsContent value="daily">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground shrink-0">Tarih Seç:</span>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-auto" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Gelmeyenler Kartı */}
              <Card className="border-red-200">
                <CardHeader className="pb-2 bg-red-50/50">
                  <CardTitle className="text-sm font-semibold text-red-800 flex items-center justify-between">
                    <span>🔴 Bugün Gelmeyenler</span>
                    <Badge variant="destructive">{dailyAbsents.length} Öğrenci</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-[350px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Öğrenci</TableHead>
                        <TableHead>Sınıf</TableHead>
                        <TableHead>Veli Tel</TableHead>
                        <TableHead className="text-center">Dersler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyAbsents.map((s) => (
                        <TableRow key={s.student_id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell><Badge variant="outline">{s.class}</Badge></TableCell>
                          <TableCell className="text-xs font-mono flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" /> {s.phone || "Kayıt Yok"}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{s.lessons.sort().join(", ")}. Ders</TableCell>
                        </TableRow>
                      ))}
                      {dailyAbsents.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Bu tarihte gelmeyen öğrenci kaydı bulunmamaktadır.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Geç Kalanlar (Sonradan Gelenler) Kartı */}
              <Card className="border-yellow-200">
                <CardHeader className="pb-2 bg-yellow-50/50">
                  <CardTitle className="text-sm font-semibold text-yellow-800 flex items-center justify-between">
                    <span>🟡 Bugün Geç Kalanlar (Sonradan Gelenler)</span>
                    <Badge variant="warning">{dailyCorrected.length} Öğrenci</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-[350px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Öğrenci</TableHead>
                        <TableHead>Sınıf</TableHead>
                        <TableHead>Veli Tel</TableHead>
                        <TableHead className="text-center">Dersler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyCorrected.map((s) => (
                        <TableRow key={s.student_id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell><Badge variant="outline">{s.class}</Badge></TableCell>
                          <TableCell className="text-xs font-mono flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" /> {s.phone || "Kayıt Yok"}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{s.lessons.sort().join(", ")}. Ders</TableCell>
                        </TableRow>
                      ))}
                      {dailyCorrected.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Bu tarihte geç kalan/sonradan gelen öğrenci kaydı bulunmamaktadır.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB: GENEL ANALİZ & DETAYLAR ─────────────────────────── */}
        <TabsContent value="analysis">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">Başlangıç:</span>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
                <span className="text-sm text-muted-foreground shrink-0 ml-2">Bitiş:</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
              </div>
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <Download className="h-4 w-4 mr-1" /> Excel İndir
              </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {/* Tekrarlayan Devamsızlık */}
              <Card className="md:col-span-1 border-red-100">
                <CardHeader className="pb-3 bg-red-50/20">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-xl">🚨</span> Tekrarlayan Devamsızlık (5+ Gün)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {frequentAbsentees.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
                        <div>
                          <p className="text-xs font-semibold text-red-800">{s.student_name}</p>
                          <p className="text-[10px] text-red-600">{s.class_name}</p>
                        </div>
                        <Badge variant="destructive">{s.absent_days} Gün</Badge>
                      </div>
                    ))}
                    {frequentAbsentees.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Tekrarlayan devamsızlığı olan öğrenci yok</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Devamsızlık Detayları Tablosu */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Öğrenci Devamsızlık Özetleri (Gün Bazlı)</CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-[350px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Öğrenci</TableHead>
                        <TableHead>Sınıf</TableHead>
                        <TableHead className="text-center">Toplam Gün</TableHead>
                        <TableHead className="text-center">Devamsız Gün</TableHead>
                        <TableHead className="text-center">Sonradan Geldi</TableHead>
                        <TableHead className="text-center">Devam Oranı</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceStats.map((row) => (
                        <TableRow key={row.student_id} className={row.absent_days >= 5 ? "bg-red-50/50" : ""}>
                          <TableCell className="font-medium">{row.student_name}</TableCell>
                          <TableCell>{row.class_name}</TableCell>
                          <TableCell className="text-center">{row.total_days}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={row.absent_days >= 5 ? "destructive" : row.absent_days > 0 ? "warning" : "success"}>
                              {row.absent_days} Gün
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{row.corrected_days} Gün</TableCell>
                          <TableCell className="text-center"><RateBadge rate={row.attendance_rate} /></TableCell>
                        </TableRow>
                      ))}
                      {attendanceStats.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Devamsızlık kaydı bulunamadı</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB: SMS BİLDİRİM ÖZETİ ─────────────────────────────── */}
        <TabsContent value="sms">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Toplam Gönderilen", value: smsSummary.total, color: "text-foreground" },
              { label: "Başarılı SMS", value: smsSummary.sent, color: "text-green-600" },
              { label: "Başarısız SMS", value: smsSummary.failed, color: "text-red-600" },
              { label: "Tahmini Maliyet", value: `₺${smsSummary.totalCost}`, color: "text-blue-600" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            <p>💡 SMS Raporunda listelenen gönderimler, seçilen tarih aralığındaki günlük yoklama bildirimleridir. Maliyet hesabı, okulunuz için yapılandırılmış olan birim maliyet değerine göre hesaplanmaktadır.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
