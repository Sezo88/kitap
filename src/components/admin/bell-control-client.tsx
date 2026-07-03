"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Bell, Flag, Megaphone, History } from "lucide-react";

interface Props {
  schoolId: string;
  userId: string;
  initialCommands: any[];
}

const COMMAND_LABELS: Record<string, { label: string; icon: typeof Bell; color: string }> = {
  play_bell: { label: "Teneffüs Zili", icon: Bell, color: "text-blue-600 bg-blue-100" },
  play_anthem: { label: "İstiklal Marşı", icon: Flag, color: "text-red-600 bg-red-100" },
  custom_announcement: { label: "Özel Anons", icon: Megaphone, color: "text-purple-600 bg-purple-100" },
};

export function BellControlClient({ schoolId, userId, initialCommands }: Props) {
  const [commands, setCommands] = useState(initialCommands);
  const [sending, setSending] = useState<string | null>(null);
  const { toast } = useToast();

  async function triggerCommand(commandType: string) {
    setSending(commandType);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("bell_commands")
      .insert({
        school_id: schoolId,
        command_type: commandType,
        triggered_by: userId,
        status: "pending",
      })
      .select("*, profiles(full_name)")
      .single();

    if (error) {
      toast("Komut gönderilemedi: " + error.message, "error");
    } else {
      toast(`${COMMAND_LABELS[commandType]?.label || commandType} komutu gönderildi!`, "success");
      if (data) setCommands([data, ...commands]);
    }
    setSending(null);
  }

  return (
    <div className="space-y-6">
      {/* Komut Butonları */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uzaktan Zil / Anons Tetikle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(COMMAND_LABELS).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <Button
                  key={type}
                  type="button"
                  variant="outline"
                  className={`h-20 flex flex-col gap-2 ${sending === type ? "opacity-60" : "hover:bg-muted/50"}`}
                  onClick={() => triggerCommand(type)}
                  disabled={sending !== null}
                >
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">{config.label}</span>
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            ⚡ Bu butonlar Electron zil uygulamasına komut gönderir. Uygulama çalışıyorsa ilgili sesi otomatik çalar.
          </p>
        </CardContent>
      </Card>

      {/* Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" />
            Komut Geçmişi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Komut</TableHead>
                <TableHead>Gönderen</TableHead>
                <TableHead>Tarih / Saat</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commands.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Henüz komut gönderilmemiş
                  </TableCell>
                </TableRow>
              )}
              {commands.map((cmd: any) => {
                const config = COMMAND_LABELS[cmd.command_type];
                return (
                  <TableRow key={cmd.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {config?.label || cmd.command_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{cmd.profiles?.full_name || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(cmd.triggered_at || cmd.created_at).toLocaleString("tr-TR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cmd.status === "acknowledged" ? "success" : "outline"} className="text-xs">
                        {cmd.status === "acknowledged" ? "✓ Alındı" : "⏳ Bekliyor"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
