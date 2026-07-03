"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Upload, Check, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import type { Class } from "@/lib/types/database";

interface Props {
  classes: Class[];
  schoolId: string;
}

interface ParsedStudent {
  fullName: string;
  eOkulNo: string;
  className: string;
  classId: string; // matched
  veliTelefon: string;
  veliTelefon2: string;
}

export function ExcelImport({ classes, schoolId }: Props) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [nameCol, setNameCol] = useState("");
  const [eOkulCol, setEOkulCol] = useState("");
  const [classCol, setClassCol] = useState("");
  const [veliCol, setVeliCol] = useState("");
  const [veli2Col, setVeli2Col] = useState("");
  const [parsed, setParsed] = useState<ParsedStudent[]>([]);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const { toast } = useToast();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      if (data.length === 0) {
        setErrors(["Dosyada veri bulunamadı."]);
        return;
      }
      setRawData(data);
      setHeaders(Object.keys(data[0]));
      // Auto-detect columns
      const h = Object.keys(data[0]);
      const nameCandidate = h.find((k) => /ad.*soyad|isim|adı|name/i.test(k)) || h[0];
      const noCandidate = h.find((k) => /okul.*no|no|numara/i.test(k)) || "";
      const classCandidate = h.find((k) => /sınıf|sinif|class/i.test(k)) || "";
      const veliCandidate = h.find((k) => /veli.*tel|veli.*telefon|telefon|phone|tel/i.test(k)) || "";
      const veli2Candidate = h.find((k) => /veli.*tel.*2|veli.*telefon.*2|telefon.*2|phone.*2|tel.*2/i.test(k)) || "";
      setNameCol(nameCandidate);
      setEOkulCol(noCandidate);
      setClassCol(classCandidate);
      setVeliCol(veliCandidate);
      setVeli2Col(veli2Candidate);
      setStep("map");
    };
    reader.readAsBinaryString(file);
  }

  function handleMap() {
    const result: ParsedStudent[] = [];
    const errs: string[] = [];
    // Build class name -> id map
    const classMap = new Map<string, string>();
    classes.forEach((c) => classMap.set(c.name.toLowerCase().trim(), c.id));

    rawData.forEach((row, i) => {
      const fullName = (row[nameCol] || "").trim();
      const eOkulNo = (row[eOkulCol] || "").trim();
      const className = (row[classCol] || "").trim();
      const veliTelefon = (row[veliCol] || "").trim();
      const veliTelefon2 = (row[veli2Col] || "").trim();

      if (!fullName) {
        errs.push(`Satır ${i + 2}: İsim alanı boş`);
        return;
      }

      let matchedClassId = classMap.get(className.toLowerCase());
      if (!matchedClassId) {
        // Try partial match
        for (const [cname, cid] of classMap) {
          if (className.toLowerCase().includes(cname) || cname.includes(className.toLowerCase())) {
            matchedClassId = cid;
            break;
          }
        }
      }

      result.push({ fullName, eOkulNo, className, classId: matchedClassId || "", veliTelefon, veliTelefon2 });
    });

    if (result.length === 0) {
      errs.push("Geçerli öğrenci kaydı bulunamadı.");
    }

    setErrors(errs);
    setParsed(result);
    setStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    const supabase = createClient();

    // Create missing classes
    const missingClasses = [...new Set(parsed.filter((p) => !p.classId).map((p) => p.className))];
    const newClassIds: Record<string, string> = {};

    for (const cname of missingClasses) {
      if (cname) {
        const gradeMatch = cname.match(/(\d+)/);
        const grade = gradeMatch ? parseInt(gradeMatch[1]) : 1;
        const { data } = await supabase
          .from("classes")
          .insert({ name: cname, grade_level: grade, school_id: schoolId })
          .select()
          .single();
        if (data) newClassIds[cname] = data.id;
      }
    }

    // Akilli eslestirme: okul no + isme gore guncelle, degilse ekle
    let updated = 0;
    let created = 0;
    const updatedStudentIds: string[] = [];

    for (const p of parsed) {
      const targetClassId = p.classId || newClassIds[p.className] || classes[0]?.id;
      const payload = {
        full_name: p.fullName,
        class_id: targetClassId,
        school_id: schoolId,
        is_active: true,
        veli_telefon: p.veliTelefon || null,
        veli_telefon_2: p.veliTelefon2 || null,
      };

      if (p.eOkulNo) {
        // Okul numarasina gore mevcut ogrenciyi bul
        const { data: existing } = await supabase
          .from("students")
          .select("id, full_name, is_active, class_id")
          .eq("school_id", schoolId)
          .eq("e_okul_no", p.eOkulNo)
          .maybeSingle();

        if (existing) {
          // Ayni okul no - isim eslesiyor mu kontrol et
          const nameMatch = existing.full_name.toLowerCase().trim() === p.fullName.toLowerCase().trim();
          if (nameMatch) {
            // Ayni ogrenci → guncelle (sinif yukseltme, aktif yap)
            await supabase.from("students").update(payload).eq("id", existing.id);
            updatedStudentIds.push(existing.id);
            updated++;
            continue;
          }
          // Okul no ayni ama isim farkli → numara baskasiya verilmis
          // Bu yeni ogrenci, eski ogrenciyi pasife alip yeni ekleyelim
          await supabase.from("students").update({ is_active: false }).eq("id", existing.id);
          const { data: newStudent } = await supabase
            .from("students")
            .insert(payload)
            .select("id")
            .single();
          if (newStudent) updatedStudentIds.push(newStudent.id);
          created++;
          continue;
        }
      }

      // Isim eslesmesine gore dene (okul no yoksa veya eslesmediyse)
      const { data: nameMatch } = await supabase
        .from("students")
        .select("id, is_active")
        .eq("school_id", schoolId)
        .eq("full_name", p.fullName)
        .maybeSingle();

      if (nameMatch) {
        // Ayni isimde var → guncelle (okul no yeni atanmis olabilir)
        await supabase.from("students").update({ ...payload, e_okul_no: p.eOkulNo || null }).eq("id", nameMatch.id);
        updatedStudentIds.push(nameMatch.id);
        updated++;
      } else {
        // Tamamen yeni ogrenci
        const { data: newStudent } = await supabase
          .from("students")
          .insert({ ...payload, e_okul_no: p.eOkulNo || null })
          .select("id")
          .single();
        if (newStudent) updatedStudentIds.push(newStudent.id);
        created++;
      }
    }

    // Import listesinde OLMAYAN aktif ogrencileri pasife al (mezun/ayrilan)
    const { data: activeStudents } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .eq("is_active", true);

    if (activeStudents) {
      const activeIds = activeStudents.map((s) => s.id);
      const toDeactivate = activeIds.filter((id) => !updatedStudentIds.includes(id));
      if (toDeactivate.length > 0) {
        await supabase
          .from("students")
          .update({ is_active: false })
          .in("id", toDeactivate);
      }
      toast(`${updated} ogrenci guncellendi, ${created} ogrenci eklendi, ${toDeactivate.length} ogrenci pasife alindi!`, "success");
    } else {
      toast(`${updated} ogrenci guncellendi, ${created} ogrenci eklendi!`, "success");
    }

    setImporting(false);
    setStep("done");
  }

  return (
    <div className="max-w-3xl">
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Excel Dosyası Yükle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <Label
                htmlFor="file-upload"
                className="cursor-pointer text-primary hover:underline block mb-2"
              >
                .xlsx dosyası seçin
              </Label>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="hidden"
              />
              <p className="text-sm text-muted-foreground">
                e-Okul'dan indirilen Excel dosyasını buraya yükleyin
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>Sütun Eşleştirme</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {rawData.length} satır bulundu. Sütunları eşleştirin:
            </p>
            <div className="flex flex-col gap-2">
              <Label>Ad Soyad Sütunu</Label>
              <Select value={nameCol} onChange={(e) => setNameCol(e.target.value)}>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>e-Okul No Sütunu (opsiyonel)</Label>
              <Select value={eOkulCol} onChange={(e) => setEOkulCol(e.target.value)}>
                <option value="">-- Yok --</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Sınıf Sütunu</Label>
              <Select value={classCol} onChange={(e) => setClassCol(e.target.value)}>
                <option value="">-- Yok --</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Veli Telefon Sütunu (opsiyonel)</Label>
              <Select value={veliCol} onChange={(e) => setVeliCol(e.target.value)}>
                <option value="">-- Yok --</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>2. Veli Telefon Sütunu (opsiyonel)</Label>
              <Select value={veli2Col} onChange={(e) => setVeli2Col(e.target.value)}>
                <option value="">-- Yok --</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>Geri</Button>
              <Button onClick={handleMap}>Önizle</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Önizleme ({parsed.length} öğrenci)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                {errors.map((e, i) => (
                  <p key={i} className="text-sm text-yellow-800 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {e}
                  </p>
                ))}
              </div>
            )}
            <div className="max-h-64 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>e-Okul No</TableHead>
                    <TableHead>Sınıf</TableHead>
                    <TableHead>Veli Tel.</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.slice(0, 20).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.fullName}</TableCell>
                      <TableCell>{p.eOkulNo || "-"}</TableCell>
                      <TableCell>{p.className || "-"}</TableCell>
                      <TableCell>{p.veliTelefon || "-"}</TableCell>
                      <TableCell>
                        {p.classId ? (
                          <Badge variant="success"><Check className="h-3 w-3 mr-1" /> Eşleşti</Badge>
                        ) : (
                          <Badge variant="warning">Yeni sınıf oluşturulacak</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsed.length > 20 && (
              <p className="text-sm text-muted-foreground">... ve {parsed.length - 20} öğrenci daha</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>Geri</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "İçe aktarılıyor..." : `${parsed.length} Öğrenciyi İçe Aktar`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="py-8 text-center">
            <Check className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <h3 className="text-lg font-semibold mb-2">İçe Aktarma Tamamlandı!</h3>
            <p className="text-muted-foreground mb-4">{parsed.length} öğrenci başarıyla içe aktarıldı.</p>
            <Button onClick={() => { setStep("upload"); setParsed([]); setRawData([]); }}>
              Yeni Dosya Yükle
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
