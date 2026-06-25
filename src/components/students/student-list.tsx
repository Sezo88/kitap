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
import { Plus, Pencil, Trash2, BookPlus, ExternalLink } from "lucide-react";
import Link from "next/link";
import { getClassName, type Role, type Class, type Book, type StudentWithClass } from "@/lib/types/database";

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
  const [selectedBookId, setSelectedBookId] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("all");
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
    setDialogOpen(true);
  }

  function openEdit(s: StudentWithClass) {
    setEditingStudent(s);
    setFullName(s.full_name);
    setClassId(s.class_id);
    setEOkulNo(s.e_okul_no || "");
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
        .update({ full_name: fullName, class_id: classId, e_okul_no: eOkulNo || null })
        .eq("id", editingStudent.id);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === editingStudent.id
            ? { ...s, full_name: fullName, class_id: classId, e_okul_no: eOkulNo || null, classes: classes.find((c) => c.id === classId) || s.classes }
            : s
        )
      );
      toast("Öğrenci güncellendi", "success");
    } else {
      const { data } = await supabase
        .from("students")
        .insert({ full_name: fullName, class_id: classId, school_id: schoolId, e_okul_no: eOkulNo || null })
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

    // Deactivate current active book
    await supabase
      .from("student_books")
      .update({ status: "completed", finished_at: new Date().toISOString().split("T")[0] })
      .eq("student_id", selectedStudent.id)
      .eq("status", "active");

    // Assign new book
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

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2 max-w-md w-full sm:w-auto">
          <Input
            placeholder="İsim, e-Okul no veya sınıf ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-48"
          >
            <option value="all">Tüm Sınıflar</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        {canEdit && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Yeni Öğrenci
          </Button>
        )}
      </div>

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
                            title="Kitabı Bitirdi"
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

      {/* Student Create/Edit Dialog */}
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        </div>
      </Dialog>

      {/* Book Assignment Dialog */}
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
    </>
  );
}
