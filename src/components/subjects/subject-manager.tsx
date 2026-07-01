"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import type { Subject } from "@/lib/types/database";

interface Props {
  schoolId: string;
  initialSubjects: Subject[];
}

export function SubjectManager({ schoolId, initialSubjects }: Props) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function openAdd() {
    setEditingSubject(null);
    setName("");
    setDialogOpen(true);
  }

  function openEdit(subject: Subject) {
    setEditingSubject(subject);
    setName(subject.name);
    setDialogOpen(true);
  }

  function openDelete(subject: Subject) {
    setEditingSubject(subject);
    setDeleteOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast("Lütfen ders adını girin", "error");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    if (editingSubject) {
      const { data, error } = await supabase
        .from("subjects")
        .update({ name: name.trim() })
        .eq("id", editingSubject.id)
        .select()
        .single();

      if (error) {
        toast("Ders güncellenirken hata: " + error.message, "error");
      } else {
        setSubjects((prev) => prev.map((s) => (s.id === editingSubject.id ? (data as Subject) : s)));
        toast("Ders güncellendi", "success");
        setDialogOpen(false);
      }
    } else {
      const { data, error } = await supabase
        .from("subjects")
        .insert({ school_id: schoolId, name: name.trim() })
        .select()
        .single();

      if (error) {
        toast("Ders eklenirken hata: " + error.message, "error");
      } else {
        setSubjects((prev) => [...prev, data as Subject]);
        toast("Ders eklendi", "success");
        setDialogOpen(false);
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!editingSubject) return;

    setSaving(true);
    const supabase = createClient();

    // Önce bu derse ait proje atamalarını temizle
    await supabase.from("student_projects").delete().eq("subject_id", editingSubject.id);

    const { error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", editingSubject.id);

    if (error) {
      toast("Ders silinirken hata: " + error.message, "error");
    } else {
      setSubjects((prev) => prev.filter((s) => s.id !== editingSubject.id));
      toast("Ders silindi", "success");
      setDeleteOpen(false);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Ders Listesi</h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Ders Ekle
        </Button>
      </div>

      {subjects.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-muted/30">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">Henüz ders eklenmemiş</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Proje ataması yapabilmek için önce dersleri ekleyin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {subjects.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <BookOpen className="h-4 w-4" />
                </div>
                <span className="font-medium text-sm truncate">{s.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Düzenle">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openDelete(s)} title="Sil">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ekle/Düzenle Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingSubject ? "Ders Düzenle" : "Yeni Ders Ekle"}</DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setDialogOpen(false)} />
        <div className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Ders Adı</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Bilişim Teknolojileri"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : editingSubject ? "Güncelle" : "Ekle"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Silme Onay Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogHeader>
          <DialogTitle>Dersi Sil</DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setDeleteOpen(false)} />
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong>{editingSubject?.name}</strong> dersini silmek istediğinize emin misiniz? Bu derse ait tüm proje atamaları da silinecektir.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>İptal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Siliniyor..." : "Evet, Sil"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
