"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { BookFormDialog } from "@/components/library/book-form-dialog";
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
    setDialogOpen(true);
  }

  function openEdit(b: Book) {
    setEditingBook(b);
    setDialogOpen(true);
  }

  function handleSaved(book: Book) {
    if (editingBook) {
      setBooks((prev) => prev.map((b) => (b.id === book.id ? book : b)));
    } else {
      setBooks((prev) => [...prev, book]);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu kitabi silmek istediginize emin misiniz?")) return;
    const supabase = createClient();
    await supabase.from("books").delete().eq("id", id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    toast("Kitap silindi", "success");
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-4">
        <Input
          placeholder="Kitap adi, yazar veya kategori ile ara..."
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
                <TableHead>Kitap Adi</TableHead>
                <TableHead>Yazar</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Sayfa</TableHead>
                <TableHead className="w-24">Islem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {search ? "Aramanizla eslesen kitap bulunamadi" : "Henuz kitap eklenmemis"}
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

      <BookFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingBook={editingBook}
        schoolId={schoolId}
        userId={userId}
        onSaved={handleSaved}
      />
    </>
  );
}
