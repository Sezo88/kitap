"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Settings } from "lucide-react";
import type { Role, Class } from "@/lib/types/database";

interface Props {
  targetUserId: string;
  currentRole: Role;
  allClasses: Class[];
  assignedClassIds: string[];
  isAdmin: boolean;
}

export function UserRoleManager({ targetUserId, currentRole, allClasses, assignedClassIds, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(currentRole);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(assignedClassIds);
  const [saving, setSaving] = useState(false);
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

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" />
      </Button>

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
    </>
  );
}
