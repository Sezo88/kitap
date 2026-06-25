"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Book } from "@/lib/types/database";

interface Props {
  books: Book[];
  schoolId: string;
  userId: string;
}

export function BookList({ books: initialBooks, schoolId, userId }: Props) {
  const [books, setBooks] = useState(initialBooks);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    setBooks(initialBooks);
  }, [initialBooks]);

  const filtered = books.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || (b.category && b.category.toLowerCase().includes(q));
  });

  function openCreate() {
    setEditingBook(null);
    setTitle("");
    setAuthor("");
    setCategory("");
    setPageCount("");
    setDialogOpen(true);
  }

  function openEdit(b: Book) {
    setEditingBook(b);
    setTitle(b.title);
    setAuthor(b.author);
    setCategory(b.category || "");
    setPageCount(b.page_count?.toString() || "");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!title.trim() || !author.trim()) return;
    setSaving(true);
    const supabase = createClient();

    const payload = {
      title: title.trim(),
      author: author.trim(),
      category: category.trim() || null,
      page_count: pageCount ? parseInt(pageCount) : null,
    };

    if (editingBook) {
      await supabase.from("books").update(payload).eq("id", editingBook.id);
      setBooks((prev) => prev.map((b) => (b.id === editingBook.id ? { ...b, ...payload } : b)));
      toast("Kitap güncellendi", "success");
    } else {
      const { data } = await supabase
        .from("books")
        .insert({ ...payload, school_id: schoolId, added_by: userId })
        .select()
        .single();
      if (data) setBooks((prev) => [...prev, data as Book]);
      toast("Kitap eklendi", "success");
    }

    setSaving(false);
    setDialogOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu kitabı silmek istediğinize emin misiniz?")) return;
    const supabase = createClient();
    await supabase.from("books").delete().eq("id", id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    toast("Kitap silindi", "success");
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-4">
        <Input
          placeholder="Kitap adı, yazar veya kategori ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Kitap Ekle
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kitap Adı</TableHead>
                <TableHead>Yazar</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Sayfa</TableHead>
                <TableHead className="w-24">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {search ? "Aramanızla eşleşen kitap bulunamadı" : "Henüz kitap eklenmemiş"}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.title}</TableCell>
                  <TableCell>{b.author || "-"}</TableCell>
                  <TableCell>{b.category || "-"}</TableCell>
                  <TableCell>{b.page_count || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingBook ? "Kitap Düzenle" : "Yeni Kitap"}</DialogTitle>
        </DialogHeader>
        <DialogClose onClick={() => setDialogOpen(false)} />
        <div className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="btitle">Kitap Adı</Label>
            <Input id="btitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kitap adı" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bauthor">Yazar</Label>
            <Input id="bauthor" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Yazar adı" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bcat">Kategori (opsiyonel)</Label>
            <Input id="bcat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="örn. Roman" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bpages">Sayfa Sayısı (opsiyonel)</Label>
            <Input id="bpages" type="number" value={pageCount} onChange={(e) => setPageCount(e.target.value)} placeholder="örn. 250" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
