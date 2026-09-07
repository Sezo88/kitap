"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseSchoolPDF, type ParsedStudent } from "@/lib/pdf/parse-school-pdf";
import { importSchoolStudents } from "@/lib/actions/students";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Upload, Check, AlertCircle, FileText, Loader2 } from "lucide-react";
import type { Class } from "@/lib/types/database";

interface Props {
  schoolId: string;
  existingClasses: Class[];
}

interface ClassGroup {
  className: string;
  students: ParsedStudent[];
  exists: boolean;
}

export function PDFImportClient({ schoolId, existingClasses }: Props) {
  const [step, setStep] = useState<"upload" | "parsing" | "preview" | "importing" | "done">("upload");
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [allStudents, setAllStudents] = useState<ParsedStudent[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [resultCounts, setResultCounts] = useState({ newCount: 0, updatedCount: 0, skippedCount: 0, deactivatedCount: 0 });
  const { toast } = useToast();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep("parsing");
    setErrors([]);

    const formData = new FormData();
    formData.append("file", file);

    const result = await parseSchoolPDF(formData);

    if (!result.success) {
      toast("PDF'ten öğrenci okunamadı", "error");
      setErrors(result.errors);
      setStep("upload");
      return;
    }

    setAllStudents(result.students);
    setErrors(result.errors);

    // Group by class
    const existingClassNames = new Set(existingClasses.map((c) => c.name.toUpperCase()));
    const classMap = new Map<string, ParsedStudent[]>();
    result.students.forEach((s) => {
      const list = classMap.get(s.className) || [];
      list.push(s);
      classMap.set(s.className, list);
    });

    const classGroups: ClassGroup[] = [];
    classMap.forEach((students, className) => {
      classGroups.push({
        className,
        students,
        exists: existingClassNames.has(className.toUpperCase()),
      });
    });

    setGroups(classGroups);
    setStep("preview");
  }

  async function handleImport() {
    setStep("importing");

    const res = await importSchoolStudents(allStudents);

    if (!res.success) {
      toast("Öğrenciler kaydedilemedi: " + (res.error || "Bilinmeyen hata"), "error");
      setStep("preview");
      return;
    }

    const counts = res.counts || { newCount: 0, updatedCount: 0, skippedCount: 0, deactivatedCount: 0 };
    setResultCounts(counts);
    toast(
      `${counts.newCount} yeni eklendi, ${counts.updatedCount} güncellendi, ${counts.skippedCount} aynen kaldı, ${counts.deactivatedCount} liste dışı öğrenci pasife alındı`,
      "success"
    );
    setStep("done");
  }

  return (
    <div className="max-w-4xl">
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>PDF Dosyası Yükle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-10 text-center">
              <FileText className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <label
                htmlFor="pdf-upload"
                className="cursor-pointer text-primary hover:underline text-lg block mb-2"
              >
                e-Okul Sınıf Listesi PDF'i Seçin
              </label>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFile}
                className="hidden"
              />
              <p className="text-sm text-muted-foreground">
                Her sayfasında bir sınıfın listesi olan PDF dosyası.
                <br />
                Sınıflar otomatik oluşturulur, öğrenciler sınıflarına atanır.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "parsing" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">PDF analiz ediliyor, öğrenciler okunuyor...</p>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {groups.length} sınıf, {allStudents.length} öğrenci bulundu
              </h3>
              {errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {errors.map((e, i) => (
                    <p key={i} className="text-sm text-yellow-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {e}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleImport} size="lg">
              <Upload className="h-4 w-4 mr-2" />
              {allStudents.length} Öğrenciyi İçe Aktar
            </Button>
          </div>

          <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Yeni Sezon Senkronizasyonu:</span> Bu listede yer alan sınıflar aktifleşecek; bu PDF'te <strong>bulunmayan eski şubeler (örn. 8/C, 8/D) ve liste dışı tüm öğrenciler (mezunlar, nakiller) otomatik olarak pasife (arşive) alınacaktır.</strong>
            </div>
          </div>

          {groups.map((group) => (
            <Card key={group.className}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{group.className}</CardTitle>
                  {group.exists ? (
                    <Badge variant="secondary">Mevcut sınıf</Badge>
                  ) : (
                    <Badge variant="warning">Yeni oluşturulacak</Badge>
                  )}
                  <Badge variant="outline">{group.students.length} öğrenci</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Öğrenci No</TableHead>
                      <TableHead>Ad Soyad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.students.slice(0, 10).map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{s.studentNo}</TableCell>
                        <TableCell className="font-medium">{s.fullName}</TableCell>
                      </TableRow>
                    ))}
                    {group.students.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                          ... ve {group.students.length - 10} öğrenci daha
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {step === "importing" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">Öğrenciler içe aktarılıyor...</p>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <h3 className="text-lg font-semibold mb-2">İçe Aktarma Tamamlandı!</h3>
            <div className="flex gap-4 justify-center mb-4 text-sm">
              <div className="bg-green-100 rounded-lg px-4 py-2">
                <div className="text-2xl font-bold text-green-700">{resultCounts.newCount}</div>
                <div className="text-green-600">Yeni Eklendi</div>
              </div>
              <div className="bg-blue-100 rounded-lg px-4 py-2">
                <div className="text-2xl font-bold text-blue-700">{resultCounts.updatedCount}</div>
                <div className="text-blue-600">Güncellendi</div>
              </div>
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="text-2xl font-bold text-gray-700">{resultCounts.skippedCount}</div>
                <div className="text-gray-600">Aynen Kaldı</div>
              </div>
              {resultCounts.deactivatedCount > 0 && (
                <div className="bg-yellow-100 rounded-lg px-4 py-2">
                  <div className="text-2xl font-bold text-yellow-700">{resultCounts.deactivatedCount}</div>
                  <div className="text-yellow-600">Arşivlendi</div>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Yeni Dosya Yükle
              </Button>
              <a href="/dashboard/students">
                <Button>Öğrenci Listesine Git</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
