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
import { Download, Trophy, Users, BookOpen, TrendingUp, Activity, Star } from "lucide-react";
import * as XLSX from "xlsx";

interface Class { id: string; name: string; school_id: string; }
interface Props {
  classes: Class[];
  schoolFilter: { school_id?: string };
  teachers: { id: string; full_name: string }[];
}

// ── Mini bar chart (SVG-free, pure CSS) ─────────────────────────
function BarChart({ data, max, color = "bg-primary" }: { data: { label: string; value: number; sub?: string }[]; max: number; color?: string }) {
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-5 text-xs text-muted-foreground text-right shrink-0">{i + 1}</div>
          <div className="text-xs font-medium truncate w-28 shrink-0" title={d.label}>{d.label}</div>
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all duration-500`}
                style={{ width: `${max > 0 ? (d.value / max) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs font-bold w-10 text-right shrink-0">{d.value}</span>
          </div>
          {d.sub && <span className="text-xs text-muted-foreground shrink-0">{d.sub}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Rate badge ───────────────────────────────────────────────────
function RateBadge({ rate }: { rate: number }) {
  const color = rate >= 80 ? "bg-green-100 text-green-700" : rate >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>%{rate}</span>;
}

export function ReportsClient({ classes, schoolFilter, teachers }: Props) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [loading, setLoading] = useState(true);

  // Data
  const [studentStats, setStudentStats] = useState<any[]>([]);
  const [completedBooks, setCompletedBooks] = useState<any[]>([]);
  const [teacherActivity, setTeacherActivity] = useState<any[]>([]);
  const [classStats, setClassStats] = useState<any[]>([]);

  useEffect(() => {
    fetchAll();
  }, [startDate, endDate, selectedClassId]);

  async function fetchAll() {
    setLoading(true);
    const supabase = createClient();

    // ── 1. Reading logs ──────────────────────────────────────────
    let logsQuery = supabase
      .from("reading_logs")
      .select("student_id, class_id, brought_book, did_read, marked_by, students!inner(full_name, classes!inner(name))")
      .gte("log_date", startDate)
      .lte("log_date", endDate);
    if (selectedClassId !== "all") logsQuery = logsQuery.eq("class_id", selectedClassId);
    if (schoolFilter.school_id) {
      const { data: schoolClassIds } = await supabase.from("classes").select("id").eq("school_id", schoolFilter.school_id);
      const ids = schoolClassIds?.map((c: any) => c.id) || [];
      if (ids.length > 0) logsQuery = logsQuery.in("class_id", ids);
    }
    const { data: logs } = await logsQuery;

    // ── 2. Completed books ───────────────────────────────────────
    let booksQuery = supabase
      .from("student_books")
      .select("student_id, started_at, finished_at, students!inner(full_name, class_id, classes!inner(name)), books(title, author, page_count)")
      .eq("status", "completed")
      .gte("finished_at", startDate)
      .lte("finished_at", endDate);
    if (selectedClassId !== "all") booksQuery = booksQuery.eq("students.class_id", selectedClassId);
    const { data: booksData } = await booksQuery;

    // ── Aggregate student stats ──────────────────────────────────
    const aggMap = new Map<string, any>();
    (logs || []).forEach((l: any) => {
      const sid = l.student_id;
      if (!aggMap.has(sid)) {
        aggMap.set(sid, {
          student_id: sid,
          student_name: l.students?.full_name || "",
          class_name: (l.students as any)?.classes?.name || "",
          class_id: l.class_id,
          total_days: 0, read_days: 0, brought_days: 0,
          read_rate: 0, brought_rate: 0,
        });
      }
      const row = aggMap.get(sid)!;
      row.total_days++;
      if (l.brought_book) row.brought_days++;
      if (l.did_read) row.read_days++;
    });
    aggMap.forEach((row) => {
      row.read_rate = row.total_days > 0 ? Math.round((row.read_days / row.total_days) * 100) : 0;
      row.brought_rate = row.total_days > 0 ? Math.round((row.brought_days / row.total_days) * 100) : 0;
    });
    const studentsArr = Array.from(aggMap.values());
    setStudentStats(studentsArr);

    // ── Aggregate by class ───────────────────────────────────────
    const classMap = new Map<string, any>();
    studentsArr.forEach((s) => {
      if (!classMap.has(s.class_id)) {
        classMap.set(s.class_id, { class_id: s.class_id, class_name: s.class_name, student_count: 0, total_read_rate: 0 });
      }
      const c = classMap.get(s.class_id)!;
      c.student_count++;
      c.total_read_rate += s.read_rate;
    });
    const classArr = Array.from(classMap.values()).map((c) => ({
      ...c,
      avg_read_rate: c.student_count > 0 ? Math.round(c.total_read_rate / c.student_count) : 0,
    })).sort((a, b) => b.avg_read_rate - a.avg_read_rate);
    setClassStats(classArr);

    // ── Completed books ──────────────────────────────────────────
    const mapped = (booksData || []).map((sb: any) => {
      const sDate = sb.started_at ? new Date(sb.started_at) : null;
      const fDate = sb.finished_at ? new Date(sb.finished_at) : null;
      const duration = sDate && fDate ? Math.ceil(Math.abs(fDate.getTime() - sDate.getTime()) / 86400000) || 1 : 0;
      const bookInfo = Array.isArray(sb.books) ? sb.books[0] : sb.books;
      return {
        student_name: sb.students?.full_name || "",
        class_name: (sb.students as any)?.classes?.name || "",
        book_title: bookInfo?.title || "Bilinmeyen Kitap",
        book_author: bookInfo?.author || "",
        page_count: bookInfo?.page_count || null,
        started_at: sb.started_at, finished_at: sb.finished_at, duration_days: duration,
      };
    });
    setCompletedBooks(mapped);

    // ── Teacher activity ─────────────────────────────────────────
    const teacherMap = new Map<string, any>();
    (logs || []).forEach((l: any) => {
      if (!l.marked_by) return;
      if (!teacherMap.has(l.marked_by)) {
        const t = teachers.find((t) => t.id === l.marked_by);
        teacherMap.set(l.marked_by, {
          teacher_id: l.marked_by,
          teacher_name: t?.full_name || "Bilinmeyen",
          entry_count: 0,
          unique_days: new Set<string>(),
        });
      }
      const row = teacherMap.get(l.marked_by)!;
      row.entry_count++;
    });

    // Get unique log dates per teacher
    const { data: teacherLogs } = await supabase
      .from("reading_logs")
      .select("marked_by, log_date")
      .gte("log_date", startDate)
      .lte("log_date", endDate)
      .not("marked_by", "is", null);

    (teacherLogs || []).forEach((tl: any) => {
      if (teacherMap.has(tl.marked_by)) {
        teacherMap.get(tl.marked_by).unique_days.add(tl.log_date);
      }
    });

    const teacherArr = Array.from(teacherMap.values()).map((t) => ({
      ...t,
      unique_days: t.unique_days.size,
    })).sort((a, b) => b.entry_count - a.entry_count);
    setTeacherActivity(teacherArr);

    setLoading(false);
  }

  // ── Derived stats ────────────────────────────────────────────
  const sortedByRead = useMemo(() => [...studentStats].sort((a, b) => b.read_rate - a.read_rate), [studentStats]);
  const top10 = useMemo(() => sortedByRead.slice(0, 10), [sortedByRead]);
  const bottom10 = useMemo(() => sortedByRead.slice(-10).reverse(), [sortedByRead]);
  const top10Books = useMemo(() => {
    const countMap = new Map<string, number>();
    completedBooks.forEach((b) => countMap.set(b.student_name, (countMap.get(b.student_name) || 0) + 1));
    return Array.from(countMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ label: name, value: count }));
  }, [completedBooks]);
  const schoolAvg = useMemo(() => studentStats.length > 0 ? Math.round(studentStats.reduce((s, r) => s + r.read_rate, 0) / studentStats.length) : 0, [studentStats]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortedByRead.map((r) => ({
      Öğrenci: r.student_name, Sınıf: r.class_name,
      "Okuma %": r.read_rate, "Getirme %": r.brought_rate,
      "Toplam Gün": r.total_days, "Okuduğu Gün": r.read_days,
    }))), "Öğrenci İstatistikleri");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(classStats.map((c) => ({
      Sınıf: c.class_name, "Öğrenci Sayısı": c.student_count, "Ort. Okuma %": c.avg_read_rate,
    }))), "Sınıf Sıralaması");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(completedBooks.map((b) => ({
      Öğrenci: b.student_name, Sınıf: b.class_name, "Kitap Adı": b.book_title,
      Yazar: b.book_author, "Başlama": b.started_at, "Bitiş": b.finished_at, "Süre (Gün)": b.duration_days,
    }))), "Bitirilen Kitaplar");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teacherActivity.map((t) => ({
      Öğretmen: t.teacher_name, "Toplam Kayıt": t.entry_count, "Aktif Gün": t.unique_days,
    }))), "Öğretmen Aktivitesi");
    XLSX.writeFile(wb, `detayli-rapor-${startDate}_${endDate}.xlsx`);
  }

  const maxClassRate = classStats[0]?.avg_read_rate || 1;

  return (
    <div className="space-y-5">
      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Başlangıç:</span>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Bitiş:</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
        </div>
        <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-auto">
          <option value="all">Tüm Sınıflar</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Button variant="outline" size="sm" onClick={exportExcel} className="sm:ml-auto">
          <Download className="h-4 w-4 mr-1" /> Excel İndir
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground animate-pulse">Veriler yükleniyor...</div>
      ) : (
        <>
          {/* ── Summary KPIs ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Okul Ort. Okuma", value: `%${schoolAvg}`, icon: TrendingUp, color: "text-blue-600 bg-blue-100" },
              { label: "Takip Edilen Öğrenci", value: studentStats.length, icon: Users, color: "text-green-600 bg-green-100" },
              { label: "Bitirilen Kitap", value: completedBooks.length, icon: BookOpen, color: "text-purple-600 bg-purple-100" },
              { label: "Aktif Öğretmen", value: teacherActivity.length, icon: Activity, color: "text-orange-600 bg-orange-100" },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">{stat.label}</CardTitle>
                  <div className={`p-1.5 rounded-lg ${stat.color} shrink-0`}>
                    <stat.icon className="h-3.5 w-3.5" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Tabs ─────────────────────────────────────────────── */}
          <Tabs defaultValue="rankings">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="rankings"><Trophy className="h-3.5 w-3.5 mr-1" />Sıralamalar</TabsTrigger>
              <TabsTrigger value="classes"><Star className="h-3.5 w-3.5 mr-1" />Sınıf İstatistikleri</TabsTrigger>
              <TabsTrigger value="books"><BookOpen className="h-3.5 w-3.5 mr-1" />Bitirilen Kitaplar</TabsTrigger>
              <TabsTrigger value="teachers"><Activity className="h-3.5 w-3.5 mr-1" />Öğretmen Aktivitesi</TabsTrigger>
              <TabsTrigger value="all"><Users className="h-3.5 w-3.5 mr-1" />Tüm Öğrenciler</TabsTrigger>
            </TabsList>

            {/* ── TAB: Rankings ─────────────────────────────────── */}
            <TabsContent value="rankings">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Top 10 readers */}
                <Card className="md:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-2xl">🏆</span> En Çok Okuyanlar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarChart data={top10.map((s) => ({ label: s.student_name, value: s.read_rate, sub: `%${s.read_rate}` }))} max={100} color="bg-green-500" />
                    {top10.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Veri yok</p>}
                  </CardContent>
                </Card>

                {/* Bottom 10 */}
                <Card className="md:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-2xl">⚠️</span> En Az Okuyanlar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarChart data={bottom10.map((s) => ({ label: s.student_name, value: s.read_rate, sub: `%${s.read_rate}` }))} max={100} color="bg-red-400" />
                    {bottom10.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Veri yok</p>}
                  </CardContent>
                </Card>

                {/* Most books completed */}
                <Card className="md:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-2xl">📚</span> En Çok Kitap Bitirenler
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarChart data={top10Books} max={top10Books[0]?.value || 1} color="bg-purple-500" />
                    {top10Books.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Henüz bitirilen kitap yok</p>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── TAB: Class Stats ──────────────────────────────── */}
            <TabsContent value="classes">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Sınıf Okuma Oranları (Ortalama)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarChart
                      data={classStats.map((c) => ({ label: c.class_name, value: c.avg_read_rate, sub: `%${c.avg_read_rate}` }))}
                      max={maxClassRate}
                      color="bg-blue-500"
                    />
                    {classStats.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Veri yok</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Sınıf Detayları</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Sınıf</TableHead>
                          <TableHead className="text-center">Öğrenci</TableHead>
                          <TableHead className="text-center">Ort. Okuma</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classStats.map((c, i) => (
                          <TableRow key={c.class_id}>
                            <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                            <TableCell className="font-medium">{c.class_name}</TableCell>
                            <TableCell className="text-center">{c.student_count}</TableCell>
                            <TableCell className="text-center"><RateBadge rate={c.avg_read_rate} /></TableCell>
                          </TableRow>
                        ))}
                        {classStats.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Veri yok</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── TAB: Completed Books ──────────────────────────── */}
            <TabsContent value="books">
              <div className="grid sm:grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Toplam Bitirilen", value: completedBooks.length, color: "text-purple-600" },
                  { label: "En Hızlı Süre", value: completedBooks.length > 0 ? `${Math.min(...completedBooks.map(b => b.duration_days))} gün` : "-", color: "text-green-600" },
                  { label: "Ort. Okuma Süresi", value: completedBooks.length > 0 ? `${Math.round(completedBooks.reduce((s, b) => s + b.duration_days, 0) / completedBooks.length)} gün` : "-", color: "" },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Öğrenci</TableHead>
                        <TableHead>Sınıf</TableHead>
                        <TableHead>Kitap</TableHead>
                        <TableHead>Yazar</TableHead>
                        <TableHead className="text-center">Başlama</TableHead>
                        <TableHead className="text-center">Bitiş</TableHead>
                        <TableHead className="text-center">Süre</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedBooks.map((b, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{b.student_name}</TableCell>
                          <TableCell>{b.class_name}</TableCell>
                          <TableCell className="font-medium text-primary">{b.book_title}</TableCell>
                          <TableCell className="text-muted-foreground">{b.book_author || "-"}</TableCell>
                          <TableCell className="text-center text-sm">{b.started_at ? new Date(b.started_at).toLocaleDateString("tr-TR") : "-"}</TableCell>
                          <TableCell className="text-center text-sm">{b.finished_at ? new Date(b.finished_at).toLocaleDateString("tr-TR") : "-"}</TableCell>
                          <TableCell className="text-center"><Badge variant="outline">{b.duration_days}g</Badge></TableCell>
                        </TableRow>
                      ))}
                      {completedBooks.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Bu dönemde bitirilen kitap kaydı yok</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── TAB: Teacher Activity ─────────────────────────── */}
            <TabsContent value="teachers">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Öğretmen Kayıt Girişleri</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarChart
                      data={teacherActivity.map((t) => ({ label: t.teacher_name, value: t.entry_count, sub: `${t.unique_days}g` }))}
                      max={teacherActivity[0]?.entry_count || 1}
                      color="bg-orange-500"
                    />
                    {teacherActivity.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Bu dönemde kayıt girilmemiş</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Öğretmen Detayları</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Öğretmen</TableHead>
                          <TableHead className="text-center">Toplam Kayıt</TableHead>
                          <TableHead className="text-center">Aktif Gün</TableHead>
                          <TableHead className="text-center">Durum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teacherActivity.map((t) => (
                          <TableRow key={t.teacher_id}>
                            <TableCell className="font-medium">{t.teacher_name}</TableCell>
                            <TableCell className="text-center font-bold">{t.entry_count}</TableCell>
                            <TableCell className="text-center">{t.unique_days} gün</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={t.unique_days > 5 ? "success" : t.unique_days > 0 ? "warning" : "destructive"}>
                                {t.unique_days > 5 ? "Aktif" : t.unique_days > 0 ? "Kısmi" : "Pasif"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {teacherActivity.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Bu dönemde kayıt yok</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── TAB: All Students ─────────────────────────────── */}
            <TabsContent value="all">
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Öğrenci</TableHead>
                        <TableHead>Sınıf</TableHead>
                        <TableHead className="text-center">Toplam Gün</TableHead>
                        <TableHead className="text-center">Okuduğu</TableHead>
                        <TableHead className="text-center">Getirdiği</TableHead>
                        <TableHead className="text-center">Okuma %</TableHead>
                        <TableHead className="text-center">Getirme %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedByRead.map((row, i) => (
                        <TableRow key={row.student_id}>
                          <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                          <TableCell className="font-medium">{row.student_name}</TableCell>
                          <TableCell>{row.class_name}</TableCell>
                          <TableCell className="text-center">{row.total_days}</TableCell>
                          <TableCell className="text-center">{row.read_days}</TableCell>
                          <TableCell className="text-center">{row.brought_days}</TableCell>
                          <TableCell className="text-center"><RateBadge rate={row.read_rate} /></TableCell>
                          <TableCell className="text-center"><RateBadge rate={row.brought_rate} /></TableCell>
                        </TableRow>
                      ))}
                      {sortedByRead.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Seçilen tarih aralığında veri bulunamadı</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
