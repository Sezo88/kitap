"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { Book } from "@/lib/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBook?: Book | null;
  schoolId: string;
  userId: string;
  onSaved: (book: Book) => void;
}

export function BookFormDialog({ open, onOpenChange, editingBook, schoolId, userId, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (editingBook) {
        setTitle(editingBook.title);
        setAuthor(editingBook.author);
        setCategory(editingBook.category || "");
        setPageCount(editingBook.page_count?.toString() || "");
      } else {
        setTitle("");
        setAuthor("");
        setCategory("");
        setPageCount("");
      }
    }
  }, [open, editingBook]);

  async function handleSave() {
    if (!title.trim() || !author.trim()) {
      toast("Kitap adi ve yazar zorunludur", "error");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    const payload = {
      title: title.trim(),
      author: author.trim(),
      category: category.trim() || null,
      page_count: pageCount ? parseInt(pageCount) : null,
    };

    if (editingBook) {
      const { error } = await supabase.from("books").update(payload).eq("id", editingBook.id);
      if (error) {
        toast("Kitap guncellenirken hata: " + error.message, "error");
        setSaving(false);
        return;
      }
      toast("Kitap guncellendi", "success");
      onSaved({ ...editingBook, ...payload });
    } else {
      const { data, error } = await supabase
        .from("books")
        .insert({ ...payload, school_id: schoolId, added_by: userId })
        .select()
        .single();
      if (error) {
        toast("Kitap eklenirken hata: " + error.message, "error");
        setSaving(false);
        return;
      }
      toast("Kitap eklendi", "success");
      if (data) onSaved(data as Book);
    }

    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{editingBook ? "Kitap Duzenle" : "Yeni Kitap"}</DialogTitle>
      </DialogHeader>
      <DialogClose onClick={() => onOpenChange(false)} />
      <div className="flex flex-col gap-4 mt-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bf-title">Kitap Adi</Label>
          <Input id="bf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kitap adi" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bf-author">Yazar</Label>
          <Input id="bf-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Yazar adi" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bf-cat">Kategori (opsiyonel)</Label>
          <Input id="bf-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="orn. Roman" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bf-pages">Sayfa Sayisi (opsiyonel)</Label>
          <Input id="bf-pages" type="number" value={pageCount} onChange={(e) => setPageCount(e.target.value)} placeholder="orn. 250" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Iptal</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
