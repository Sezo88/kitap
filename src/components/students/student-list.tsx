"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2, BookPlus, ExternalLink, BookOpen, Download, Upload } from "lucide-react";
import Link from "next/link";
import { getClassName, type Role, type Class, type Book, type StudentWithClass } from "@/lib/types/database";
import * as XLSX from "xlsx";

interface Props {
  students: (StudentWithClass)[];
  classes: Class[];
  books: Pick<Book, "id" | "title">[];
  role: Role;
  schoolId: string;
  canEdit: boolean;
}

export function StudentList({ students: initialStudents, classes, books, role, schoolId, canEdit }: Props) {
  const [students, setStudents] = useState(initialStudents);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentWithClass | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithClass | null>(null);
  const [fullName, setFullName] = useState("");
  const [classId, setClassId] = useState("");
  const [eOkulNo, setEOkulNo] = useState("");
  const [veliTelefon, setVeliTelefon] = useState("");
  const [veliTelefon2, setVeliTelefon2] = useState("");
  const [selectedBookId, setSelectedBookId] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  const filtered = students.filter((s) => {
    const matchesClass = selectedClassId === "all" || s.class_id === selectedClassId;
    if (!matchesClass) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      (s.e_okul_no && s.e_okul_no.includes(q)) ||
      getClassName(s).toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setEditingStudent(null);
    setFullName("");
    setClassId(classes[0]?.id || "");
    setEOkulNo("");
    setVeliTelefon("");
    setVeliTelefon2("");
    setDialogOpen(true);
  }

  function openEdit(s: StudentWithClass) {
    setEditingStudent(s);
    setFullName(s.full_name);
    setClassId(s.class_id);
    setEOkulNo(s.e_okul_no || "");
    setVeliTelefon(s.veli_telefon || "");
    setVeliTelefon2(s.veli_telefon_2 || "");
    setDialogOpen(true);
  }

  function openBookSelect(s: StudentWithClass) {
    setSelectedStudent(s);
    setSelectedBookId("");
    setBookDialogOpen(true);
  }

  async function handleSave() {
    if (!fullName.trim() || !classId) return;
    setSaving(true);
    const supabase = createClient();

    if (editingStudent) {
      await supabase
        .from("students")
        .update({
          full_name: fullName,
          class_id: classId,
          e_okul_no: eOkulNo || null,
          veli_telefon: veliTelefon || null,
          veli_telefon_2: veliTelefon2 || null
        })
        .eq("id", editingStudent.id);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === editingStudent.id
            ? {
                ...s,
                full_name: fullName,
                class_id: classId,
                e_okul_no: eOkulNo || null,
                veli_telefon: veliTelefon || null,
                veli_telefon_2: veliTelefon2 || null,
                classes: classes.find((c) => c.id === classId) || s.classes
              }
            : s
        )
      );
      toast("Öğrenci güncellendi", "success");
    } else {
      const { data } = await supabase
        .from("students")
        .insert({
          full_name: fullName,
          class_id: classId,
          school_id: schoolId,
          e_okul_no: eOkulNo || null,
          veli_telefon: veliTelefon || null,
          veli_telefon_2: veliTelefon2 || null
        })
        .select("*, classes!inner(name)")
        .single();
      if (data) setStudents((prev) => [...prev, data as StudentWithClass]);
      toast("Öğrenci eklendi", "success");
    }

    setSaving(false);
    setDialogOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu öğrenciyi silmek istediğinize emin misiniz?")) return;
    const supabase = createClient();
    await supabase.from("students").update({ is_active: false }).eq("id", id);
    setStudents((prev) => prev.filter((s) => s.id !== id));
    toast("Öğrenci pasife alındı", "success");
  }

  async function handleAssignBook() {
    if (!selectedStudent || !selectedBookId) return;
    setSaving(true);
    const supabase = createClient();

    await supabase
      .from("student_books")
      .update({ status: "completed", finished_at: new Date().toISOString().split("T")[0] })
      .eq("student_id", selectedStudent.id)
      .eq("status", "active");

    await supabase.from("student_books").insert({
      student_id: selectedStudent.id,
      book_id: selectedBookId,
      status: "active",
      started_at: new Date().toISOString().split("T")[0],
    });

    const book = books.find((b) => b.id === selectedBookId);
    setStudents((prev) =>
      prev.map((s) => (s.id === selectedStudent.id ? { ...s, active_book_title: book?.title || null } : s))
    );

    toast("Kitap atandı", "success");
    setSaving(false);
    setBookDialogOpen(false);
  }

  async function handleFinishBook(studentId: string) {
    if (!confirm("Öğrencinin bu kitabı bitirdiğini onaylıyor musunuz?")) return;
    setSaving(true);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase
      .from("student_books")
      .update({ status: "completed", finished_at: today })
      .eq("student_id", studentId)
      .eq("status", "active");

    if (!error) {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, active_book_title: null } : s))
      );
      toast("Kitap başarıyla bitirildi olarak işaretlendi", "success");
    } else {
      toast("Hata oluştu: " + error.message, "error");
    }
    setSaving(false);
  }

  function handleExportVeliTemplate() {
    try {
      const wb = XLSX.utils.book_new();

      classes.forEach((c) => {
        const classStudents = students.filter((s) => s.class_id === c.id);
        const rows = classStudents.map((s) => ({
          "Öğrenci No": s.e_okul_no || "",
          "Adı Soyadı": s.full_name,
          "1. Veli Telefonu": s.veli_telefon || "",
          "2. Veli Telefonu": s.veli_telefon_2 || "",
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const safeSheetName = c.name.replace(/[\\\/\?\*\:\[\]]/g, "-").substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      });

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = "veli_telefon_listesi.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
      toast("Veli telefon şablonu başarıyla indirildi", "success");
    } catch (err: any) {
      toast("Şablon oluşturulurken hata: " + err.message, "error");
    }
  }

  async function handleImportVeliPhones(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const supabase = createClient();
        
        let updateCount = 0;
        const updatedStudentsList = [...students];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<any>(sheet);

          for (const row of rows) {
            const ogrenciNo = row["Öğrenci No"]?.toString().trim();
            const adiSoyadi = row["Adı Soyadı"]?.toString().trim();
            const veliTel = row["1. Veli Telefonu"]?.toString().trim();
            const veliTel2 = row["2. Veli Telefonu"]?.toString().trim();

            if (!ogrenciNo && !adiSoyadi) continue;

            const matchedIndex = updatedStudentsList.findIndex(
              (s) =>
                (ogrenciNo && s.e_okul_no?.toString().trim() === ogrenciNo) ||
                (!ogrenciNo && s.full_name.toLowerCase().trim() === adiSoyadi?.toLowerCase())
            );

            if (matchedIndex !== -1) {
              const matchedStudent = updatedStudentsList[matchedIndex];
              const hasChanges = 
                (veliTel !== undefined && matchedStudent.veli_telefon !== (veliTel || null)) ||
                (veliTel2 !== undefined && matchedStudent.veli_telefon_2 !== (veliTel2 || null));

              if (hasChanges) {
                const updatePayload: any = {};
                if (veliTel !== undefined) updatePayload.veli_telefon = veliTel || null;
                if (veliTel2 !== undefined) updatePayload.veli_telefon_2 = veliTel2 || null;

                const { error } = await supabase
                  .from("students")
                  .update(updatePayload)
                  .eq("id", matchedStudent.id);

                if (!error) {
                  updatedStudentsList[matchedIndex] = {
                    ...matchedStudent,
                    ...updatePayload
                  };
                  updateCount++;
                }
              }
            }
          }
        }

        setStudents(updatedStudentsList);
        toast(`Başarıyla ${updateCount} öğrencinin veli telefonu güncellendi!`, "success");
        setImportDialogOpen(false);
      } catch (err: any) {
        toast("Excel okunurken hata oluştu: " + err.message, "error");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  }

  return (
    <>
      {/* ── Filters & Actions ───────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-2">
          <Input
            placeholder="İsim veya e-Okul no ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-36 shrink-0"
          >
            <option value="all">Tüm Sınıflar</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        {canEdit && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:self-end">
            <Button onClick={handleExportVeliTemplate} size="sm" variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-1" /> Veli Tel Şablonu İndir
            </Button>
            <Button onClick={() => setImportDialogOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto">
              <Upload className="h-4 w-4 mr-1" /> Veli Tel İçe Aktar
            </Button>
            <Button onClick={openCreate} size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Yeni Öğrenci
            </Button>
          </div>
        )}
      </div>

      {/* ── MOBILE: card list ────────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-10">
            {search ? "Aramanızla eşleşen öğrenci bulunamadı" : "Henüz öğrenci eklenmemiş"}
          </div>
        )}
        {filtered.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{s.full_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-xs">{getClassName(s)}</Badge>
                    {s.e_okul_no && <span className="text-xs text-muted-foreground">#{s.e_okul_no}</span>}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-0.5">
                  <Link href={`/dashboard/profile/${s.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Profil">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBookSelect(s)} title="Kitap Ata">
                    <BookPlus className="h-4 w-4" />
                  </Button>
                  {canEdit && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {/* Active book */}
              {s.active_book_title ? (
                <div className="flex items-center justify-between gap-2 bg-muted/60 rounded-md px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5 text-sm min-w-0">
                    <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{s.active_book_title}</span>
                  </div>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-green-500 text-green-600 hover:bg-green-50 h-7 px-2 shrink-0"
                      onClick={() => handleFinishBook(s.id)}
                    >
                      Bitirdi
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Kitap atanmamış</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── DESKTOP: table ───────────────────────────────────── */}
      <div className="hidden sm:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Sınıf</TableHead>
                  <TableHead>e-Okul No</TableHead>
                  <TableHead>Aktif Kitap</TableHead>
                  <TableHead className="w-32">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {search ? "Aramanızla eşleşen öğrenci bulunamadı" : "Henüz öğrenci eklenmemiş"}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell><Badge variant="outline">{getClassName(s)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{s.e_okul_no || "-"}</TableCell>
                    <TableCell>
                      {s.active_book_title ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{s.active_book_title}</span>
                          {canEdit && (
                            <Button
                              variant="outline"
                              className="h-7 px-2 text-xs border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 font-normal"
                              onClick={() => handleFinishBook(s.id)}
                            >
                              Bitirdi
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Atanmamış</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openBookSelect(s)} title="Kitap Ata">
                          <BookPlus className="h-4 w-4" />
                        </Button>
                        <Link href={`/dashboard/profile/${s.id}`}>
                          <Button variant="ghost" size="icon" title="Profil">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        {canEdit && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Student Create/Edit Dialog ──────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingStudent ? "Öğrenci Düzenle" : "Yeni Öğrenci"}</DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setDialogOpen(false)} />
        <div className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sname">Ad Soyad</Label>
            <Input id="sname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sclass">Sınıf</Label>
            <Select id="sclass" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="enumber">e-Okul No</Label>
            <Input id="enumber" value={eOkulNo} onChange={(e) => setEOkulNo(e.target.value)} placeholder="opsiyonel" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vphone">Veli Telefon Numarası</Label>
            <Input id="vphone" value={veliTelefon} onChange={(e) => setVeliTelefon(e.target.value)} placeholder="+905XXXXXXXXX" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vphone2">2. Veli Telefon Numarası</Label>
            <Input id="vphone2" value={veliTelefon2} onChange={(e) => setVeliTelefon2(e.target.value)} placeholder="+905XXXXXXXXX (opsiyonel)" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        </div>
      </Dialog>

      {/* ── Book Assignment Dialog ──────────────────────────── */}
      <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
        <DialogHeader>
          <DialogTitle>Kitap Ata - {selectedStudent?.full_name}</DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setBookDialogOpen(false)} />
        <div className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="booksel">Kitap Seç</Label>
            <Select id="booksel" value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)}>
              <option value="">Kitap seçin...</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBookDialogOpen(false)}>İptal</Button>
            <Button onClick={handleAssignBook} disabled={saving || !selectedBookId}>
              {saving ? "Atanıyor..." : "Kitap Ata"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Veli Telefon İçe Aktar Dialog ─────────────────────────── */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogHeader>
          <DialogTitle>Veli Telefonlarını İçe Aktar</DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setImportDialogOpen(false)} />
        <div className="flex flex-col gap-4 mt-4 text-sm">
          <p className="text-muted-foreground leading-relaxed">
            İndirip doldurduğunuz veli telefon şablonu Excel dosyasını (.xlsx) yükleyin. Sistem, öğrenci numaralarına göre veli telefonlarını toplu güncelleyecektir.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="excelfile" className="font-semibold">Excel Dosyası Seçin</Label>
            <Input
              id="excelfile"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImportVeliPhones}
              disabled={importing}
              className="cursor-pointer"
            />
          </div>
          {importing && (
            <div className="text-primary text-xs font-semibold animate-pulse">
              Excel okunuyor ve veriler güncelleniyor, lütfen bekleyin...
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t mt-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importing}>Kapat</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
