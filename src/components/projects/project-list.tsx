"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Download, Printer, Users, BookOpen, CheckSquare, Square } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { setupTurkishFont, safeText } from "@/lib/pdf/font";
import type { Subject, Class } from "@/lib/types/database";

interface Props {
  classes: Class[];
  subjects: Subject[];
}

export function ProjectList({ classes, subjects }: Props) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || "");
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set(classes.map((c) => c.id)));
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  // Filtre degistiginde sonuclari cek
  useEffect(() => {
    if (!selectedSubjectId || selectedClassIds.size === 0) {
      setResults([]);
      return;
    }
    fetchResults();
  }, [selectedSubjectId, selectedClassIds]);

  async function fetchResults() {
    setLoading(true);
    const supabase = createClient();
    const classIds = Array.from(selectedClassIds);

    const { data } = await supabase
      .from("student_projects")
      .select("student_id, students!inner(full_name, e_okul_no, class_id, classes!inner(name))")
      .eq("subject_id", selectedSubjectId)
      .in("class_id", classIds)
      .order("class_id");

    setResults(data || []);
    setLoading(false);
  }

  function toggleClass(classId: string) {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  function selectAll() {
    setSelectedClassIds(new Set(classes.map((c) => c.id)));
  }

  function clearAll() {
    setSelectedClassIds(new Set());
  }

  // Sinif bazli gruplanmis sonuclar
  const groupedResults = useMemo(() => {
    const grouped = new Map<string, { className: string; students: any[] }>();
    results.forEach((r: any) => {
      const cid = (r.students as any)?.class_id;
      if (!grouped.has(cid)) {
        grouped.set(cid, {
          className: (r.students as any)?.classes?.name || "Bilinmeyen",
          students: [],
        });
      }
      grouped.get(cid)!.students.push(r);
    });
    return Array.from(grouped.entries())
      .sort((a, b) => a[1].className.localeCompare(b[1].className))
      .map(([_, v]) => v);
  }, [results]);

  const totalStudents = results.length;

  // PDF Export
  async function exportPDF() {
    if (results.length === 0) {
      toast("Listelenecek ogrenci bulunamadi", "error");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const fontReady = await setupTurkishFont(doc);

    const t = (text: string) => safeText(text, fontReady);

    // Baslik
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(t(`${selectedSubject?.name || "Ders"} - Proje Alan Ogrenci Listesi`), 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100);
    const selectedClassNames = classes
      .filter((c) => selectedClassIds.has(c.id))
      .map((c) => t(c.name))
      .join(", ");
    doc.text(t(`Siniflar: ${selectedClassNames}`), 14, 26);
    doc.text(t(`Toplam: ${totalStudents} ogrenci | Tarih: ${new Date().toLocaleDateString("tr-TR")}`), 14, 32);

    let yPos = 40;

    groupedResults.forEach((group) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(11);
      doc.setTextColor(59, 130, 246);
      doc.text(t(`${group.className} (${group.students.length} ogrenci)`), 14, yPos);
      yPos += 8;

      const rows = group.students.map((r: any) => [
        r.students?.e_okul_no || "-",
        t(r.students?.full_name || ""),
      ]);

      autoTable(doc, {
        head: [[t("Ogrenci No"), t("Ad Soyad")]],
        body: rows,
        startY: yPos,
        styles: { fontSize: 9, cellPadding: 2, font: fontReady ? "Roboto" : "helvetica" },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, font: fontReady ? "Roboto" : "helvetica" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14 },
        tableWidth: 180,
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.save(`${(selectedSubject?.name || "ders").replace(/\s+/g, "_")}_proje_listesi.pdf`);
    toast("PDF indirildi", "success");
  }

  if (subjects.length === 0) {
    return (
      <div className="text-center py-12 border rounded-xl bg-muted/30">
        <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-sm">Henuz ders eklenmemis</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Ust kontrol */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)} className="w-auto min-w-[160px]">
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" /> {totalStudents} ogrenci
          </Badge>
        </div>

        <Button onClick={exportPDF} disabled={results.length === 0} size="sm">
          <Printer className="h-4 w-4 mr-1" /> PDF Indir
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Sinif Filtre Paneli */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Sinif Filtresi</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
                    <CheckSquare className="h-3 w-3 mr-1" /> Tumu
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
                    <Square className="h-3 w-3 mr-1" /> Temizle
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[400px] overflow-y-auto">
              {classes.map((c) => {
                const checked = selectedClassIds.has(c.id);
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
                      onChange={() => toggleClass(c.id)}
                      className="rounded w-4 h-4 accent-primary"
                    />
                    <span className={`text-sm ${checked ? "font-semibold text-primary" : ""}`}>{c.name}</span>
                  </label>
                );
              })}
              {classes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Sinif bulunamadi</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sonuc Listesi */}
        <div className="md:col-span-2">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground animate-pulse">Yukleniyor...</div>
          ) : groupedResults.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">
                  {selectedClassIds.size === 0
                    ? "Lutfen en az bir sinif secin"
                    : `${selectedSubject?.name || "Secili ders"} dersinden proje alan ogrenci bulunamadi`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedResults.map((group) => (
                <Card key={group.className}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{group.className}</span>
                      <Badge variant="secondary">{group.students.length} ogrenci</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/30 text-xs">
                          <th className="text-left p-2.5 font-medium text-muted-foreground w-12">#</th>
                          <th className="text-left p-2.5 font-medium text-muted-foreground">Ogrenci No</th>
                          <th className="text-left p-2.5 font-medium text-muted-foreground">Ad Soyad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.students.map((r: any, idx: number) => (
                          <tr key={r.student_id} className="border-t hover:bg-muted/20 text-sm">
                            <td className="p-2.5 text-muted-foreground">{idx + 1}</td>
                            <td className="p-2.5 font-mono text-xs">{r.students?.e_okul_no || "-"}</td>
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
  );
}
