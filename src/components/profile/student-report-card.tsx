"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ClipboardList, FolderKanban, Sparkles, Download } from "lucide-react";

interface Props {
  studentId: string;
  studentName: string;
  className: string;
  selectedYear: string;
}

export function StudentReportCard({ studentId, studentName, className, selectedYear }: Props) {
  const [loading, setLoading] = useState(true);
  const [readingData, setReadingData] = useState({ totalBooks: 0, completedBooks: 0, activeBook: "" });
  const [attendanceData, setAttendanceData] = useState({ totalAbsent: 0, totalLessons: 0 });
  const [projectData, setProjectData] = useState({ assigned: 0, subjects: [] as string[] });
  const [cleanlinessData, setCleanlinessData] = useState({ avgScore: 0, totalRecords: 0 });

  useEffect(() => {
    loadReportData();
  }, [studentId, selectedYear]);

  // Eğitim yılından tarih aralığı çıkar
  function getDateRange(year: string): { start: string; end: string } {
    const parts = year.split("-");
    if (parts.length !== 2) return { start: "2020-01-01", end: "2030-12-31" };
    return {
      start: `${parts[0]}-09-01`,
      end: `${parts[1]}-08-31`,
    };
  }

  async function loadReportData() {
    setLoading(true);
    const supabase = createClient();
    const { start, end } = getDateRange(selectedYear);

    const [
      { data: books },
      { data: attendance },
      { data: projects },
      { data: classData }
    ] = await Promise.all([
      // Kitap verileri
      supabase
        .from("student_books")
        .select("status, books(title)")
        .eq("student_id", studentId)
        .gte("started_at", start)
        .lte("started_at", end),
      // Devamsızlık verileri
      supabase
        .from("attendance_logs")
        .select("status")
        .eq("student_id", studentId)
        .eq("status", "absent")
        .gte("log_date", start)
        .lte("log_date", end),
      // Proje verileri
      supabase
        .from("student_projects")
        .select("subjects(name)")
        .eq("student_id", studentId)
        .gte("created_at", start)
        .lte("created_at", end),
      // Sınıf bilgisi (temizlik puanı için class_id lazım)
      supabase
        .from("students")
        .select("class_id")
        .eq("id", studentId)
        .single()
    ]);

    // Kitap özeti
    const totalBooks = books?.length || 0;
    const completedBooks = books?.filter((b: any) => b.status === "completed").length || 0;
    const activeBook = books?.find((b: any) => b.status === "active");
    const activeBookTitle = activeBook?.books 
      ? (Array.isArray(activeBook.books) ? activeBook.books[0]?.title : (activeBook.books as any).title) 
      : "";

    setReadingData({
      totalBooks,
      completedBooks,
      activeBook: activeBookTitle || "",
    });

    // Devamsızlık
    setAttendanceData({
      totalAbsent: attendance?.length || 0,
      totalLessons: 0,
    });

    // Projeler
    const subjectNames = [...new Set((projects || []).map((p: any) => p.subjects?.name).filter(Boolean))];
    setProjectData({
      assigned: projects?.length || 0,
      subjects: subjectNames as string[],
    });

    // Temizlik puanı
    if (classData?.class_id) {
      const { data: scores } = await supabase
        .from("cleanliness_scores")
        .select("score")
        .eq("class_id", classData.class_id)
        .gte("score_date", start)
        .lte("score_date", end);

      if (scores && scores.length > 0) {
        const avg = scores.reduce((sum: number, s: any) => sum + s.score, 0) / scores.length;
        setCleanlinessData({ avgScore: Math.round(avg * 10) / 10, totalRecords: scores.length });
      }
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Karne verileri yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">📋 Öğrenci Karnesi — {selectedYear}</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Okuma */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Okuma Özeti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Toplam Kitap</span>
              <span className="font-semibold">{readingData.totalBooks}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tamamlanan</span>
              <span className="font-semibold text-green-600">{readingData.completedBooks}</span>
            </div>
            {readingData.activeBook && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Aktif Kitap</span>
                <Badge variant="outline" className="text-xs">{readingData.activeBook}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Devamsızlık */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5 text-red-600" />
              Devamsızlık
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Devamsız Ders Saati</span>
              <span className="font-semibold text-red-600">{attendanceData.totalAbsent}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {attendanceData.totalAbsent === 0 
                ? "Bu dönem devamsızlık kaydı yok ✓"
                : `${attendanceData.totalAbsent} ders saati devamsızlık`
              }
            </div>
          </CardContent>
        </Card>

        {/* Projeler */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-5 w-5 text-purple-600" />
              Proje Durumu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Atanan Proje</span>
              <span className="font-semibold">{projectData.assigned}</span>
            </div>
            {projectData.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {projectData.subjects.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                ))}
              </div>
            )}
            {projectData.assigned === 0 && (
              <p className="text-xs text-muted-foreground">Bu dönem proje atanmamış</p>
            )}
          </CardContent>
        </Card>

        {/* Temizlik */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-yellow-600" />
              Temiz Sınıf
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sınıf Ort. Puan</span>
              <span className="font-semibold">{cleanlinessData.avgScore}/5</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {cleanlinessData.totalRecords} kayıt üzerinden hesaplandı
            </div>
            {/* Yıldız gösterimi */}
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={`text-lg ${star <= Math.round(cleanlinessData.avgScore) ? "text-yellow-500" : "text-gray-300"}`}>★</span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
