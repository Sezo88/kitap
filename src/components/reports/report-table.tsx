"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import type { Class, ReportRow } from "@/lib/types/database";

interface Props {
  classes: Class[];
  schoolFilter: { school_id?: string };
}

export function ReportTable({ classes, schoolFilter }: Props) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<keyof ReportRow>("read_rate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const supabase = createClient();

      let logsQuery = supabase
        .from("reading_logs")
        .select("student_id, students!inner(full_name, class_id, classes!inner(name)), brought_book, did_read")
        .gte("log_date", startDate)
        .lte("log_date", endDate);

      if (selectedClassId !== "all") {
        logsQuery = logsQuery.eq("class_id", selectedClassId);
      }

      // Apply school filter through classes
      if (schoolFilter.school_id) {
        logsQuery = logsQuery.eq("students.classes.school_id", schoolFilter.school_id);
      }

      const { data: logs } = await logsQuery;

      if (!logs) {
        setData([]);
        setLoading(false);
        return;
      }

      // Aggregate by student
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

      // Calculate rates
      agg.forEach((row) => {
        row.read_rate = row.total_days > 0 ? Math.round((row.read_days / row.total_days) * 100) : 0;
        row.brought_rate = row.total_days > 0 ? Math.round((row.brought_days / row.total_days) * 100) : 0;
      });

      setData(Array.from(agg.values()));
      setLoading(false);
    }

    fetchData();
  }, [startDate, endDate, selectedClassId]);

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

  function handleSort(field: keyof ReportRow) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(
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
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `okuma-raporu-${startDate}_${endDate}.xlsx`);
  }

  // Class average
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

      {/* Summary Card */}
      <div className="grid gap-4 md:grid-cols-3">
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
    </div>
  );
}
