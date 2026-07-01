"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { CheckCheck, BookOpen, CheckCircle2, BookPlus } from "lucide-react";
import { getClassName, type Role, type StudentWithClass, type ReadingLog } from "@/lib/types/database";

interface Props {
  students: StudentWithClass[];
  classes: { id: string; name: string }[];
  todayLogs: ReadingLog[];
  activeBooks: { student_id: string; started_at: string; books: { title: string } | { title: string }[] | null }[];
  books: { id: string; title: string }[];
  userId: string;
  role: Role;
}

function getBookTitle(book: { student_id: string; books: { title: string } | { title: string }[] | null } | undefined): string | null {
  if (!book?.books) return null;
  if (Array.isArray(book.books)) return book.books[0]?.title || null;
  return book.books.title || null;
}

interface StudentRowState {
  studentId: string;
  classId: string;
  broughtBook: boolean;
  didRead: boolean;
  activeBookTitle: string | null;
  activeBookStartedAt: string | null;
  saved: boolean;
}

export function DailyTracking({ students, classes, todayLogs, activeBooks, books, userId, role }: Props) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "all");
  const [saving, setSaving] = useState<string | null>(null);
  // Book assignment dialog
  const [bookDialogStudent, setBookDialogStudent] = useState<StudentRowState | null>(null);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [showNewBookForm, setShowNewBookForm] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookAuthor, setNewBookAuthor] = useState("");
  const [addingBook, setAddingBook] = useState(false);
  const { toast } = useToast();

  const isWeekend = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  }, []);

  const initialState: Map<string, StudentRowState> = new Map();
  students.forEach((s) => {
    const log = todayLogs.find((l) => l.student_id === s.id);
    const book = activeBooks.find((ab) => ab.student_id === s.id);
    initialState.set(s.id, {
      studentId: s.id,
      classId: s.class_id,
      broughtBook: log?.brought_book || false,
      didRead: log?.did_read || false,
      activeBookTitle: getBookTitle(book),
      activeBookStartedAt: book?.started_at || null,
      saved: !!log,
    });
  });

  const [stateMap, setStateMap] = useState(initialState);
  const [, setTick] = useState(0);

  const filteredStudents = useMemo(() => {
    if (selectedClassId === "all") return students;
    return students.filter((s) => s.class_id === selectedClassId);
  }, [students, selectedClassId]);

  // ── Inline book assignment ──────────────────────────────────────
  function openBookDialog(st: StudentRowState) {
    setBookDialogStudent(st);
    setSelectedBookId("");
    setBookSearch("");
    setShowNewBookForm(false);
    setNewBookTitle("");
    setNewBookAuthor("");
  }

  async function handleAddNewBook() {
    const title = newBookTitle.trim();
    if (!title) { toast("Lutfen kitap adini girin", "error"); return; }

    setAddingBook(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("books")
      .insert({
        title,
        author: newBookAuthor.trim() || null,
        school_id: students[0]?.school_id,
        added_by: userId,
      })
      .select()
      .single();

    if (error) {
      toast("Kitap eklenirken hata: " + error.message, "error");
    } else if (data) {
      toast(`"${title}" kutuphaneye eklendi`, "success");
      setSelectedBookId(data.id);
      setShowNewBookForm(false);
      setNewBookTitle("");
      setNewBookAuthor("");
    }
    setAddingBook(false);
  }

  async function handleAssignBook() {
    if (!bookDialogStudent || !selectedBookId) return;
    setAssigning(true);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    // Mevcut aktif kitabı tamamla
    await supabase
      .from("student_books")
      .update({ status: "completed", finished_at: today })
      .eq("student_id", bookDialogStudent.studentId)
      .eq("status", "active");

    // Yeni kitabı ata
    const { error } = await supabase.from("student_books").insert({
      student_id: bookDialogStudent.studentId,
      book_id: selectedBookId,
      status: "active",
      started_at: today,
    });

    if (!error) {
      const book = books.find((b) => b.id === selectedBookId);
      const updated = {
        ...bookDialogStudent,
        activeBookTitle: book?.title || null,
        activeBookStartedAt: today,
      };
      setStateMap(new Map(stateMap.set(bookDialogStudent.studentId, updated)));
      setTick((t) => t + 1);
      toast(`"${book?.title}" atandı`, "success");
      setBookDialogStudent(null);
    } else {
      toast("Hata: " + error.message, "error");
    }
    setAssigning(false);
  }

  // ── Update reading field ────────────────────────────────────────
  async function updateField(studentId: string, classId: string, field: "broughtBook" | "didRead", value: boolean) {
    if (isWeekend) { toast("Hafta sonu takip kaydı girilemez.", "error"); return; }
    const current = stateMap.get(studentId)!;
    const updated = { ...current, [field]: value };
    setStateMap(new Map(stateMap.set(studentId, updated)));
    setTick((t) => t + 1);

    setSaving(`${studentId}-${field}`);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("reading_logs").upsert(
      {
        student_id: studentId,
        class_id: classId,
        log_date: today,
        brought_book: updated.broughtBook,
        did_read: updated.didRead,
        marked_by: userId,
      },
      { onConflict: "student_id, log_date" }
    );

    if (!error) {
      setStateMap(new Map(stateMap.set(studentId, { ...stateMap.get(studentId)!, saved: true })));
    }
    setSaving(null);
  }

  // ── Mark all ───────────────────────────────────────────────────
  async function markAll() {
    if (isWeekend) { toast("Hafta sonu toplu işaretleme yapılamaz.", "error"); return; }
    const toUpdate = filteredStudents.filter((s) => {
      const st = stateMap.get(s.id);
      return st && (!st.broughtBook || !st.didRead);
    });
    if (toUpdate.length === 0) { toast("Tüm öğrenciler zaten işaretlenmiş", "info"); return; }

    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const upserts = toUpdate.map((s) => ({
      student_id: s.id, class_id: s.class_id, log_date: today,
      brought_book: true, did_read: true, marked_by: userId,
    }));

    const { error } = await supabase.from("reading_logs").upsert(upserts, { onConflict: "student_id, log_date" });
    if (!error) {
      const newMap = new Map(stateMap);
      toUpdate.forEach((s) => {
        newMap.set(s.id, {
          ...stateMap.get(s.id)!,
          broughtBook: true, didRead: true, saved: true,
        });
      });
      setStateMap(newMap);
      setTick((t) => t + 1);
      toast(`${toUpdate.length} öğrenci işaretlendi`, "success");
    } else {
      toast("Hata: " + error.message, "error");
    }
  }

  // ── Finish book ─────────────────────────────────────────────────
  async function handleFinishBook(studentId: string) {
    if (!confirm("Öğrencinin bu kitabı bitirdiğini onaylıyor musunuz?")) return;
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase
      .from("student_books")
      .update({ status: "completed", finished_at: today })
      .eq("student_id", studentId)
      .eq("status", "active");

    if (!error) {
      const current = stateMap.get(studentId)!;
      setStateMap(new Map(stateMap.set(studentId, {
        ...current, activeBookTitle: null, activeBookStartedAt: null,
      })));
      setTick((t) => t + 1);
      toast("Kitap bitirildi. Yeni kitap atayabilirsiniz.", "success");
    } else {
      toast("Hata: " + error.message, "error");
    }
  }

  const uniqueClassIds = [...new Set(students.map((s) => s.class_id))];
  const filteredClasses = classes.filter((c) => uniqueClassIds.includes(c.id));

  // ── Book cell helper ─────────────────────────────────────────────
  function BookCell({ st, compact = false }: { st: StudentRowState; compact?: boolean }) {
    if (st.activeBookTitle) {
      return (
        <div className={compact ? "rounded-lg border border-primary/20 bg-primary/5 px-3 py-2" : "flex flex-col gap-0.5"}>
          {compact ? (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{st.activeBookTitle}</span>
                </div>
                {st.activeBookStartedAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    📅 Başlama: <span className="font-medium text-foreground">{new Date(st.activeBookStartedAt).toLocaleDateString("tr-TR")}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-green-500 text-green-600 hover:bg-green-50 h-7 px-2"
                  onClick={() => handleFinishBook(st.studentId)}
                >
                  Bitirdi ✓
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => openBookDialog(st)}
                >
                  <BookPlus className="h-3 w-3 mr-1" />Değiştir
                </Button>
              </div>
            </div>
          ) : (
            <>
              <span className="text-sm font-semibold text-primary flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                {st.activeBookTitle}
              </span>
              {st.activeBookStartedAt && (
                <span className="text-xs text-muted-foreground">
                  📅 Başlama: <span className="font-medium text-foreground">{new Date(st.activeBookStartedAt).toLocaleDateString("tr-TR")}</span>
                </span>
              )}
              <div className="flex gap-1 mt-1">
                <Button
                  variant="outline"
                  className="h-6 px-2 text-xs border-green-500 text-green-600 hover:bg-green-50 font-normal"
                  onClick={() => handleFinishBook(st.studentId)}
                >
                  Bitirdi ✓
                </Button>
                <Button
                  variant="outline"
                  className="h-6 px-2 text-xs font-normal"
                  onClick={() => openBookDialog(st)}
                >
                  <BookPlus className="h-3 w-3 mr-1" />Değiştir
                </Button>
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <div className={compact
        ? "rounded-lg border border-dashed border-orange-300 bg-orange-50/50 px-3 py-2 flex items-center justify-between gap-2"
        : "flex items-center gap-2"
      }>
        <p className="text-xs text-orange-600 flex items-center gap-1">
          <BookOpen className="h-3 w-3" /> Kitap atanmamış
        </p>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 px-2 border-primary/40 text-primary hover:bg-primary/5 shrink-0"
          onClick={() => openBookDialog(st)}
        >
          <BookPlus className="h-3 w-3 mr-1" />Kitap Ata
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isWeekend && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
          Hafta sonu okuma takibi yapılmamaktadır.
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="flex-1 sm:w-auto">
            <option value="all">Tüm Sınıflar</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Badge variant="secondary" className="shrink-0">{filteredStudents.length} öğrenci</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={markAll} disabled={isWeekend} className="w-full sm:w-auto">
          <CheckCheck className="h-4 w-4 mr-1" /> Tümünü İşaretle
        </Button>
      </div>

      {/* ── MOBILE: card list ──────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {filteredStudents.length === 0 && (
          <div className="text-center text-muted-foreground py-10">Bu sınıfta öğrenci bulunamadı</div>
        )}
        {filteredStudents.map((s) => {
          const st = stateMap.get(s.id);
          if (!st) return null;
          return (
            <Card key={s.id} className={st.saved ? "border-green-200 bg-green-50/30" : ""}>
              <CardContent className="p-3 space-y-2.5">
                {/* Name + class + save indicator */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{s.full_name}</p>
                    <Badge variant="outline" className="text-xs mt-0.5">{getClassName(s)}</Badge>
                  </div>
                  {st.saved && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
                </div>

                {/* Book info (always visible, with inline assign) */}
                <BookCell st={st} compact={true} />

                {/* Switches */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 flex-1">
                    <Switch
                      checked={st.broughtBook}
                      onCheckedChange={(v) => updateField(s.id, s.class_id, "broughtBook", v)}
                      disabled={isWeekend}
                    />
                    <span className="text-sm">Kitap Getirdi</span>
                  </label>
                  <label className="flex items-center gap-2 flex-1">
                    <Switch
                      checked={st.didRead}
                      onCheckedChange={(v) => updateField(s.id, s.class_id, "didRead", v)}
                      disabled={isWeekend}
                    />
                    <span className="text-sm">Okudu</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── DESKTOP: table ────────────────────────────────── */}
      <div className="hidden sm:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Öğrenci</TableHead>
                  <TableHead>Sınıf</TableHead>
                  <TableHead>Aktif Kitap / Atama</TableHead>
                  <TableHead className="text-center w-28">Kitap Getirdi</TableHead>
                  <TableHead className="text-center w-24">Okudu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Bu sınıfta öğrenci bulunamadı
                    </TableCell>
                  </TableRow>
                )}
                {filteredStudents.map((s) => {
                  const st = stateMap.get(s.id);
                  if (!st) return null;
                  return (
                    <TableRow key={s.id} className={st.saved ? "bg-green-50/50" : ""}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell><Badge variant="outline">{getClassName(s)}</Badge></TableCell>
                      <TableCell>
                        <BookCell st={st} compact={false} />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={st.broughtBook}
                            onCheckedChange={(v) => updateField(s.id, s.class_id, "broughtBook", v)}
                            disabled={isWeekend}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={st.didRead}
                            onCheckedChange={(v) => updateField(s.id, s.class_id, "didRead", v)}
                            disabled={isWeekend}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Book Assignment Dialog ─────────────────────────── */}
      <Dialog open={!!bookDialogStudent} onOpenChange={(open) => !open && setBookDialogStudent(null)}>
        <DialogHeader>
          <DialogTitle>
            {bookDialogStudent?.activeBookTitle ? "Kitap Değiştir" : "Kitap Ata"}
          </DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setBookDialogStudent(null)} />
        <div className="mt-4 space-y-4">
          {bookDialogStudent?.activeBookTitle && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              Mevcut kitap: <span className="font-medium text-foreground">{bookDialogStudent.activeBookTitle}</span>
              <br />
              <span className="text-xs">Yeni kitap atanınca mevcut kitap tamamlandı olarak işaretlenir.</span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="book-search-dialog">Kitap Ara</Label>
            <input
              id="book-search-dialog"
              type="text"
              value={bookSearch}
              onChange={(e) => { setBookSearch(e.target.value); setSelectedBookId(""); }}
              placeholder="Kitap adi yazarak ara..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto border rounded-md">
              {books
                .filter((b) => !bookSearch || b.title.toLowerCase().includes(bookSearch.toLowerCase()))
                .slice(0, 50)
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBookId(b.id === selectedBookId ? "" : b.id)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      b.id === selectedBookId
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted"
                    }`}
                  >
                    {b.title}
                  </button>
                ))}
              {books.filter((b) => !bookSearch || b.title.toLowerCase().includes(bookSearch.toLowerCase())).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Kitap bulunamadi</p>
              )}
            </div>

            {/* Yeni Kitap Ekle */}
            {!showNewBookForm ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShowNewBookForm(true)}
              >
                <BookPlus className="h-3.5 w-3.5 mr-1" /> Kutuphaneye Yeni Kitap Ekle
              </Button>
            ) : (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <p className="text-xs font-semibold">Yeni Kitap Ekle</p>
                <input
                  type="text"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  placeholder="Kitap adi *"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <input
                  type="text"
                  value={newBookAuthor}
                  onChange={(e) => setNewBookAuthor(e.target.value)}
                  placeholder="Yazar (opsiyonel)"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setShowNewBookForm(false)}>Iptal</Button>
                  <Button size="sm" onClick={handleAddNewBook} disabled={addingBook || !newBookTitle.trim()}>
                    {addingBook ? "Ekleniyor..." : "Ekle"}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBookDialogStudent(null)}>İptal</Button>
            <Button onClick={handleAssignBook} disabled={assigning || !selectedBookId}>
              {assigning ? "Atanıyor..." : "Kitap Ata"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
