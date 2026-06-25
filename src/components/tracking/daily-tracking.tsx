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
  activeBooks: { student_id: string; books: { title: string } | { title: string }[] | null }[];
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
  saved: boolean;
}

export function DailyTracking({ students, classes, todayLogs, activeBooks, userId, role }: Props) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "all");
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

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

  // Class filtering
  const uniqueClassIds = [...new Set(students.map((s) => s.class_id))];
  const filteredClasses = classes.filter((c) => uniqueClassIds.includes(c.id));

  return (
    <div className="space-y-4">
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
        <Button variant="outline" size="sm" onClick={markAll}>
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
                        <span className="text-sm flex items-center gap-1">
                          <BookOpen className="h-3 w-3 text-muted-foreground" />
                          {st.activeBookTitle}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={st.broughtBook}
                          onCheckedChange={(v) => updateField(s.id, s.class_id, "broughtBook", v)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={st.didRead}
                          onCheckedChange={(v) => updateField(s.id, s.class_id, "didRead", v)}
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
