"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  Download,
  Printer,
  Users,
  BookOpen,
  CheckSquare,
  Square,
  GraduationCap,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { setupTurkishFont, safeText } from "@/lib/pdf/font";
import type { Subject, Class } from "@/lib/types/database";

interface Props {
  classes: Class[];
  subjects: Subject[];
  schoolName?: string;
  teacherClassIds?: string[];
  userRole?: string;
}

interface ClassStudentProjectRow {
  studentId: string;
  fullName: string;
  eOkulNo: string | null;
  classId: string;
  className: string;
  projects: { id: string; subjectId: string; subjectName: string }[];
}

export function ProjectList({
  classes,
  subjects,
  schoolName = "Okul Müdürlüğü",
  teacherClassIds = [],
  userRole
}: Props) {
  // İki mod: "class" (Sınıf Bazlı Dağılım Çizelgesi) veya "subject" (Ders Bazlı Liste)
  const [viewMode, setViewMode] = useState<"class" | "subject">("class");

  // ── 1. Sınıf Bazlı Mod State'leri ──────────────────────────────
  // Öğretmenin sınıfı varsa varsayılan olarak onu seç, yoksa "all"
  const defaultClassId = useMemo(() => {
    if (teacherClassIds.length > 0) {
      const match = classes.find((c) => teacherClassIds.includes(c.id));
      if (match) return match.id;
    }
    return classes[0]?.id || "all";
  }, [classes, teacherClassIds]);

  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClassId);
  const [classStudents, setClassStudents] = useState<ClassStudentProjectRow[]>([]);
  const [onlyAssignedFilter, setOnlyAssignedFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingClassData, setLoadingClassData] = useState<boolean>(false);

  // ── 2. Ders Bazlı Mod State'leri ───────────────────────────────
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || "");
  const [selectedClassIdsForSubject, setSelectedClassIdsForSubject] = useState<Set<string>>(
    new Set(classes.map((c) => c.id))
  );
  const [subjectResults, setSubjectResults] = useState<any[]>([]);
  const [loadingSubjectData, setLoadingSubjectData] = useState<boolean>(false);

  const { toast } = useToast();

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  // Sınıf Bazlı Verileri Çek
  useEffect(() => {
    if (viewMode !== "class" || classes.length === 0) return;
    fetchClassProjects();
  }, [viewMode, selectedClassId, classes]);

  async function fetchClassProjects() {
    setLoadingClassData(true);
    const supabase = createClient();

    const targetClassIds =
      selectedClassId === "all"
        ? classes.map((c) => c.id)
        : [selectedClassId];

    if (targetClassIds.length === 0) {
      setClassStudents([]);
      setLoadingClassData(false);
      return;
    }

    try {
      // 1. Öğrencileri çek
      const { data: studentsData, error: sErr } = await supabase
        .from("students")
        .select("id, full_name, e_okul_no, class_id, classes!inner(name)")
        .in("class_id", targetClassIds)
        .eq("is_active", true)
        .order("class_id")
        .order("e_okul_no", { ascending: true, nullsFirst: false });

      if (sErr) throw sErr;

      // 2. Proje kayıtlarını çek
      const { data: projectsData, error: pErr } = await supabase
        .from("student_projects")
        .select("id, student_id, subject_id, class_id, subjects!inner(name)")
        .in("class_id", targetClassIds);

      if (pErr) throw pErr;

      // 3. Projeleri öğrenci bazında haritala
      const projectMap = new Map<string, { id: string; subjectId: string; subjectName: string }[]>();
      (projectsData || []).forEach((p: any) => {
        const sid = p.student_id;
        if (!projectMap.has(sid)) projectMap.set(sid, []);
        const sName = Array.isArray(p.subjects) ? p.subjects[0]?.name : p.subjects?.name;
        projectMap.get(sid)!.push({
          id: p.id,
          subjectId: p.subject_id,
          subjectName: sName || "Ders",
        });
      });

      // 4. Öğrencileri ve projelerini birleştir
      const combined: ClassStudentProjectRow[] = (studentsData || []).map((st: any) => {
        const cName = Array.isArray(st.classes) ? st.classes[0]?.name : st.classes?.name || "";
        return {
          studentId: st.id,
          fullName: st.full_name,
          eOkulNo: st.e_okul_no,
          classId: st.class_id,
          className: cName,
          projects: projectMap.get(st.id) || [],
        };
      });

      setClassStudents(combined);
    } catch (err: any) {
      console.error("fetchClassProjects error:", err);
      toast("Proje verileri alınırken hata: " + err.message, "error");
    } finally {
      setLoadingClassData(false);
    }
  }

  // Ders Bazlı Verileri Çek
  useEffect(() => {
    if (viewMode !== "subject" || !selectedSubjectId || selectedClassIdsForSubject.size === 0) {
      setSubjectResults([]);
      return;
    }
    fetchSubjectProjects();
  }, [viewMode, selectedSubjectId, selectedClassIdsForSubject]);

  async function fetchSubjectProjects() {
    setLoadingSubjectData(true);
    const supabase = createClient();
    const classIds = Array.from(selectedClassIdsForSubject);

    const { data, error } = await supabase
      .from("student_projects")
      .select("student_id, students!inner(full_name, e_okul_no, class_id, classes!inner(name))")
      .eq("subject_id", selectedSubjectId)
      .in("class_id", classIds)
      .order("class_id");

    if (error) {
      toast("Ders verileri alınırken hata: " + error.message, "error");
    }
    setSubjectResults(data || []);
    setLoadingSubjectData(false);
  }

  // ── Filtrelenmiş ve Gruplanmış Sınıf Sonuçları ─────────────────
  const filteredClassStudents = useMemo(() => {
    return classStudents.filter((row) => {
      // Yalnızca proje alanlar filtresi
      if (onlyAssignedFilter && row.projects.length === 0) return false;
      // Metin araması (ad soyad veya numara)
      if (searchQuery.trim()) {
        const q = searchQuery.toLocaleLowerCase("tr-TR").trim();
        const matchesName = row.fullName.toLocaleLowerCase("tr-TR").includes(q);
        const matchesNo = row.eOkulNo?.includes(q);
        const matchesSubject = row.projects.some((p) => p.subjectName.toLocaleLowerCase("tr-TR").includes(q));
        if (!matchesName && !matchesNo && !matchesSubject) return false;
      }
      return true;
    });
  }, [classStudents, onlyAssignedFilter, searchQuery]);

  const groupedClassStudents = useMemo(() => {
    const map = new Map<string, { className: string; students: ClassStudentProjectRow[] }>();
    filteredClassStudents.forEach((row) => {
      if (!map.has(row.className)) {
        map.set(row.className, { className: row.className, students: [] });
      }
      map.get(row.className)!.students.push(row);
    });
    return Array.from(map.values()).sort((a, b) => a.className.localeCompare(b.className));
  }, [filteredClassStudents]);

  // Sınıf İstatistikleri
  const classStats = useMemo(() => {
    const totalStudents = classStudents.length;
    const assignedStudents = classStudents.filter((s) => s.projects.length > 0).length;
    const unassignedStudents = totalStudents - assignedStudents;
    const totalProjects = classStudents.reduce((acc, s) => acc + s.projects.length, 0);
    return { totalStudents, assignedStudents, unassignedStudents, totalProjects };
  }, [classStudents]);

  // ── Ders Bazlı Gruplama ───────────────────────────────────────
  const groupedSubjectResults = useMemo(() => {
    const grouped = new Map<string, { className: string; students: any[] }>();
    subjectResults.forEach((r: any) => {
      const cid = (r.students as any)?.class_id;
      const cName = (r.students as any)?.classes?.name || "Bilinmeyen";
      if (!grouped.has(cid)) {
        grouped.set(cid, { className: cName, students: [] });
      }
      grouped.get(cid)!.students.push(r);
    });
    return Array.from(grouped.values()).sort((a, b) => a.className.localeCompare(b.className));
  }, [subjectResults]);

  // ── PDF ÇIKTISI (Sınıf Bazlı Resmi Dağılım Çizelgesi) ───────────
  async function exportClassPDF() {
    if (groupedClassStudents.length === 0) {
      toast("Yazdırılacak öğrenci kaydı bulunamadı", "error");
      return;
    }

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const fontReady = await setupTurkishFont(doc);
      const t = (text: string) => safeText(text, fontReady);

      const yearStr = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      const dateStr = new Date().toLocaleDateString("tr-TR");

      groupedClassStudents.forEach((group, groupIdx) => {
        // İlk sayfadan sonraki sınıflar için yeni sayfa aç
        if (groupIdx > 0) {
          doc.addPage();
        }

        // 1. Resmi Başlık Alanı
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(t("T.C."), 105, 15, { align: "center" });

        doc.setFontSize(13);
        doc.setFont("Roboto", "bold");
        doc.text(t(`${schoolName.toUpperCase()} MÜDÜRLÜĞÜ`), 105, 21, { align: "center" });

        doc.setFontSize(10);
        doc.setFont("Roboto", "normal");
        doc.text(t(`${yearStr} EĞİTİM VE ÖĞRETİM YILI`), 105, 27, { align: "center" });

        doc.setFontSize(12);
        doc.setFont("Roboto", "bold");
        doc.text(t("DERSLERE GÖRE PROJE DAĞILIM ÇİZELGESİ"), 105, 33, { align: "center" });

        // Çizgi
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.5);
        doc.line(14, 36, 196, 36);

        // Sınıf ve Tarih Bilgisi
        doc.setFontSize(10);
        doc.setFont("Roboto", "bold");
        doc.text(t(`SINIFI: ${group.className}`), 14, 42);
        doc.setFont("Roboto", "normal");
        doc.text(t(`Düzenleme Tarihi: ${dateStr}`), 196, 42, { align: "right" });

        // Tablo Satırları
        const tableRows = group.students.map((st, idx) => {
          const projectText =
            st.projects.length > 0
              ? st.projects.map((p) => p.subjectName).join(", ")
              : "Proje Almadı";
          return [
            String(idx + 1),
            st.eOkulNo || "-",
            t(st.fullName),
            t(projectText),
            "" // İmza / Not sütunu
          ];
        });

        // AutoTable
        autoTable(doc, {
          head: [[t("S.No"), t("Okul No"), t("Öğrenci Adı Soyadı"), t("Aldığı Proje Dersi / Dersleri"), t("Öğrenci İmzası")]],
          body: tableRows,
          startY: 46,
          styles: {
            fontSize: 9,
            cellPadding: 2.5,
            font: fontReady ? "Roboto" : "helvetica",
            textColor: [30, 41, 59],
            lineColor: [203, 213, 225],
            lineWidth: 0.2,
          },
          headStyles: {
            fillColor: [30, 41, 59], // Koyu resmi kurumsal renk
            textColor: 255,
            fontStyle: "bold",
            font: fontReady ? "Roboto" : "helvetica",
            halign: "center",
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 12 },
            1: { halign: "center", cellWidth: 20 },
            2: { halign: "left", cellWidth: 55 },
            3: { halign: "left", cellWidth: 70 },
            4: { halign: "center", cellWidth: 33 },
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          margin: { left: 14, right: 14, bottom: 35 },
        });

        // 2. İmza Alanı (Sayfa Altı)
        const pageHeight = doc.internal.pageSize.height;
        const signY = pageHeight - 24;

        doc.setFontSize(9);
        doc.setFont("Roboto", "normal");
        doc.text(t("... / ... / 20..."), 35, signY - 8, { align: "center" });
        doc.setFont("Roboto", "bold");
        doc.text(t("Sınıf Rehber Öğretmeni"), 35, signY, { align: "center" });
        doc.setFont("Roboto", "normal");
        doc.text(t("İmza"), 35, signY + 6, { align: "center" });

        doc.text(t("UYGUNDUR"), 165, signY - 8, { align: "center" });
        doc.setFont("Roboto", "bold");
        doc.text(t("Okul Müdürü"), 165, signY, { align: "center" });
        doc.setFont("Roboto", "normal");
        doc.text(t("İmza - Mühür"), 165, signY + 6, { align: "center" });
      });

      const fileName =
        selectedClassId === "all"
          ? `Tum_Siniflar_Proje_Dagitim_Cizelgesi_${dateStr}.pdf`
          : `${(classes.find((c) => c.id === selectedClassId)?.name || "Sinif").replace(/\//g, "_")}_Proje_Dagitim_Cizelgesi_${dateStr}.pdf`;

      doc.save(fileName);
      toast("Proje dağıtım çizelgesi PDF olarak indirildi", "success");
    } catch (e: any) {
      console.error("PDF export error:", e);
      toast("PDF oluşturulurken hata: " + e.message, "error");
    }
  }

  // ── PDF ÇIKTISI (Ders Bazlı Liste) ────────────────────────────
  async function exportSubjectPDF() {
    if (subjectResults.length === 0) {
      toast("Listelenecek öğrenci bulunamadı", "error");
      return;
    }

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const fontReady = await setupTurkishFont(doc);
      const t = (text: string) => safeText(text, fontReady);

      const dateStr = new Date().toLocaleDateString("tr-TR");

      doc.setFontSize(13);
      doc.setFont("Roboto", "bold");
      doc.text(t(`${schoolName.toUpperCase()} MÜDÜRLÜĞÜ`), 105, 18, { align: "center" });

      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(t(`${selectedSubject?.name || "Ders"} - Proje Alan Öğrenci Listesi`), 105, 26, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(100);
      doc.text(t(`Toplam: ${subjectResults.length} Öğrenci | Tarih: ${dateStr}`), 105, 32, { align: "center" });

      let yPos = 38;

      groupedSubjectResults.forEach((group) => {
        if (yPos > 245) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(11);
        doc.setFont("Roboto", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(t(`${group.className} Sınıfı (${group.students.length} Öğrenci)`), 14, yPos);
        yPos += 5;

        const rows = group.students.map((r: any, idx: number) => [
          String(idx + 1),
          r.students?.e_okul_no || "-",
          t(r.students?.full_name || ""),
          "" // İmza sütunu
        ]);

        autoTable(doc, {
          head: [[t("S.No"), t("Okul No"), t("Adı Soyadı"), t("İmza / Not")]],
          body: rows,
          startY: yPos,
          styles: { fontSize: 9, cellPadding: 2, font: fontReady ? "Roboto" : "helvetica" },
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
          columnStyles: {
            0: { halign: "center", cellWidth: 15 },
            1: { halign: "center", cellWidth: 25 },
            2: { halign: "left", cellWidth: 90 },
            3: { halign: "center", cellWidth: 50 },
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 14, right: 14 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      });

      doc.save(`${(selectedSubject?.name || "ders").replace(/\s+/g, "_")}_Proje_Listesi_${dateStr}.pdf`);
      toast("Ders proje listesi PDF olarak indirildi", "success");
    } catch (e: any) {
      toast("PDF hatası: " + e.message, "error");
    }
  }

  // Tarayıcıdan Yazdırma (window.print)
  function handleBrowserPrint() {
    window.print();
  }

  if (classes.length === 0) {
    return (
      <div className="text-center py-12 border rounded-xl bg-muted/30">
        <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-sm">Okula ait tanımlı sınıf bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── MOD SEÇİMİ (Sekmeler) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b print:hidden">
        <div className="inline-flex p-1 bg-muted rounded-xl border">
          <button
            type="button"
            onClick={() => setViewMode("class")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              viewMode === "class"
                ? "bg-card text-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="h-4 w-4 text-primary" />
            <span>Sınıf Bazlı Dağılım Çizelgesi</span>
            <Badge variant="secondary" className="text-[10px] ml-1">Resmi Çizelge</Badge>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("subject")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              viewMode === "subject"
                ? "bg-card text-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span>Ders Bazlı Öğrenci Listesi</span>
          </button>
        </div>

        {/* Yazdırma & İndirme Butonları */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBrowserPrint}
            title="Yazıcıdan doğrudan çıktı al"
            className="cursor-pointer"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Yazdır
          </Button>

          <Button
            size="sm"
            onClick={viewMode === "class" ? exportClassPDF : exportSubjectPDF}
            className="cursor-pointer bg-primary hover:bg-primary/90 shadow-sm"
          >
            <Download className="h-4 w-4 mr-1.5" />
            PDF İndir
          </Button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ── 1. MOD: SINIF BAZLI PROJE DAĞILIM ÇİZELGESİ ───────────── */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {viewMode === "class" && (
        <div className="space-y-5">
          {/* Filtre ve Kontrol Barı */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between p-4 rounded-2xl bg-card border shadow-xs print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              {/* Sınıf Seçimi */}
              <div className="flex items-center gap-2 min-w-[200px]">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Sınıf Seçin:
                </label>
                <Select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full sm:w-auto min-w-[180px] font-semibold"
                >
                  <option value="all">★ TÜM SINIFLAR (Okul Geneli)</option>
                  {classes.map((c) => {
                    const isTeacherClass = teacherClassIds.includes(c.id);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {isTeacherClass ? "(Sınıfınız)" : ""}
                      </option>
                    );
                  })}
                </Select>
              </div>

              {/* Sadece Proje Alanlar Onay Kutusu */}
              <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium cursor-pointer select-none px-3 py-1.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition">
                <input
                  type="checkbox"
                  checked={onlyAssignedFilter}
                  onChange={(e) => setOnlyAssignedFilter(e.target.checked)}
                  className="rounded w-4 h-4 accent-primary"
                />
                <span>Yalnızca Proje Alan Öğrencileri Göster</span>
              </label>
            </div>

            {/* Öğrenci Arama Kutusu */}
            <div className="relative w-full md:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Öğrenci adı, no veya ders ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
          </div>

          {/* İstatistik Rozetleri */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
            <div className="p-3.5 rounded-xl border bg-card/60 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Listelenen Öğrenci</p>
                <p className="text-xl font-black">{classStats.totalStudents}</p>
              </div>
              <Users className="h-5 w-5 text-muted-foreground/60" />
            </div>

            <div className="p-3.5 rounded-xl border bg-emerald-500/5 border-emerald-500/20 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">Proje Alan Öğrenci</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{classStats.assignedStudents}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500/70" />
            </div>

            <div className="p-3.5 rounded-xl border bg-amber-500/5 border-amber-500/20 flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">Proje Almayan</p>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400">{classStats.unassignedStudents}</p>
              </div>
              <AlertCircle className="h-5 w-5 text-amber-500/70" />
            </div>

            <div className="p-3.5 rounded-xl border bg-blue-500/5 border-blue-500/20 flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold">Dağıtılan Toplam Proje</p>
                <p className="text-xl font-black text-blue-600 dark:text-blue-400">{classStats.totalProjects}</p>
              </div>
              <Layers className="h-5 w-5 text-blue-500/70" />
            </div>
          </div>

          {/* Tablo Listesi */}
          {loadingClassData ? (
            <div className="py-16 text-center text-muted-foreground animate-pulse">
              Proje dağılım verileri yükleniyor...
            </div>
          ) : groupedClassStudents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-2">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground font-semibold text-sm">Gösterilecek öğrenci kaydı bulunamadı</p>
                <p className="text-xs text-muted-foreground/70">
                  {onlyAssignedFilter
                    ? "Seçilen sınıfta henüz proje alan öğrenci bulunmuyor. Filtreyi kaldırarak tüm sınıfı görebilirsiniz."
                    : "Sınıfa ait aktif öğrenci kaydı bulunmuyor."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {groupedClassStudents.map((group) => (
                <Card key={group.className} className="overflow-hidden border shadow-xs print:border-none print:shadow-none print:break-after-page">
                  {/* Resmi Yazdırma Başlığı (Yalnızca Print / Yazdırma esnasında görünür) */}
                  <div className="hidden print:block text-center p-4 border-b space-y-1 mb-3">
                    <div className="text-xs font-bold">T.C.</div>
                    <div className="text-sm font-black">{schoolName.toUpperCase()} MÜDÜRLÜĞÜ</div>
                    <div className="text-xs">DERSLERE GÖRE PROJE DAĞILIM ÇİZELGESİ</div>
                    <div className="flex justify-between items-center text-[10px] pt-2 font-bold">
                      <span>SINIFI: {group.className}</span>
                      <span>TARİH: {new Date().toLocaleDateString("tr-TR")}</span>
                    </div>
                  </div>

                  {/* Ekran Başlığı */}
                  <CardHeader className="pb-3 bg-muted/20 border-b print:hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                          <GraduationCap className="h-4 w-4" />
                        </span>
                        <CardTitle className="text-base font-bold">
                          {group.className} Sınıfı Proje Dağılım Çizelgesi
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-semibold">
                          {group.students.length} Öğrenci
                        </Badge>
                        <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                          {group.students.filter((s) => s.projects.length > 0).length} Proje Alan
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-muted/40 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider print:bg-slate-100 print:text-black">
                            <th className="py-2.5 px-3 w-12 text-center">#</th>
                            <th className="py-2.5 px-3 w-20 text-center">No</th>
                            <th className="py-2.5 px-4">Öğrenci Adı Soyadı</th>
                            <th className="py-2.5 px-4">Aldığı Proje Dersi / Dersleri</th>
                            <th className="py-2.5 px-3 w-28 text-center print:table-cell hidden sm:table-cell">Öğretmen İmzası</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-xs sm:text-sm">
                          {group.students.map((st, idx) => {
                            const hasProject = st.projects.length > 0;
                            return (
                              <tr
                                key={st.studentId}
                                className={`hover:bg-muted/20 transition-colors ${
                                  !hasProject ? "opacity-75" : ""
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold">
                                  {st.eOkulNo || "-"}
                                </td>
                                <td className="py-2.5 px-4 font-semibold text-foreground">
                                  {st.fullName}
                                </td>
                                <td className="py-2.5 px-4">
                                  {hasProject ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {st.projects.map((p) => (
                                        <span
                                          key={p.id}
                                          className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20 print:border-black print:text-black print:bg-transparent"
                                        >
                                          {p.subjectName}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground italic text-xs">
                                      Proje Belirlenmedi
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center print:table-cell hidden sm:table-cell text-muted-foreground/30">
                                  {/* Yazdırma esnasında imza çizgisi */}
                                  <div className="h-6 w-full border-b border-dotted border-gray-300 print:border-black" />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Yazdırma İmzaları (Yalnızca Çıktıda Görünür) */}
                    <div className="hidden print:flex justify-between items-end px-8 pt-8 pb-4 text-xs font-semibold">
                      <div className="text-center">
                        <p className="mb-8">... / ... / 20...</p>
                        <p className="font-bold">Sınıf Rehber Öğretmeni</p>
                        <p className="text-[10px] text-gray-500">İmza</p>
                      </div>
                      <div className="text-center">
                        <p className="mb-8">UYGUNDUR</p>
                        <p className="font-bold">Okul Müdürü</p>
                        <p className="text-[10px] text-gray-500">İmza - Mühür</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ── 2. MOD: DERS BAZLI ÖĞRENCİ LİSTESİ (Eski Görünüm) ──────── */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {viewMode === "subject" && (
        <div className="space-y-5">
          {/* Üst Ders Seçim Alanı */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 rounded-2xl bg-card border shadow-xs">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Ders Seçin:
              </label>
              <Select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-auto min-w-[180px] font-semibold"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" /> {subjectResults.length} Öğrenci
              </Badge>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Sınıf Filtre Paneli */}
            <div className="md:col-span-1">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Sınıf Filtresi</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedClassIdsForSubject(new Set(classes.map((c) => c.id)))}
                      >
                        <CheckSquare className="h-3 w-3 mr-1" /> Tümü
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedClassIdsForSubject(new Set())}
                      >
                        <Square className="h-3 w-3 mr-1" /> Temizle
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 max-h-[400px] overflow-y-auto">
                  {classes.map((c) => {
                    const checked = selectedClassIdsForSubject.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          checked ? "bg-primary/10 border border-primary/20" : "hover:bg-muted border border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedClassIdsForSubject((prev) => {
                              const next = new Set(prev);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            });
                          }}
                          className="rounded w-4 h-4 accent-primary"
                        />
                        <span className={`text-sm ${checked ? "font-semibold text-primary" : ""}`}>
                          {c.name}
                        </span>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Sonuç Listesi */}
            <div className="md:col-span-2">
              {loadingSubjectData ? (
                <div className="py-16 text-center text-muted-foreground animate-pulse">
                  Ders verileri yükleniyor...
                </div>
              ) : groupedSubjectResults.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground text-sm font-medium">
                      {selectedClassIdsForSubject.size === 0
                        ? "Lütfen en az bir sınıf seçin"
                        : `${selectedSubject?.name || "Seçili ders"} dersinden proje alan öğrenci bulunamadı`}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {groupedSubjectResults.map((group) => (
                    <Card key={group.className}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>{group.className} Sınıfı</span>
                          <Badge variant="secondary">{group.students.length} Öğrenci</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-muted/30 text-xs">
                              <th className="text-left p-2.5 font-medium text-muted-foreground w-12 text-center">#</th>
                              <th className="text-left p-2.5 font-medium text-muted-foreground w-20 text-center">No</th>
                              <th className="text-left p-2.5 font-medium text-muted-foreground">Öğrenci Adı Soyadı</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-xs sm:text-sm">
                            {group.students.map((r: any, idx: number) => (
                              <tr key={r.student_id} className="hover:bg-muted/20">
                                <td className="p-2.5 text-center text-muted-foreground">{idx + 1}</td>
                                <td className="p-2.5 text-center font-mono font-bold">{r.students?.e_okul_no || "-"}</td>
                                <td className="p-2.5 font-medium">{r.students?.full_name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
