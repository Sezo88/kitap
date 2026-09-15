"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2, BookOpen, CheckCircle2, XCircle } from "lucide-react";
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
  const [isProjectEligible, setIsProjectEligible] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function openAdd() {
    setEditingSubject(null);
    setName("");
    setIsProjectEligible(true);
    setDialogOpen(true);
  }

  function openEdit(subject: Subject) {
    setEditingSubject(subject);
    setName(subject.name);
    setIsProjectEligible(subject.is_project_eligible !== false);
    setDialogOpen(true);
  }

  function openDelete(subject: Subject) {
    setEditingSubject(subject);
    setDeleteOpen(true);
  }

  async function toggleProjectEligible(subject: Subject) {
    const current = subject.is_project_eligible !== false;
    const nextVal = !current;

    // İyimser UI güncellemesi
    setSubjects((prev) =>
      prev.map((s) => (s.id === subject.id ? { ...s, is_project_eligible: nextVal } : s))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("subjects")
      .update({ is_project_eligible: nextVal })
      .eq("id", subject.id);

    if (error) {
      // Geri al
      setSubjects((prev) =>
        prev.map((s) => (s.id === subject.id ? { ...s, is_project_eligible: current } : s))
      );
      if (error.message?.includes("does not exist")) {
        toast("Veritabanında 'is_project_eligible' kolonu eksik. Lütfen migration-subject-project-eligible.sql dosyasını Supabase'de çalıştırın.", "error");
      } else {
        toast("Güncelleme hatası: " + error.message, "error");
      }
    } else {
      toast(
        nextVal
          ? `"${subject.name}" dersi proje seçimine açıldı.`
          : `"${subject.name}" dersi proje seçiminden çıkarıldı.`,
        "success"
      );
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast("Lütfen ders adını girin", "error");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    if (editingSubject) {
      let { data, error } = await supabase
        .from("subjects")
        .update({ name: name.trim(), is_project_eligible: isProjectEligible })
        .eq("id", editingSubject.id)
        .select()
        .single();

      if (error && error.message?.includes("does not exist")) {
        // Kolon henüz eklenmediyse geriye dönük uyumlu kaydet
        const retry = await supabase
          .from("subjects")
          .update({ name: name.trim() })
          .eq("id", editingSubject.id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        toast("Ders güncellenirken hata: " + error.message, "error");
      } else {
        setSubjects((prev) => prev.map((s) => (s.id === editingSubject.id ? ({ ...s, ...(data as Subject), is_project_eligible: isProjectEligible }) : s)));
        toast("Ders güncellendi", "success");
        setDialogOpen(false);
      }
    } else {
      let { data, error } = await supabase
        .from("subjects")
        .insert({ school_id: schoolId, name: name.trim(), is_project_eligible: isProjectEligible })
        .select()
        .single();

      if (error && error.message?.includes("does not exist")) {
        // Kolon henüz eklenmediyse geriye dönük uyumlu ekle
        const retry = await supabase
          .from("subjects")
          .insert({ school_id: schoolId, name: name.trim() })
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        toast("Ders eklenirken hata: " + error.message, "error");
      } else {
        setSubjects((prev) => [...prev, { ...(data as Subject), is_project_eligible: isProjectEligible }]);
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
        <div>
          <h3 className="text-lg font-semibold">Ders Listesi</h3>
          <p className="text-xs text-muted-foreground">
            Proje ödevi verilebilecek dersleri yeşil rozetle işaretleyin; gereksiz dersleri tek tıkla kapatabilirsiniz.
          </p>
        </div>
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
          {subjects.map((s) => {
            const isEligible = s.is_project_eligible !== false;
            return (
              <div
                key={s.id}
                className="flex flex-col justify-between p-3.5 rounded-xl border bg-card hover:shadow-sm transition-all gap-2.5"
              >
                <div className="flex items-center justify-between min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-sm truncate" title={s.name}>{s.name}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} title="Düzenle">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDelete(s)} title="Sil">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Tek Tıkla Proje Durumu Değiştirme */}
                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <span className="text-muted-foreground text-[11px]">Proje Seçimi:</span>
                  <button
                    type="button"
                    onClick={() => toggleProjectEligible(s)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                      isEligible
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80 opacity-80"
                    }`}
                    title={
                      isEligible
                        ? "Bu dersten proje alınabilir (Kapatmak için tıklayın)"
                        : "Bu dersten proje alınamaz (Açmak için tıklayın)"
                    }
                  >
                    {isEligible ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Proje Alınabilir</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                        <span>Proje Kapalı</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
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

          <div className="flex items-start gap-3 p-3 rounded-xl border bg-muted/30">
            <input
              id="projEligibleCheck"
              type="checkbox"
              checked={isProjectEligible}
              onChange={(e) => setIsProjectEligible(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <label htmlFor="projEligibleCheck" className="text-xs sm:text-sm font-medium cursor-pointer select-none">
              Bu dersten proje ödevi alınabilir
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                İşaretli olduğunda öğretmenler &quot;Proje Belirleme&quot; sayfasında bu dersi seçebilir. İşaretsiz dersler listede gözükmez.
              </span>
            </label>
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
