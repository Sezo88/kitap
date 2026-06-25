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
  const [assignedTeacher, setAssignedTeacher] = useState("");
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
    setAssignedTeacher("");
    setDialogOpen(true);
  }

  function openEdit(cls: Class) {
    setEditingClass(cls);
    setName(cls.name);
    setGradeLevel(cls.grade_level);
    setAssignedTeacher("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();

    if (editingClass) {
      await supabase.from("classes").update({ name, grade_level: gradeLevel }).eq("id", editingClass.id);
      setClasses((prev) => prev.map((c) => (c.id === editingClass.id ? { ...c, name, grade_level: gradeLevel } : c)));
      toast("Sınıf güncellendi", "success");
    } else {
      const { data } = await supabase.from("classes").insert({ name, grade_level: gradeLevel, school_id: schoolId }).select().single();
      if (data) {
        setClasses((prev) => [...prev, data as Class]);
        // Assign teacher if selected
        if (assignedTeacher) {
          await supabase.from("teacher_classes").insert({ teacher_id: assignedTeacher, class_id: data.id });
        }
      }
      toast("Sınıf oluşturuldu", "success");
    }

    setSaving(false);
    setDialogOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu sınıfı silmek istediğinize emin misiniz?")) return;
    const supabase = createClient();
    await supabase.from("classes").delete().eq("id", id);
    setClasses((prev) => prev.filter((c) => c.id !== id));
    toast("Sınıf silindi", "success");
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{classes.length} sınıf</p>
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
                {canEdit && <TableHead className="w-24">İşlem</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 3 : 2} className="text-center text-muted-foreground py-8">
                    Henüz sınıf eklenmemiş
                  </TableCell>
                </TableRow>
              )}
              {classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell><Badge variant="secondary">{cls.grade_level}. Sınıf</Badge></TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cls)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(cls.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
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
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. 5-A" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="glevel">Seviye</Label>
            <Select id="glevel" value={gradeLevel} onChange={(e) => setGradeLevel(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
                <option key={g} value={g}>{g}. Sınıf</option>
              ))}
            </Select>
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
