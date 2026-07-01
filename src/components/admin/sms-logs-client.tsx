"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, CheckCircle2, XCircle, Clock } from "lucide-react";

interface Props {
  schoolId: string;
}

interface SmsLogRow {
  id: string;
  phone_number: string;
  message_type: string;
  message_body: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  students?: { full_name: string } | null;
}

export function SmsLogsClient({ schoolId }: Props) {
  const [logs, setLogs] = useState<SmsLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      const supabase = createClient();
      let query = supabase
        .from("sms_logs")
        .select("*, students(full_name)")
        .gte("created_at", dateFilter)
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data } = await query;
      setLogs((data as SmsLogRow[]) || []);
      setLoading(false);
    }
    fetchLogs();
  }, [statusFilter, dateFilter]);

  const statusIcon = (s: string) => {
    if (s === "sent") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    if (s === "failed") return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    return <Clock className="h-3.5 w-3.5 text-yellow-500" />;
  };

  const typeLabel = (t: string) => {
    if (t === "absence_alert") return "Devamsızlık";
    if (t === "correction_alert") return "Düzeltme";
    if (t === "test") return "Test";
    return t;
  };

  const stats = {
    total: logs.length,
    sent: logs.filter((l) => l.status === "sent").length,
    failed: logs.filter((l) => l.status === "failed").length,
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Tarihten itibaren:</span>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-auto" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
          <option value="all">Tüm Durumlar</option>
          <option value="sent">Başarılı</option>
          <option value="failed">Başarısız</option>
          <option value="pending">Bekliyor</option>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Toplam</p><p className="text-xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Başarılı</p><p className="text-xl font-bold text-green-600">{stats.sent}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Başarısız</p><p className="text-xl font-bold text-red-600">{stats.failed}</p></CardContent></Card>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-2">
        {loading && <div className="text-center py-10 text-muted-foreground animate-pulse">Yükleniyor...</div>}
        {!loading && logs.length === 0 && <div className="text-center py-10 text-muted-foreground">SMS kaydı yok</div>}
        {!loading && logs.map((log) => (
          <Card key={log.id}>
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm truncate">{(log.students as any)?.full_name || "Bilinmeyen"}</p>
                <Badge variant={log.status === "sent" ? "success" : log.status === "failed" ? "destructive" : "warning"} className="text-xs gap-1">
                  {statusIcon(log.status)} {log.status === "sent" ? "Gönderildi" : log.status === "failed" ? "Başarısız" : "Bekliyor"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" /> {log.phone_number}
                <Badge variant="outline" className="text-xs">{typeLabel(log.message_type)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("tr-TR")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block">
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Öğrenci</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Mesaj</TableHead>
                  <TableHead className="text-center">Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Yükleniyor...</TableCell></TableRow>
                )}
                {!loading && logs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">SMS kaydı bulunamadı</TableCell></TableRow>
                )}
                {!loading && logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{(log.students as any)?.full_name || "—"}</TableCell>
                    <TableCell className="text-sm">{log.phone_number}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{typeLabel(log.message_type)}</Badge></TableCell>
                    <TableCell className="text-sm max-w-xs truncate" title={log.message_body}>{log.message_body}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={log.status === "sent" ? "success" : log.status === "failed" ? "destructive" : "warning"} className="gap-1">
                        {statusIcon(log.status)} {log.status === "sent" ? "✓" : log.status === "failed" ? "✗" : "…"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("tr-TR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
