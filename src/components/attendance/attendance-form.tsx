"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  UserX, UserCheck, Phone, AlertTriangle, Save, Send, Undo2, CheckCircle2,
} from "lucide-react";
import type { AttendanceLog, AttendanceStatus } from "@/lib/types/database";

interface StudentRow {
  id: string;
  full_name: string;
  class_id: string;
  veli_telefon: string | null;
  veli_telefon_2: string | null;
  classes?: { name: string } | { name: string }[] | null;
}

interface Props {
  students: StudentRow[];
  classes: { id: string; name: string }[];
  todayLogs: AttendanceLog[];
  userId: string;
  schoolId: string;
  smsActive: boolean;
  totalLessons: number;
}

function getClassName(s: StudentRow): string {
  if (!s.classes) return "";
  if (Array.isArray(s.classes)) return s.classes[0]?.name || "";
  return s.classes.name || "";
}

interface RowState {
  studentId: string;
  classId: string;
  status: AttendanceStatus;
  saved: boolean;
  logId: string | null;
  smsSent: boolean;
  smsFailed: boolean;
}

export function AttendanceForm({ students, classes, todayLogs, userId, schoolId, smsActive, totalLessons }: Props) {
  const [localStudents, setLocalStudents] = useState<StudentRow[]>(students);
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "all");
  const [lessonNo, setLessonNo] = useState(1);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "single" | "bulk";
    absentStudents: { id: string; name: string; phone: string | null }[];
  } | null>(null);

  // Correction dialog
  const [correctionDialog, setCorrectionDialog] = useState<{
    studentId: string;
    studentName: string;
    phone: string | null;
  } | null>(null);

  // Phone edit dialog
  const [phoneEditDialog, setPhoneEditDialog] = useState<{
    studentId: string;
    studentName: string;
    phone: string;
    phone2: string;
  } | null>(null);

  // Build initial state
  const initialState = useMemo(() => {
    const map = new Map<string, RowState>();
    localStudents.forEach((s) => {
      const log = todayLogs.find((l) => l.student_id === s.id && l.lesson_no === lessonNo);
      map.set(s.id, {
        studentId: s.id,
        classId: s.class_id,
        status: log?.status || "present",
        saved: !!log,
        logId: log?.id || null,
        smsSent: false,
        smsFailed: false,
      });
    });
    return map;
  }, [localStudents, todayLogs, lessonNo]);

  const [stateMap, setStateMap] = useState(initialState);
  const [, setTick] = useState(0);

  // Reset state when lesson changes
  function handleLessonChange(val: string) {
    const num = parseInt(val);
    setLessonNo(num);
    const map = new Map<string, RowState>();
    localStudents.forEach((s) => {
      const log = todayLogs.find((l) => l.student_id === s.id && l.lesson_no === num);
      map.set(s.id, {
        studentId: s.id,
        classId: s.class_id,
        status: log?.status || "present",
        saved: !!log,
        logId: log?.id || null,
        smsSent: false,
        smsFailed: false,
      });
    });
    setStateMap(map);
    setTick((t) => t + 1);
  }

  const filteredStudents = useMemo(() => {
    if (selectedClassId === "all") return localStudents;
    return localStudents.filter((s) => s.class_id === selectedClassId);
  }, [localStudents, selectedClassId]);

  const absentCount = useMemo(() => {
    return filteredStudents.filter((s) => {
      const st = stateMap.get(s.id);
      return st && st.status === "absent";
    }).length;
  }, [filteredStudents, stateMap]);

  // ── Toggle student attendance ──────────────────────────────
  function toggleStudent(studentId: string) {
    const st = stateMap.get(studentId);
    if (!st) return;

    if (st.status === "present") {
      // Present → Absent
      const student = localStudents.find((s) => s.id === studentId);
      if (!student) return;

      // SMS aktifse ve telefon varsa onay penceresi göster
      if (smsActive && student.veli_telefon) {
        setConfirmDialog({
          type: "single",
          absentStudents: [{ id: studentId, name: student.full_name, phone: student.veli_telefon }],
        });
      } else {
        // SMS yok, direkt işaretle
        setStateMap(new Map(stateMap.set(studentId, { ...st, status: "absent" })));
        setTick((t) => t + 1);
      }
    } else if (st.status === "absent") {
      // Absent → Present (geri al — henüz kaydedilmemişse)
      if (!st.saved) {
        setStateMap(new Map(stateMap.set(studentId, { ...st, status: "present" })));
        setTick((t) => t + 1);
      } else {
        // Kaydedilmişse düzeltme akışı
        const student = localStudents.find((s) => s.id === studentId);
        if (student) {
          setCorrectionDialog({
            studentId,
            studentName: student.full_name,
            phone: student.veli_telefon,
          });
        }
      }
    } else if (st.status === "corrected_present") {
      // Already corrected, no toggle
    }
  }

  // ── Confirm absent (single) ─────────────────────────────
  function confirmAbsent() {
    if (!confirmDialog) return;
    confirmDialog.absentStudents.forEach(({ id }) => {
      const st = stateMap.get(id);
      if (st) {
        stateMap.set(id, { ...st, status: "absent" });
      }
    });
    setStateMap(new Map(stateMap));
    setTick((t) => t + 1);
    setConfirmDialog(null);
  }

  // ── Save + Send SMS ────────────────────────────────────────
  async function handleSaveAll() {
    const toSave = filteredStudents.map((s) => {
      const st = stateMap.get(s.id);
      return { student: s, state: st };
    }).filter((x) => x.state);

    const unsaved = toSave.filter((x) => !x.state!.saved);
    if (unsaved.length === 0 && !toSave.some((x) => x.state!.status !== (todayLogs.find((l) => l.student_id === x.student.id && l.lesson_no === lessonNo)?.status || "present"))) {
      toast("Değişiklik yok", "info");
      return;
    }

    // Absent olanlar için SMS onayı
    const absentStudents = toSave
      .filter((x) => x.state!.status === "absent" && !x.state!.saved)
      .map((x) => ({
        id: x.student.id,
        name: x.student.full_name,
        phone: x.student.veli_telefon,
      }));

    if (smsActive && absentStudents.length > 0 && absentStudents.some((a) => a.phone)) {
      setConfirmDialog({ type: "bulk", absentStudents });
      return;
    }

    await doSave();
  }

  async function doSave() {
    setSaving(true);
    setConfirmDialog(null);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const upserts = filteredStudents.map((s) => {
      const st = stateMap.get(s.id)!;
      return {
        student_id: s.id,
        class_id: s.class_id,
        log_date: today,
        lesson_no: lessonNo,
        status: st.status,
        marked_by: userId,
      };
    });

    const { data: savedLogs, error } = await supabase
      .from("attendance_logs")
      .upsert(upserts, { onConflict: "student_id, log_date, lesson_no" })
      .select("id, student_id, status");

    if (error) {
      toast("Kayıt hatası: " + error.message, "error");
      setSaving(false);
      return;
    }

    // Update stateMap with log IDs
    const newMap = new Map(stateMap);
    savedLogs?.forEach((log) => {
      const existing = newMap.get(log.student_id);
      if (existing) {
        newMap.set(log.student_id, { ...existing, saved: true, logId: log.id });
      }
    });
    setStateMap(newMap);
    setTick((t) => t + 1);

    // Send SMS for absent students (async, don't block)
    if (smsActive) {
      const absentLogs = savedLogs?.filter((l) => l.status === "absent") || [];
      for (const log of absentLogs) {
        const student = localStudents.find((s) => s.id === log.student_id);
        if (student?.veli_telefon) {
          // Fire and forget — don't await
          sendAbsenceSms(log.id, student.id, student.full_name, student.veli_telefon, today).then((result) => {
            const st = newMap.get(student.id);
            if (st) {
              newMap.set(student.id, { ...st, smsSent: result, smsFailed: !result });
              setStateMap(new Map(newMap));
              setTick((t) => t + 1);
            }
          });
        }
      }
    }

    toast(`${upserts.length} öğrenci yoklaması kaydedildi`, "success");
    setSaving(false);
  }

  async function sendAbsenceSms(logId: string, studentId: string, name: string, phone: string, date: string): Promise<boolean> {
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceLogId: logId,
          studentId, studentName: name, phoneNumber: phone,
          schoolId, messageType: "absence_alert",
          logDate: date, lessonNo,
        }),
      });
      const data = await res.json();
      return data.success;
    } catch {
      return false;
    }
  }

  // ── Correction (Sonradan Geldi) ─────────────────────────────
  async function handleCorrection() {
    if (!correctionDialog) return;
    setSaving(true);
    const supabase = createClient();
    const st = stateMap.get(correctionDialog.studentId);
    if (!st?.logId) {
      toast("Kayıt bulunamadı", "error");
      setSaving(false);
      setCorrectionDialog(null);
      return;
    }

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        status: "corrected_present",
        corrected_at: new Date().toISOString(),
        corrected_by: userId,
      })
      .eq("id", st.logId);

    if (error) {
      toast("Düzeltme hatası: " + error.message, "error");
    } else {
      const newMap = new Map(stateMap);
      newMap.set(correctionDialog.studentId, { ...st, status: "corrected_present", saved: true });
      setStateMap(newMap);
      setTick((t) => t + 1);

      // Düzeltme SMS'i gönder
      if (smsActive && correctionDialog.phone) {
        fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attendanceLogId: st.logId,
            studentId: correctionDialog.studentId,
            studentName: correctionDialog.studentName,
            phoneNumber: correctionDialog.phone,
            schoolId, messageType: "correction_alert",
            logDate: new Date().toISOString().split("T")[0], lessonNo,
          }),
        }).catch(() => {});
      }

      toast(`${correctionDialog.studentName} — "Sonradan Geldi" olarak düzeltildi`, "success");
    }

    setSaving(false);
    setCorrectionDialog(null);
  }

  // ── Status badge/icon helper ─────────────────────────────────
  function StatusBadge({ st }: { st: RowState }) {
    if (st.status === "absent") {
      return (
        <Badge variant="destructive" className="gap-1">
          <UserX className="h-3 w-3" /> Gelmedi
          {st.smsSent && <Send className="h-3 w-3 ml-1 text-white" />}
          {st.smsFailed && <AlertTriangle className="h-3 w-3 ml-1 text-yellow-300" />}
        </Badge>
      );
    }
    if (st.status === "corrected_present") {
      return <Badge variant="warning" className="gap-1"><Undo2 className="h-3 w-3" /> Sonradan Geldi</Badge>;
    }
    return <Badge variant="success" className="gap-1"><UserCheck className="h-3 w-3" /> Geldi</Badge>;
  }

  async function handleSavePhone() {
    if (!phoneEditDialog) return;
    const { studentId, phone, phone2 } = phoneEditDialog;
    const supabase = createClient();
    const { error } = await supabase
      .from("students")
      .update({ veli_telefon: phone || null, veli_telefon_2: phone2 || null })
      .eq("id", studentId);
    
    if (error) {
      toast("Hata: " + error.message, "error");
    } else {
      setLocalStudents(prev => prev.map(s => s.id === studentId ? { ...s, veli_telefon: phone, veli_telefon_2: phone2 } : s));
      toast("Veli telefon bilgisi güncellendi", "success");
    }
    setPhoneEditDialog(null);
  }

  const uniqueClassIds = [...new Set(localStudents.map((s) => s.class_id))];
  const filteredClasses = classes.filter((c) => uniqueClassIds.includes(c.id));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="flex-1 sm:w-auto sm:flex-none">
            <option value="all">Tüm Sınıflar</option>
            {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={String(lessonNo)} onChange={(e) => handleLessonChange(e.target.value)} className="w-24">
            {Array.from({ length: totalLessons }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}. Ders</option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="shrink-0">{filteredStudents.length} öğrenci</Badge>
            {absentCount > 0 && <Badge variant="destructive">{absentCount} devamsız</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {smsActive && <Badge variant="outline" className="text-green-600 border-green-300 gap-1"><Phone className="h-3 w-3" /> SMS Aktif</Badge>}
          <Button onClick={handleSaveAll} disabled={saving} className="flex-1 sm:flex-none">
            <Save className="h-4 w-4 mr-1" /> {saving ? "Kaydediliyor..." : "Yoklamayı Kaydet"}
          </Button>
        </div>
      </div>

      {!smsActive && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>SMS gönderimi pasif. Devamsızlık SMS'i göndermek için <strong>Yönetim → SMS Ayarları</strong>'ndan yapılandırın.</p>
        </div>
      )}

      {/* ── MOBILE: cards ──────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {filteredStudents.length === 0 && (
          <div className="text-center text-muted-foreground py-10">Öğrenci bulunamadı</div>
        )}
        {filteredStudents.map((s) => {
          const st = stateMap.get(s.id);
          if (!st) return null;
          return (
            <Card key={s.id} className={st.status === "absent" ? "border-red-200 bg-red-50/30" : st.status === "corrected_present" ? "border-yellow-200 bg-yellow-50/30" : ""}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{s.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">{getClassName(s)}</Badge>
                      <button 
                        onClick={() => setPhoneEditDialog({ studentId: s.id, studentName: s.full_name, phone: s.veli_telefon || "", phone2: s.veli_telefon_2 || "" })} 
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5"
                      >
                        {s.veli_telefon ? (
                          <><Phone className="h-3 w-3 text-green-600" /> <span className="underline">{s.veli_telefon}</span></>
                        ) : (
                          <span className="text-orange-500 underline flex items-center gap-0.5">📵 Telefon Ekle</span>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge st={st} />
                    {st.status !== "corrected_present" && (
                      <button
                        onClick={() => toggleStudent(s.id)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                          st.status === "absent"
                            ? "bg-red-100 text-red-600 hover:bg-red-200"
                            : "bg-green-100 text-green-600 hover:bg-green-200"
                        }`}
                      >
                        {st.status === "absent" ? <UserX className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── DESKTOP: table ─────────────────────────────── */}
      <div className="hidden sm:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Öğrenci</TableHead>
                  <TableHead>Sınıf</TableHead>
                  <TableHead className="text-center">Veli Tel.</TableHead>
                  <TableHead className="text-center">Durum</TableHead>
                  <TableHead className="text-center w-28">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Öğrenci bulunamadı
                    </TableCell>
                  </TableRow>
                )}
                {filteredStudents.map((s) => {
                  const st = stateMap.get(s.id);
                  if (!st) return null;
                  return (
                    <TableRow key={s.id} className={st.status === "absent" ? "bg-red-50/50" : st.status === "corrected_present" ? "bg-yellow-50/50" : ""}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell><Badge variant="outline">{getClassName(s)}</Badge></TableCell>
                      <TableCell className="text-center text-sm">
                        {s.veli_telefon ? (
                          <button
                            onClick={() => setPhoneEditDialog({ studentId: s.id, studentName: s.full_name, phone: s.veli_telefon || "", phone2: s.veli_telefon_2 || "" })}
                            className="text-green-600 hover:underline flex items-center justify-center gap-1 mx-auto"
                          >
                            <Phone className="h-3 w-3" /> {s.veli_telefon}
                          </button>
                        ) : (
                          <button
                            onClick={() => setPhoneEditDialog({ studentId: s.id, studentName: s.full_name, phone: "", phone2: "" })}
                            className="text-orange-500 hover:underline text-xs flex items-center justify-center gap-1 mx-auto"
                          >
                            <AlertTriangle className="h-3 w-3" /> Ekle
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-center"><StatusBadge st={st} /></TableCell>
                      <TableCell className="text-center">
                        {st.status !== "corrected_present" && (
                          <Button
                            variant={st.status === "absent" ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => toggleStudent(s.id)}
                            className="h-8"
                          >
                            {st.status === "absent" ? (
                              <><UserX className="h-3.5 w-3.5 mr-1" /> Gelmedi</>
                            ) : (
                              <><UserCheck className="h-3.5 w-3.5 mr-1" /> Geldi</>
                            )}
                          </Button>
                        )}
                        {st.status === "corrected_present" && (
                          <span className="text-xs text-muted-foreground">Düzeltildi</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Confirm Absent Dialog ──────────────────────── */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Devamsızlık Onayı
            </div>
          </DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setConfirmDialog(null)} />
        {confirmDialog && (
          <div className="mt-4 space-y-4">
            {confirmDialog.type === "single" ? (
              <p className="text-sm">
                <strong>{confirmDialog.absentStudents[0]?.name}</strong> için devamsız kaydı oluşturulacak
                {smsActive && confirmDialog.absentStudents[0]?.phone && (
                  <> ve velisine SMS gönderilecek.</>
                )}
              </p>
            ) : (
              <div>
                <p className="text-sm mb-2">{confirmDialog.absentStudents.length} öğrenci devamsız işaretlenecek:</p>
                <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                  {confirmDialog.absentStudents.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <UserX className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <span>{s.name}</span>
                      {s.phone ? (
                        <Badge variant="outline" className="text-xs text-green-600">SMS ✓</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-orange-500">Tel. yok</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmDialog(null)}>İptal</Button>
              <Button variant="destructive" onClick={confirmDialog.type === "single" ? () => { confirmAbsent(); } : () => { doSave(); }}>
                <Send className="h-4 w-4 mr-1" /> Onayla {smsActive && "& SMS Gönder"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Correction Dialog ─────────────────────────── */}
      <Dialog open={!!correctionDialog} onOpenChange={(open) => !open && setCorrectionDialog(null)}>
        <DialogHeader>
          <DialogTitle>Sonradan Geldi — Düzeltme</DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setCorrectionDialog(null)} />
        {correctionDialog && (
          <div className="mt-4 space-y-4">
            <p className="text-sm">
              <strong>{correctionDialog.studentName}</strong> için devamsızlık kaydı düzeltilecek.
            </p>
            {smsActive && correctionDialog.phone && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                Velisine düzeltme SMS'i gönderilecek: <em>"...öğrenciniz okula gelmiştir, önceki mesajımızı dikkate almayınız."</em>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCorrectionDialog(null)}>İptal</Button>
              <Button onClick={handleCorrection} disabled={saving}>
                <Undo2 className="h-4 w-4 mr-1" /> Düzelt
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Phone Edit Dialog ─────────────────────────── */}
      <Dialog open={!!phoneEditDialog} onOpenChange={(open) => !open && setPhoneEditDialog(null)}>
        <DialogHeader>
          <DialogTitle>Veli Telefonu Ekle/Düzenle</DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setPhoneEditDialog(null)} />
        {phoneEditDialog && (
          <div className="mt-4 space-y-4">
            <p className="text-sm">
              <strong>{phoneEditDialog.studentName}</strong> isimli öğrencinin veli iletişim numaralarını güncelleyin.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vphone_edit">Veli Telefonu</Label>
                <Input
                  id="vphone_edit"
                  value={phoneEditDialog.phone}
                  onChange={(e) => setPhoneEditDialog({ ...phoneEditDialog, phone: e.target.value })}
                  placeholder="+905XXXXXXXXX"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vphone2_edit">2. Veli Telefonu (opsiyonel)</Label>
                <Input
                  id="vphone2_edit"
                  value={phoneEditDialog.phone2}
                  onChange={(e) => setPhoneEditDialog({ ...phoneEditDialog, phone2: e.target.value })}
                  placeholder="+905XXXXXXXXX"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPhoneEditDialog(null)}>İptal</Button>
              <Button onClick={handleSavePhone}>
                <Save className="h-4 w-4 mr-1" /> Kaydet
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
