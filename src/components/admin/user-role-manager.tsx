"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog, DialogClose, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Settings, Trash2 } from "lucide-react";
import type { Role, Class } from "@/lib/types/database";

interface Props {
  targetUserId: string;
  currentRole: Role;
  allClasses: Class[];
  assignedClassIds: string[];
  isAdmin: boolean;
  canDelete: boolean;
}

export function UserRoleManager({ targetUserId, currentRole, allClasses, assignedClassIds, isAdmin, canDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [role, setRole] = useState<Role>(currentRole);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(assignedClassIds);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  function toggleClass(classId: string) {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    // Update role
    if (role !== currentRole) {
      await supabase.from("profiles").update({ role }).eq("id", targetUserId);
    }

    // Update class assignments for teachers
    if (role === "ogretmen") {
      // Remove existing
      await supabase.from("teacher_classes").delete().eq("teacher_id", targetUserId);
      // Add new
      if (selectedClassIds.length > 0) {
        await supabase.from("teacher_classes").insert(
          selectedClassIds.map((cid) => ({ teacher_id: targetUserId, class_id: cid }))
        );
      }
    }

    toast("Kullanıcı güncellendi", "success");
    setSaving(false);
    setOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();

    // Önce teacher_classes bağlantılarını temizle
    await supabase.from("teacher_classes").delete().eq("teacher_id", targetUserId);

    // Profili sil (Supabase Auth kullanıcısını silmek için admin API gerekir,
    // burada sadece profiles tablosundan siliyoruz)
    const { error } = await supabase.from("profiles").delete().eq("id", targetUserId);

    if (error) {
      toast("Kullanıcı silinirken hata oluştu: " + error.message, "error");
    } else {
      toast("Kullanıcı başarıyla silindi", "success");
      setDeleteOpen(false);
      setOpen(false);
    }
    setDeleting(false);
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Düzenle">
          <Settings className="h-4 w-4" />
        </Button>
        {canDelete && (
          <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(true)} title="Sil">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {/* Düzenleme Dialog'u */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>Kullanıcı Ayarları</DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setOpen(false)} />
        <div className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <Label>Rol</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="ogretmen">Öğretmen</option>
              {isAdmin && <option value="idareci">İdareci</option>}
              {isAdmin && <option value="super_admin">Süper Admin</option>}
            </Select>
          </div>

          {role === "ogretmen" && allClasses.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Sınıf Ataması</Label>
              <div className="max-h-48 overflow-auto border rounded-lg p-2 space-y-1">
                {allClasses.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(c.id)}
                      onChange={() => toggleClass(c.id)}
                      className="rounded"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        </div>
      </Dialog>

      {/* Silme Onay Dialog'u */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogHeader>
          <DialogTitle>Kullanıcıyı Sil</DialogTitle>
          <DialogDescription>
            Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
          </DialogDescription>
        </DialogHeader>
        <DialogClose onClick={() => setDeleteOpen(false)} />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>İptal</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Siliniyor..." : "Evet, Sil"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
