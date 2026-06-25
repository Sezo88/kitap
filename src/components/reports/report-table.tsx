"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Calendar, BookOpen } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import * as XLSX from "xlsx";
import type { Class, ReportRow } from "@/lib/types/database";

interface Props {
  classes: Class[];
  schoolFilter: { school_id?: string };
}

interface CompletedBookRow {
  student_id: string;
  student_name: string;
  class_name: string;
  book_title: string;
  book_author: string;
  page_count: number | null;
  started_at: string;
  finished_at: string;
  duration_days: number;
}

export function ReportTable({ classes, schoolFilter }: Props) {
  const [activeTab, setActiveTab] = useState("rates");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  
  // Daily rates state
  const [data, setData] = useState<ReportRow[]>([]);
  const [sortBy, setSortBy] = useState<keyof ReportRow>("read_rate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Completed books state
  const [completedBooks, setCompletedBooks] = useState<CompletedBookRow[]>([]);
  const [sortByBooks, setSortByBooks] = useState<keyof CompletedBookRow>("finished_at");
  const [sortDirBooks, setSortDirBooks] = useState<"asc" | "desc">("desc");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const supabase = createClient();

      // Query 1: Reading Logs (Daily Rates)
      let logsQuery = supabase
        .from("reading_logs")
        .select("student_id, students!inner(full_name, class_id, classes!inner(name)), brought_book, did_read")
        .gte("log_date", startDate)
        .lte("log_date", endDate);

      if (selectedClassId !== "all") {
        logsQuery = logsQuery.eq("class_id", selectedClassId);
      }
      if (schoolFilter.school_id) {
        logsQuery = logsQuery.eq("students.classes.school_id", schoolFilter.school_id);
      }

      const { data: logs } = await logsQuery;

      // Query 2: Completed Student Books
      let booksQuery = supabase
        .from("student_books")
        .select("student_id, started_at, finished_at, status, students!inner(full_name, class_id, classes!inner(name)), books(title, author, page_count)")
        .eq("status", "completed")
        .gte("finished_at", startDate)
        .lte("finished_at", endDate);

      if (selectedClassId !== "all") {
        booksQuery = booksQuery.eq("students.class_id", selectedClassId);
      }
      if (schoolFilter.school_id) {
        booksQuery = booksQuery.eq("students.classes.school_id", schoolFilter.school_id);
      }

      const { data: completedData } = await booksQuery;

      // Aggregate reading logs
      if (logs) {
        const agg = new Map<string, ReportRow>();
        logs.forEach((l: any) => {
          const sid = l.student_id;
          if (!agg.has(sid)) {
            agg.set(sid, {
              student_id: sid,
              student_name: l.students?.full_name || "",
              class_name: l.students?.classes?.name || "",
              total_days: 0,
              read_days: 0,
              brought_days: 0,
              read_rate: 0,
              brought_rate: 0,
            });
          }
          const row = agg.get(sid)!;
          row.total_days++;
          if (l.brought_book) row.brought_days++;
          if (l.did_read) row.read_days++;
        });

        agg.forEach((row) => {
          row.read_rate = row.total_days > 0 ? Math.round((row.read_days / row.total_days) * 100) : 0;
          row.brought_rate = row.total_days > 0 ? Math.round((row.brought_days / row.total_days) * 100) : 0;
        });

        setData(Array.from(agg.values()));
      } else {
        setData([]);
      }

      // Map completed books
      if (completedData) {
        const mappedBooks: CompletedBookRow[] = completedData.map((sb: any) => {
          const sDate = new Date(sb.started_at);
          const fDate = new Date(sb.finished_at);
          const diffTime = Math.abs(fDate.getTime() - sDate.getTime());
          const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

          const bookInfo = Array.isArray(sb.books) ? sb.books[0] : sb.books;

          return {
            student_id: sb.student_id,
            student_name: sb.students?.full_name || "",
            class_name: sb.students?.classes?.name || "",
            book_title: bookInfo?.title || "Bilinmeyen Kitap",
            book_author: bookInfo?.author || "",
            page_count: bookInfo?.page_count || null,
            started_at: sb.started_at,
            finished_at: sb.finished_at,
            duration_days: durationDays,
          };
        });
        setCompletedBooks(mappedBooks);
      } else {
        setCompletedBooks([]);
      }

      setLoading(false);
    }

    fetchData();
  }, [startDate, endDate, selectedClassId]);

  // Sort daily rates
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [data, sortBy, sortDir]);

  // Sort completed books
  const sortedCompletedBooks = useMemo(() => {
    return [...completedBooks].sort((a, b) => {
      const av = a[sortByBooks];
      const bv = b[sortByBooks];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDirBooks === "asc" ? av - bv : bv - av;
      }
      return sortDirBooks === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [completedBooks, sortByBooks, sortDirBooks]);

  function handleSort(field: keyof ReportRow) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  function handleSortBooks(field: keyof CompletedBookRow) {
    if (sortByBooks === field) {
      setSortDirBooks((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortByBooks(field);
      setSortDirBooks("asc");
    }
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Rates Sheet
    const wsRates = XLSX.utils.json_to_sheet(
      sortedData.map((r) => ({
        Öğrenci: r.student_name,
        Sınıf: r.class_name,
        "Toplam Gün": r.total_days,
        "Okuduğu Gün": r.read_days,
        "Getirdiği Gün": r.brought_days,
        "Okuma Oranı": `%${r.read_rate}`,
        "Getirme Oranı": `%${r.brought_rate}`,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsRates, "Günlük Okuma Oranları");

    // Completed Books Sheet
    const wsBooks = XLSX.utils.json_to_sheet(
      sortedCompletedBooks.map((b) => ({
        Öğrenci: b.student_name,
        Sınıf: b.class_name,
        "Kitap Adı": b.book_title,
        Yazar: b.book_author,
        "Sayfa Sayısı": b.page_count || "-",
        "Başlama Tarihi": b.started_at ? new Date(b.started_at).toLocaleDateString("tr-TR") : "-",
        "Bitiş Tarihi": b.finished_at ? new Date(b.finished_at).toLocaleDateString("tr-TR") : "-",
        "Okuma Süresi (Gün)": b.duration_days,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsBooks, "Bitirilen Kitaplar");

    XLSX.writeFile(wb, `okuma-ve-kitap-raporu-${startDate}_${endDate}.xlsx`);
  }

  const classAverage = useMemo(() => {
    if (sortedData.length === 0) return 0;
    return Math.round(sortedData.reduce((sum, r) => sum + r.read_rate, 0) / sortedData.length);
  }, [sortedData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Başlangıç:</span>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Bitiş:</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
        </div>
        <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-auto">
          <option value="all">Tüm Sınıflar</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Button variant="outline" size="sm" onClick={exportExcel}>
          <Download className="h-4 w-4 mr-1" /> Excel Export
        </Button>
      </div>

      <Tabs defaultValue="rates">
        <TabsList className="mb-4">
          <TabsTrigger value="rates" onClick={() => setActiveTab("rates")}>
            <Calendar className="h-4 w-4 mr-2" />
            Günlük Okuma Oranları
          </TabsTrigger>
          <TabsTrigger value="books" onClick={() => setActiveTab("books")}>
            <BookOpen className="h-4 w-4 mr-2" />
            Bitirilen Kitaplar Raporu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rates">
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Toplam Öğrenci</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sortedData.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Sınıf Ortalama Okuma</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">%{classAverage}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">En Az Okuyan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-destructive truncate">
                  {sortedData.length > 0 ? sortedData[0]?.student_name : "-"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("student_name")}>
                      Öğrenci {sortBy === "student_name" && (sortDir === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("class_name")}>
                      Sınıf {sortBy === "class_name" && (sortDir === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="cursor-pointer text-center" onClick={() => handleSort("total_days")}>
                      Toplam Gün
                    </TableHead>
                    <TableHead className="cursor-pointer text-center" onClick={() => handleSort("read_days")}>
                      Okuduğu Gün
                    </TableHead>
                    <TableHead className="cursor-pointer text-center" onClick={() => handleSort("brought_days")}>
                      Getirdiği Gün
                    </TableHead>
                    <TableHead className="cursor-pointer text-center" onClick={() => handleSort("read_rate")}>
                      Okuma % {sortBy === "read_rate" && (sortDir === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="cursor-pointer text-center" onClick={() => handleSort("brought_rate")}>
                      Getirme %
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Yükleniyor...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && sortedData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Seçilen tarih aralığında veri bulunamadı
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    sortedData.map((row) => (
                      <TableRow key={row.student_id}>
                        <TableCell className="font-medium">{row.student_name}</TableCell>
                        <TableCell>{row.class_name}</TableCell>
                        <TableCell className="text-center">{row.total_days}</TableCell>
                        <TableCell className="text-center">{row.read_days}</TableCell>
                        <TableCell className="text-center">{row.brought_days}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={row.read_rate >= 80 ? "success" : row.read_rate >= 50 ? "warning" : "destructive"}>
                            %{row.read_rate}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={row.brought_rate >= 80 ? "success" : row.brought_rate >= 50 ? "warning" : "destructive"}>
                            %{row.brought_rate}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="books">
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Bitirilen Toplam Kitap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{sortedCompletedBooks.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">En Hızlı Okunan Süre</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sortedCompletedBooks.length > 0 
                    ? `${Math.min(...sortedCompletedBooks.map(b => b.duration_days))} Gün`
                    : "-"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Ortalama Okuma Süresi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sortedCompletedBooks.length > 0 
                    ? `${Math.round(sortedCompletedBooks.reduce((sum, b) => sum + b.duration_days, 0) / sortedCompletedBooks.length)} Gün`
                    : "-"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSortBooks("student_name")}>
                      Öğrenci {sortByBooks === "student_name" && (sortDirBooks === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSortBooks("class_name")}>
                      Sınıf {sortByBooks === "class_name" && (sortDirBooks === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSortBooks("book_title")}>
                      Kitap Adı {sortByBooks === "book_title" && (sortDirBooks === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead>Yazar</TableHead>
                    <TableHead className="text-center cursor-pointer" onClick={() => handleSortBooks("started_at")}>
                      Başlama Tarihi {sortByBooks === "started_at" && (sortDirBooks === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-center cursor-pointer" onClick={() => handleSortBooks("finished_at")}>
                      Bitiş Tarihi {sortByBooks === "finished_at" && (sortDirBooks === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-center cursor-pointer" onClick={() => handleSortBooks("duration_days")}>
                      Süre (Gün) {sortByBooks === "duration_days" && (sortDirBooks === "asc" ? "↑" : "↓")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Yükleniyor...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && sortedCompletedBooks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Seçilen tarih aralığında bitirilen kitap kaydı bulunamadı
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    sortedCompletedBooks.map((row, idx) => (
                      <TableRow key={`${row.student_id}-${row.book_title}-${idx}`}>
                        <TableCell className="font-medium">{row.student_name}</TableCell>
                        <TableCell>{row.class_name}</TableCell>
                        <TableCell className="font-medium">{row.book_title}</TableCell>
                        <TableCell>{row.book_author || "-"}</TableCell>
                        <TableCell className="text-center">
                          {row.started_at ? new Date(row.started_at).toLocaleDateString("tr-TR") : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.finished_at ? new Date(row.finished_at).toLocaleDateString("tr-TR") : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{row.duration_days} Gün</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
