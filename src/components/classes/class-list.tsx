"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toggleSchoolClassActive, saveSchoolClass, deleteSchoolClass } from "@/lib/actions/classes";
import type { Role, Class, Profile } from "@/lib/types/database";

interface Props {
  classes: Class[];
  teachers: Pick<Profile, "id" | "full_name">[];
  role: Role;
  schoolId: string;
}

export function ClassList({ classes: initialClasses, teachers, role, schoolId }: Props) {
  const [classes, setClasses] = useState(initialClasses);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState(1);
  const [quizPin, setQuizPin] = useState("");
  const [assignedTeacher, setAssignedTeacher] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const canEdit = role === "super_admin" || role === "idareci";

  useEffect(() => {
    setClasses(initialClasses);
  }, [initialClasses]);

  function openCreate() {
    setEditingClass(null);
    setName("");
    setGradeLevel(1);
    setQuizPin("");
    setIsActive(true);
    setAssignedTeacher("");
    setDialogOpen(true);
  }

  function openEdit(cls: Class) {
    setEditingClass(cls);
    setName(cls.name);
    setGradeLevel(cls.grade_level);
    setQuizPin((cls as any).quiz_pin || "");
    setIsActive(cls.is_active !== false);
    setAssignedTeacher("");
    setDialogOpen(true);
  }

  async function toggleActive(cls: Class) {
    const nextState = cls.is_active === false;
    setClasses((prev) => prev.map((c) => (c.id === cls.id ? { ...c, is_active: nextState } : c)));

    const res = await toggleSchoolClassActive(cls.id, nextState);
    if (!res.success) {
      setClasses((prev) => prev.map((c) => (c.id === cls.id ? { ...c, is_active: cls.is_active } : c)));
      toast("Durum güncellenemedi: " + res.error, "error");
      return;
    }
    toast(nextState ? `"${cls.name}" sınıfı aktifleştirildi` : `"${cls.name}" sınıfı pasife alındı`, "success");
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);

    const res = await saveSchoolClass({
      id: editingClass?.id,
      name: name.trim(),
      gradeLevel,
      quizPin: quizPin || null,
      isActive,
      assignedTeacher: assignedTeacher || undefined,
    });

    if (!res.success) {
      toast("Kayıt sırasında hata oluştu: " + res.error, "error");
      setSaving(false);
      return;
    }

    if (editingClass) {
      setClasses((prev) =>
        prev.map((c) =>
          c.id === editingClass.id
            ? { ...c, name: name.trim(), grade_level: gradeLevel, quiz_pin: quizPin, is_active: isActive }
            : c
        )
      );
      toast("Sınıf güncellendi", "success");
    } else if (res.data) {
      setClasses((prev) => [...prev, res.data as Class]);
      toast("Sınıf oluşturuldu", "success");
    }

    setSaving(false);
    setDialogOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu sınıfı silmek istediğinize emin misiniz? (Öğrenci veya ders programı varsa silinemez)")) return;
    const res = await deleteSchoolClass(id);
    if (!res.success) {
      toast("Sınıf silinemedi (geçmiş kayıtlar olabilir, bunun yerine pasife alabilirsiniz): " + res.error, "error");
      return;
    }
    setClasses((prev) => prev.filter((c) => c.id !== id));
    toast("Sınıf silindi", "success");
  }

  const displayedClasses = classes.filter((c) => showInactive || c.is_active !== false);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {displayedClasses.length} sınıf listeleniyor ({classes.filter(c => c.is_active !== false).length} aktif)
          </p>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            Pasif sınıfları göster
          </label>
        </div>
        {canEdit && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Yeni Sınıf
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sınıf Adı</TableHead>
                <TableHead>Seviye</TableHead>
                <TableHead>Durum</TableHead>
                {canEdit && <TableHead>Quiz PIN</TableHead>}
                {canEdit && <TableHead className="w-36 text-right">İşlem</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedClasses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 5 : 3} className="text-center text-muted-foreground py-8">
                    Henüz sınıf bulunmuyor
                  </TableCell>
                </TableRow>
              )}
              {displayedClasses.map((cls) => {
                const active = cls.is_active !== false;
                return (
                  <TableRow key={cls.id} className={!active ? "opacity-60 bg-muted/20" : ""}>
                    <TableCell className="font-semibold">{cls.name}</TableCell>
                    <TableCell><Badge variant="secondary">{cls.grade_level}. Sınıf</Badge></TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => canEdit && toggleActive(cls)}
                        title={canEdit ? (active ? "Pasife almak için tıklayın" : "Aktifleştirmek için tıklayın") : ""}
                        disabled={!canEdit}
                        className={canEdit ? "cursor-pointer" : "cursor-default"}
                      >
                        <Badge 
                          variant={active ? "success" : "outline"} 
                          className={active ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-600 border-slate-300"}
                        >
                          {active ? "🟢 Aktif" : "⚪ Pasif"}
                        </Badge>
                      </button>
                    </TableCell>
                    {canEdit && <TableCell className="font-mono text-sm">{(cls as any).quiz_pin || "-"}</TableCell>}
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-xs px-2"
                            onClick={() => toggleActive(cls)}
                            title={active ? "Pasife Al" : "Aktif Yap"}
                          >
                            {active ? "Pasife Al" : "Aktif Yap"}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cls)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(cls.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingClass ? "Sınıf Düzenle" : "Yeni Sınıf"}</DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setDialogOpen(false)} />
        <div className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cname">Sınıf Adı</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. 5/A" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="glevel">Seviye</Label>
            <Select id="glevel" value={gradeLevel} onChange={(e) => setGradeLevel(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
                <option key={g} value={g}>{g}. Sınıf</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="qpin">Quiz PIN (öğrenciler bu kodla cevap verir)</Label>
            <Input id="qpin" value={quizPin} onChange={(e) => setQuizPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="örn: 1234" maxLength={6} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="cactive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="cactive" className="cursor-pointer text-sm font-medium">Bu sınıf aktif olarak kullanılsın</Label>
          </div>
          {!editingClass && teachers.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="teacher">Öğretmen Ata (opsiyonel)</Label>
              <Select id="teacher" value={assignedTeacher} onChange={(e) => setAssignedTeacher(e.target.value)}>
                <option value="">Atama yapma</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
