"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Info, UserCheck, Plus } from "lucide-react";
import { parseOgretmenElProgrami, type TeacherElProgramiParseResult } from "@/lib/utils/teacher-schedule-parser";
import type { BellSchedule } from "@/lib/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: { id: string; name: string }[];
  teachers: { id: string; full_name: string }[];
  subjects: { id: string; name: string }[];
  bellSchedule: BellSchedule[];
  schoolId: string;
  onImportComplete: () => void;
}

const DAY_NAMES = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

function normalizeName(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/[\s\.\-_]+/g, "")
    .replace(/i̇/g, "i");
}

export function LessonScheduleImportModal({
  open,
  onOpenChange,
  classes: existingClasses,
  teachers: existingTeachers,
  subjects: existingSubjects,
  schoolId,
  onImportComplete,
}: Props) {
  const [parseResult, setParseResult] = useState<TeacherElProgramiParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [saveDuties, setSaveDuties] = useState(true);
  const [createMissingClasses, setCreateMissingClasses] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const result = parseOgretmenElProgrami(buffer);
        if (result.lessons.length === 0) {
          setErrorMsg("Dosyada geçerli ders programı verisi bulunamadı.");
          return;
        }
        setParseResult(result);
      } catch (err: any) {
        console.error("Excel parse error:", err);
        setErrorMsg("Dosya okunurken bir hata oluştu: " + (err?.message || "Geçersiz dosya formatı"));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function resetModal() {
    setParseResult(null);
    setFileName("");
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Matching helper
  function matchTeacher(name: string) {
    const norm = normalizeName(name);
    return existingTeachers.find((t) => normalizeName(t.full_name) === norm);
  }

  function matchClass(name: string) {
    const norm = normalizeName(name);
    return existingClasses.find((c) => normalizeName(c.name) === norm);
  }

  function matchSubject(fullName: string, shortCode: string) {
    const normFull = normalizeName(fullName);
    const normShort = normalizeName(shortCode);
    return existingSubjects.find(
      (s) => normalizeName(s.name) === normFull || normalizeName(s.name) === normShort
    );
  }

  // Matched stats
  const teachersCount = parseResult?.teachers.length || 0;
  const matchedTeachersCount = parseResult?.teachers.filter(matchTeacher).length || 0;
  const unregisteredTeachersCount = teachersCount - matchedTeachersCount;

  const classesCount = parseResult?.classes.length || 0;
  const unmatchedClasses = parseResult?.classes.filter((c) => !matchClass(c)) || [];

  async function handleConfirmImport() {
    if (!parseResult) return;
    setImporting(true);
    const supabase = createClient();

    try {
      // 1. Missing classes check and auto-create
      const classMap = new Map<string, string>();
      for (const c of existingClasses) {
        classMap.set(c.name, c.id);
      }

      if (createMissingClasses && unmatchedClasses.length > 0) {
        const newClassInserts = unmatchedClasses.map((name) => {
          const matchGrade = name.match(/^(\d+)/);
          const gradeLevel = matchGrade ? parseInt(matchGrade[1]) : 5;
          return {
            school_id: schoolId,
            name,
            grade_level: gradeLevel,
          };
        });

        const { data: createdClasses, error: clsError } = await supabase
          .from("classes")
          .insert(newClassInserts)
          .select("id, name");

        if (clsError) {
          console.error("Classes auto-create error:", clsError);
        } else if (createdClasses) {
          createdClasses.forEach((cc) => classMap.set(cc.name, cc.id));
        }
      }

      // 2. Missing subjects check and auto-create
      const subjectMap = new Map<string, string>();
      for (const s of existingSubjects) {
        subjectMap.set(s.name, s.id);
      }

      const subjectsToCreate = new Set<string>();
      for (const lesson of parseResult.lessons) {
        const existing = matchSubject(lesson.subjectFullName, lesson.shortCode);
        if (existing) {
          subjectMap.set(lesson.subjectFullName, existing.id);
        } else {
          subjectsToCreate.add(lesson.subjectFullName);
        }
      }

      if (subjectsToCreate.size > 0) {
        const newSubjectInserts = Array.from(subjectsToCreate).map((name) => ({
          school_id: schoolId,
          name,
        }));
        const { data: createdSubjects, error: subError } = await supabase
          .from("subjects")
          .insert(newSubjectInserts)
          .select("id, name");

        if (subError) {
          throw new Error("Dersler oluşturulurken hata: " + subError.message);
        }
        if (createdSubjects) {
          createdSubjects.forEach((cs) => subjectMap.set(cs.name, cs.id));
        }
      }

      // 3. Prepare lesson_schedule records
      const lessonInserts: any[] = [];
      let skippedMissingClass = 0;

      for (const l of parseResult.lessons) {
        const matchedT = matchTeacher(l.teacherName);
        const classId = classMap.get(l.className) || matchClass(l.className)?.id;
        const subjectId =
          subjectMap.get(l.subjectFullName) ||
          matchSubject(l.subjectFullName, l.shortCode)?.id;

        if (!classId) {
          skippedMissingClass++;
          continue;
        }
        if (!subjectId) {
          continue;
        }

        lessonInserts.push({
          school_id: schoolId,
          class_id: classId,
          teacher_id: matchedT ? matchedT.id : null,
          teacher_name: l.teacherName,
          subject_id: subjectId,
          day_of_week: l.day,
          period_no: l.period,
        });
      }

      if (lessonInserts.length === 0) {
        throw new Error(
          "Dersler kaydedilemedi. Lütfen sınıfların sisteme eklendiğinden emin olun."
        );
      }

      // 4. Clear existing lesson_schedule for this school
      const { error: delError } = await supabase
        .from("lesson_schedule")
        .delete()
        .eq("school_id", schoolId);

      if (delError) {
        throw new Error("Mevcut program silinirken hata: " + delError.message);
      }

      // 5. Batch insert new lesson_schedule records (chunks of 100)
      const chunkSize = 100;
      for (let i = 0; i < lessonInserts.length; i += chunkSize) {
        const chunk = lessonInserts.slice(i, i + chunkSize);
        const { error: insertError } = await supabase
          .from("lesson_schedule")
          .insert(chunk);
        if (insertError) {
          throw new Error("Ders programı kaydedilirken hata: " + insertError.message);
        }
      }

      // 6. Optionally save duties
      let savedDutiesCount = 0;
      if (saveDuties && parseResult.duties.length > 0) {
        const dutyInserts: any[] = [];
        for (const d of parseResult.duties) {
          const matchedT = matchTeacher(d.teacherName);
          dutyInserts.push({
            school_id: schoolId,
            teacher_id: matchedT ? matchedT.id : null,
            teacher_name: d.teacherName,
            day_of_week: d.day,
            time_slot: d.location,
            location: d.location,
          });
        }

        if (dutyInserts.length > 0) {
          await supabase.from("duty_schedule").delete().eq("school_id", schoolId);
          await supabase.from("duty_schedule").insert(dutyInserts);
          savedDutiesCount = dutyInserts.length;
        }
      }

      // 7. Update school total_lessons if needed
      if (parseResult.maxPeriod && parseResult.maxPeriod >= 4) {
        await supabase
          .from("schools")
          .update({ total_lessons: parseResult.maxPeriod })
          .eq("id", schoolId);
      }

      toast(
        `Harika! ${lessonInserts.length} ders saatinin tamamı aktarıldı.${
          savedDutiesCount > 0 ? ` (${savedDutiesCount} nöbet kaydı da eklendi)` : ""
        }`,
        "success"
      );

      onOpenChange(false);
      resetModal();
      onImportComplete();
    } catch (err: any) {
      console.error("Import error:", err);
      toast(err?.message || "İçe aktarma sırasında bir hata oluştu.", "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="space-y-4">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Öğretmen El Programı Excel (.xls) Aktarımı
            </DialogTitle>
            <DialogClose onClick={() => onOpenChange(false)} />
          </div>
        </DialogHeader>

        {!parseResult ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-muted-foreground flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                Ders dağıtım programınızın oluşturduğu{" "}
                <span className="font-semibold text-foreground">OgretmenElProgrami.xls</span> dosyasını seçin.
                Öğretmenler henüz sisteme kayıt olmamış olsa bile tüm dersler isimleriyle sisteme işlenecektir.
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500/50 hover:bg-muted/20 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-500">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="font-medium text-sm">
                  {fileName ? fileName : "Excel dosyasını seçmek için tıklayın"}
                </div>
                <div className="text-xs text-muted-foreground">
                  .xls veya .xlsx formatında Öğretmen El Programı
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-lg bg-muted/40 border">
                <div className="text-xs text-muted-foreground">Öğretmenler</div>
                <div className="text-lg font-bold text-emerald-600">
                  {teachersCount} / {teachersCount}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {matchedTeachersCount} kayıtlı, {unregisteredTeachersCount} isimle
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border">
                <div className="text-xs text-muted-foreground">Sınıflar</div>
                <div className="text-lg font-bold text-emerald-600">
                  {createMissingClasses ? classesCount : classesCount - unmatchedClasses.length} / {classesCount}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {unmatchedClasses.length > 0 && createMissingClasses ? "Eksikler eklenecek" : "Tümü hazır"}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border">
                <div className="text-xs text-muted-foreground">Toplam Ders</div>
                <div className="text-lg font-bold">{parseResult.lessons.length}</div>
                <div className="text-[10px] text-muted-foreground">Eksiksiz aktarılacak</div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border">
                <div className="text-xs text-muted-foreground">Nöbet Kaydı</div>
                <div className="text-lg font-bold">{parseResult.duties.length}</div>
                <div className="text-[10px] text-muted-foreground">Nöbetçi öğretmen</div>
              </div>
            </div>

            {/* Smart teacher info banner */}
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                Öğretmenler Kayıtlı Olmasa Bile Derslerin Tamamı Aktarılır:
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Sistemde hesabı bulunan öğretmenlerin dersleri hesaplarına bağlanır. Henüz kayıt olmamış <strong>{unregisteredTeachersCount} öğretmenin</strong> dersleri isimleriyle sisteme kaydedilir. Öğretmenler daha sonra sisteme kayıt olduğunda sistem derslerini otomatik olarak hesaplarıyla eşleştirecektir.
              </p>
            </div>

            {/* Auto-create missing classes checkbox if any */}
            {unmatchedClasses.length > 0 && (
              <label className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 cursor-pointer hover:bg-blue-500/15">
                <input
                  type="checkbox"
                  checked={createMissingClasses}
                  onChange={(e) => setCreateMissingClasses(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div className="text-xs">
                  <span className="font-medium text-foreground">
                    Eksik sınıfları sisteme otomatik ekle: {unmatchedClasses.join(", ")}
                  </span>
                  <div className="text-muted-foreground text-[11px]">
                    İşaretlenirse bu özel eğitim sınıfları sisteme hemen eklenecek ve dersleri eksiksiz aktarılacaktır.
                  </div>
                </div>
              </label>
            )}

            {/* Optional Duty Schedule Checkbox */}
            {parseResult.duties.length > 0 && (
              <label className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 border cursor-pointer hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={saveDuties}
                  onChange={(e) => setSaveDuties(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <div className="text-xs">
                  <span className="font-medium text-foreground">
                    Nöbet Çizelgesini de otomatik doldur ({parseResult.duties.length} nöbet)
                  </span>
                  <div className="text-muted-foreground text-[11px]">
                    Öğretmen el programında tespit edilen nöbet günleri ve yerleri nöbet tablosuna aktarılır.
                  </div>
                </div>
              </label>
            )}

            {/* Preview table (first 8 records) */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 p-2 text-xs font-semibold border-b flex justify-between items-center">
                <span>Önizleme (İlk 8 Ders Dağılımı)</span>
                <span className="text-muted-foreground text-[11px]">
                  Toplam {parseResult.lessons.length} kayıt aktarılacak
                </span>
              </div>
              <div className="max-h-44 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 text-muted-foreground sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Öğretmen</th>
                      <th className="p-2 text-left">Sınıf</th>
                      <th className="p-2 text-left">Gün</th>
                      <th className="p-2 text-center">Saat</th>
                      <th className="p-2 text-left">Ders Adı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parseResult.lessons.slice(0, 8).map((l, idx) => (
                      <tr key={idx} className="hover:bg-muted/10">
                        <td className="p-2 font-medium">
                          {l.teacherName}
                          {matchTeacher(l.teacherName) ? (
                            <Badge variant="outline" className="ml-1.5 text-[9px] text-emerald-600 border-emerald-500/30">Kayıtlı</Badge>
                          ) : (
                            <Badge variant="outline" className="ml-1.5 text-[9px] text-muted-foreground">İsimle</Badge>
                          )}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px]">
                            {l.className}
                          </Badge>
                        </td>
                        <td className="p-2">{DAY_NAMES[l.day] || l.day}</td>
                        <td className="p-2 text-center">{l.period}. Ders</td>
                        <td className="p-2 text-muted-foreground">{l.subjectFullName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetModal}
                disabled={importing}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Farklı Dosya Seç
              </Button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={importing}
                >
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleConfirmImport}
                  disabled={importing}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {importing ? "Aktarılıyor..." : `Tüm Programı Sisteme Aktar (${parseResult.lessons.length} Ders)`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
