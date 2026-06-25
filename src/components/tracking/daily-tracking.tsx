"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { CheckCheck, BookOpen } from "lucide-react";
import { getClassName, type Role, type StudentWithClass, type ReadingLog } from "@/lib/types/database";

interface Props {
  students: StudentWithClass[];
  classes: { id: string; name: string }[];
  todayLogs: ReadingLog[];
  activeBooks: { student_id: string; started_at: string; books: { title: string } | { title: string }[] | null }[];
  userId: string;
  role: Role;
}

function getBookTitle(book: { student_id: string; books: { title: string } | { title: string }[] | null } | undefined): string | null {
  if (!book?.books) return null;
  if (Array.isArray(book.books)) {
    return book.books[0]?.title || null;
  }
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

export function DailyTracking({ students, classes, todayLogs, activeBooks, userId, role }: Props) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "all");
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  const isWeekend = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
  }, []);

  // Build initial state
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
  // Force re-render counter
  const [, setTick] = useState(0);

  const filteredStudents = useMemo(() => {
    if (selectedClassId === "all") return students;
    return students.filter((s) => s.class_id === selectedClassId);
  }, [students, selectedClassId]);

  async function updateField(studentId: string, classId: string, field: "broughtBook" | "didRead", value: boolean) {
    if (isWeekend) {
      toast("Hafta sonu takip kaydı girilemez.", "error");
      return;
    }
    const current = stateMap.get(studentId)!;
    const updated = { ...current, [field]: value };
    setStateMap(new Map(stateMap.set(studentId, updated)));
    setTick((t) => t + 1);

    setSaving(`${studentId}-${field}`);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase
      .from("reading_logs")
      .upsert(
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
      const newState = stateMap.get(studentId)!;
      setStateMap(new Map(stateMap.set(studentId, { ...newState, saved: true })));
    }

    setSaving(null);
  }

  async function markAll() {
    if (isWeekend) {
      toast("Hafta sonu toplu işaretleme yapılamaz.", "error");
      return;
    }
    const toUpdate = filteredStudents.filter((s) => {
      const st = stateMap.get(s.id);
      return st && (!st.broughtBook || !st.didRead);
    });

    if (toUpdate.length === 0) {
      toast("Tüm öğrenciler zaten işaretlenmiş", "info");
      return;
    }

    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const upserts = toUpdate.map((s) => ({
      student_id: s.id,
      class_id: s.class_id,
      log_date: today,
      brought_book: true,
      did_read: true,
      marked_by: userId,
    }));

    const { error } = await supabase.from("reading_logs").upsert(upserts, { onConflict: "student_id, log_date" });

    if (!error) {
      const newMap = new Map(stateMap);
      toUpdate.forEach((s) => {
        newMap.set(s.id, {
          studentId: s.id,
          classId: s.class_id,
          broughtBook: true,
          didRead: true,
          activeBookTitle: stateMap.get(s.id)?.activeBookTitle || null,
          activeBookStartedAt: stateMap.get(s.id)?.activeBookStartedAt || null,
          saved: true,
        });
      });
      setStateMap(newMap);
      setTick((t) => t + 1);
      toast(`${toUpdate.length} öğrenci işaretlendi`, "success");
    } else {
      toast("Hata oluştu: " + error.message, "error");
    }
  }

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
      const updated = { ...current, activeBookTitle: null, activeBookStartedAt: null };
      setStateMap(new Map(stateMap.set(studentId, updated)));
      setTick((t) => t + 1);
      toast("Kitap başarıyla bitirildi olarak işaretlendi", "success");
    } else {
      toast("Hata oluştu: " + error.message, "error");
    }
  }

  // Class filtering
  const uniqueClassIds = [...new Set(students.map((s) => s.class_id))];
  const filteredClasses = classes.filter((c) => uniqueClassIds.includes(c.id));

  return (
    <div className="space-y-4">
      {isWeekend && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
          Hafta sonu okuma takibi yapılmamaktadır. Takip kayıtları yalnızca hafta içi günlerinde girilebilir.
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-auto">
            <option value="all">Tüm Sınıflar</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Badge variant="secondary">{filteredStudents.length} öğrenci</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={markAll} disabled={isWeekend}>
          <CheckCheck className="h-4 w-4 mr-1" /> Tümünü Getirdi+Okudu İşaretle
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Öğrenci</TableHead>
                <TableHead>Sınıf</TableHead>
                <TableHead>Aktif Kitap</TableHead>
                <TableHead className="text-center w-28">Kitap Getirdi</TableHead>
                <TableHead className="text-center w-28">Okudu</TableHead>
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
                      {st.activeBookTitle ? (
                        <div className="flex items-center justify-between gap-2 max-w-xs">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium flex items-center gap-1">
                              <BookOpen className="h-3 w-3 text-muted-foreground" />
                              {st.activeBookTitle}
                            </span>
                            {st.activeBookStartedAt && (
                              <span className="text-[11px] text-muted-foreground">
                                Başlangıç: {new Date(st.activeBookStartedAt).toLocaleDateString("tr-TR")}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            className="h-6 px-2 text-xs border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 ml-2 font-normal"
                            onClick={() => handleFinishBook(s.id)}
                            disabled={isWeekend}
                          >
                            Bitirdi
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
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
  );
}
