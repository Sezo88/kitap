"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Check, X } from "lucide-react";
import type { Profile } from "@/lib/types/database";

interface Props {
  pendingUsers: Profile[];
  schoolId: string;
}

export function PendingApprovals({ pendingUsers: initial, schoolId }: Props) {
  const [users, setUsers] = useState(initial);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleApprove(userId: string, name: string) {
    setProcessing(userId);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ status: "active" })
      .eq("id", userId)
      .eq("school_id", schoolId);

    if (error) {
      toast("Hata: " + error.message, "error");
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast(`${name} onaylandı`, "success");
    }
    setProcessing(null);
  }

  async function handleReject(userId: string, name: string) {
    if (!confirm(`${name} adlı kullanıcıyı reddetmek istediğinize emin misiniz?`)) return;
    setProcessing(userId);
    const supabase = createClient();

    // Delete profile (cascades from auth.users)
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId)
      .eq("school_id", schoolId);

    if (error) {
      toast("Hata: " + error.message, "error");
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast(`${name} reddedildi`, "info");
    }
    setProcessing(null);
  }

  const roleLabel = (role: string) => {
    if (role === "ogretmen") return "Öğretmen";
    if (role === "idareci") return "İdareci";
    return role;
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad Soyad</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead className="w-40">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Bekleyen onay isteği yok
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell><Badge variant="outline">{roleLabel(u.role)}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString("tr-TR")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApprove(u.id, u.full_name)}
                      disabled={processing === u.id}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Check className="h-4 w-4 mr-1" /> Onayla
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(u.id, u.full_name)}
                      disabled={processing === u.id}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
