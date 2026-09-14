"use client";

import { useState } from "react";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Settings, Plus, Pencil, Trash2, CheckCircle2, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { addCleanlinessCriteria, updateCleanlinessCriteria, deleteCleanlinessCriteria } from "@/lib/actions/cleanliness-criteria";
import type { CleanlinessCriteria } from "@/lib/types/database";

interface Props {
  initialCriterias: CleanlinessCriteria[];
  onCriteriaChange?: (updated: CleanlinessCriteria[]) => void;
}

export function CleanlinessCriteriaManager({ initialCriterias, onCriteriaChange }: Props) {
  const [criterias, setCriterias] = useState<CleanlinessCriteria[]>(initialCriterias);
  const [managerOpen, setManagerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CleanlinessCriteria | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CleanlinessCriteria | null>(null);
  const { toast } = useToast();

  // Yeni Kriter Ekleme
  async function handleAdd() {
    if (!newName.trim()) {
      toast("Lütfen kriter adını girin", "error");
      return;
    }

    setSubmitting(true);
    const res = await addCleanlinessCriteria(newName.trim());
    setSubmitting(false);

    if (res.success && res.criteria) {
      const updated = [...criterias, res.criteria];
      setCriterias(updated);
      setNewName("");
      toast("Yeni değerlendirme kriteri eklendi", "success");
      onCriteriaChange?.(updated);
    } else {
      toast(res.error || "Kriter eklenemedi", "error");
    }
  }

  // Kriter Güncelleme (İsim Değiştirme)
  async function handleUpdate() {
    if (!editingItem || !editName.trim()) return;

    setSubmitting(true);
    const res = await updateCleanlinessCriteria(editingItem.id, editName.trim());
    setSubmitting(false);

    if (res.success && res.criteria) {
      const updated = criterias.map((c) => (c.id === editingItem.id ? res.criteria! : c));
      setCriterias(updated);
      setEditingItem(null);
      setEditName("");
      toast("Kriter adı başarıyla güncellendi", "success");
      onCriteriaChange?.(updated);
    } else {
      toast(res.error || "Güncelleme başarısız", "error");
    }
  }

  // Kriter Silme
  async function handleDelete() {
    if (!deleteTarget) return;

    setSubmitting(true);
    const res = await deleteCleanlinessCriteria(deleteTarget.id);
    setSubmitting(false);

    if (res.success) {
      const updated = criterias.filter((c) => c.id !== deleteTarget.id);
      setCriterias(updated);
      setDeleteTarget(null);
      toast("Kriter silindi", "success");
      onCriteriaChange?.(updated);
    } else {
      toast(res.error || "Kriter silinemedi", "error");
    }
  }

  return (
    <>
      {/* İdareci Butonu (Temiz Sınıf Sayfasında Görünür) */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setManagerOpen(true)}
        className="rounded-xl border-border/80 bg-card hover:bg-accent text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition"
      >
        <Settings className="h-4 w-4 text-emerald-500" />
        <span>Kriterleri Düzenle</span>
      </Button>

      {/* Ana Kriter Yönetim Modalı */}
      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl p-5 sm:p-6 space-y-5 animate-in fade-in zoom-in-95">
            <DialogHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold">
                      Temiz Sınıf Değerlendirme Kriterleri
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Puanlamada kullanılan kriterleri ekleyin, düzenleyin veya kaldırın.
                    </p>
                  </div>
                </div>
                <DialogClose onClick={() => setManagerOpen(false)} />
              </div>
            </DialogHeader>

            {/* Yeni Kriter Ekleme Satırı */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-muted/40 border border-border/60">
              <label className="text-xs font-bold text-foreground block">
                Yeni Değerlendirme Kriteri Ekle
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  placeholder="Örn: Sıra ve Masa Düzeni..."
                  disabled={submitting}
                  className="rounded-xl text-sm"
                />
                <Button
                  type="button"
                  onClick={handleAdd}
                  disabled={submitting || !newName.trim()}
                  className="rounded-xl shrink-0 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>Ekle</span>
                </Button>
              </div>
            </div>

            {/* Mevcut Kriterler Listesi */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                <span>Aktif Kriterler ({criterias.length})</span>
                <span>(Puanlama 1 - 5 Arası)</span>
              </div>

              {criterias.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
                  Henüz tanımlanmış kriter bulunmuyor. Yukarıdan yeni kriter ekleyin.
                </div>
              ) : (
                criterias.map((c, idx) => {
                  const isEditingThis = editingItem?.id === c.id;

                  return (
                    <div
                      key={c.id}
                      className="p-3 rounded-2xl bg-card border border-border/80 flex items-center justify-between gap-2 shadow-xs transition hover:border-primary/40"
                    >
                      {isEditingThis ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate();
                              if (e.key === "Escape") setEditingItem(null);
                            }}
                            className="rounded-xl text-xs h-9"
                          />
                          <Button
                            size="sm"
                            onClick={handleUpdate}
                            disabled={submitting || !editName.trim()}
                            className="rounded-xl text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          >
                            Kaydet
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingItem(null)}
                            className="rounded-xl text-xs h-9"
                          >
                            İptal
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-muted text-muted-foreground font-black text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-bold text-foreground truncate">
                              {c.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingItem(c);
                                setEditName(c.name);
                              }}
                              className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Adını Düzenle"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(c)}
                              className="h-8 w-8 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                              title="Kriteri Sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Alt Kapat Butonu */}
            <div className="pt-2 border-t border-border/60 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setManagerOpen(false)}
                className="rounded-xl text-xs font-bold px-5"
              >
                Tamam
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Silme Onay Modalı */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-500">
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-base text-foreground">Kriteri Sil</h3>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">{deleteTarget.name}</strong> kriterini silmek istediğinize emin misiniz?
              </p>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 rounded-xl text-xs font-bold"
                >
                  İptal
                </Button>
                <Button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex-1 rounded-xl text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Evet, Sil"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
