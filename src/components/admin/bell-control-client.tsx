"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Bell, Flag, Megaphone, History, Trash2, Square, BellOff, Shield, Key, CheckCircle, AlertTriangle } from "lucide-react";

interface Props {
  schoolId: string;
  userId: string;
  initialCommands: any[];
  schoolCode?: string;
  schoolName?: string;
}

const COMMAND_LABELS: Record<string, { label: string; icon: typeof Bell; color: string }> = {
  play_bell: { label: "Teneffüs Zili", icon: Bell, color: "text-blue-600 bg-blue-100" },
  play_anthem: { label: "İstiklal Marşı", icon: Flag, color: "text-red-600 bg-red-100" },
  custom_announcement: { label: "Siren Çal", icon: Megaphone, color: "text-purple-600 bg-purple-100" },
  play_ceremony: { label: "Tören (Saygı Duruşu + İstiklal Marşı)", icon: Flag, color: "text-amber-600 bg-amber-100" },
  stop_sound: { label: "Tüm Sesleri Durdur", icon: Square, color: "text-rose-600 bg-rose-100 hover:bg-rose-200" },
  mute_bell: { label: "Uzaktan Zilleri Kapat", icon: BellOff, color: "text-amber-600 bg-amber-100" },
  unmute_bell: { label: "Uzaktan Zilleri Aç", icon: Bell, color: "text-emerald-600 bg-emerald-100" },
};

export function BellControlClient({ schoolId, userId, initialCommands, schoolCode, schoolName }: Props) {
  const [commands, setCommands] = useState(initialCommands);
  const [sending, setSending] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<boolean>(false);
  const [bellActive, setBellActive] = useState<boolean>(true);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinSaving, setPinSaving] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    checkOnlineStatus();
    // 15 saniyede bir kontrol et
    const interval = setInterval(checkOnlineStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  async function checkOnlineStatus() {
    const supabase = createClient();
    const { data } = await supabase
      .from("schools")
      .select("last_bell_heartbeat, bell_active, bell_api_pin_hash")
      .eq("id", schoolId)
      .single();

    if (data) {
      if (data.last_bell_heartbeat) {
        const diff = Date.now() - new Date(data.last_bell_heartbeat).getTime();
        setOnlineStatus(diff < 60000);
      } else {
        setOnlineStatus(false);
      }
      setBellActive(data.bell_active !== false);
      setHasPin(Boolean(data.bell_api_pin_hash));
    }
  }

  async function handleSavePin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinInput.trim() || pinInput.trim().length < 4) {
      toast("PIN en az 4 karakter olmalıdır.", "error");
      return;
    }
    setPinSaving(true);
    try {
      const res = await fetch("/api/panel/bell-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, pin: pinInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PIN kaydedilemedi");
      toast("Zil API PIN başarıyla kaydedildi!", "success");
      setHasPin(true);
      setPinInput("");
    } catch (err: any) {
      toast("Hata: " + err.message, "error");
    } finally {
      setPinSaving(false);
    }
  }

  async function handleClearPin() {
    if (!confirm("Zil API PIN korumasını kaldırmak istediğinize emin misiniz? PIN kaldırıldığında okul bilgisayarından sadece Okul Kodu ile bağlantı kurulabilecektir.")) return;
    setPinSaving(true);
    try {
      const res = await fetch("/api/panel/bell-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, pin: "clear" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PIN kaldırılamadı");
      toast("Zil API PIN başarıyla kaldırıldı!", "success");
      setHasPin(false);
      setPinInput("");
    } catch (err: any) {
      toast("Hata: " + err.message, "error");
    } finally {
      setPinSaving(false);
    }
  }

  async function triggerCommand(commandType: string) {
    setSending(commandType);
    const supabase = createClient();

    // Optimistic UI updates
    if (commandType === "mute_bell") setBellActive(false);
    if (commandType === "unmute_bell") setBellActive(true);

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
      // Revert optimistic update on error
      if (commandType === "mute_bell") setBellActive(true);
      if (commandType === "unmute_bell") setBellActive(false);
    } else {
      toast(`${COMMAND_LABELS[commandType]?.label || commandType} komutu gönderildi!`, "success");
      if (data) setCommands([data, ...commands]);
      // Anında veritabanından güncel durumu çek
      setTimeout(checkOnlineStatus, 1000);
    }
    setSending(null);
  }

  async function clearHistory() {
    if (!confirm("Tüm uzaktan zil tetikleme geçmişini silmek istediğinize emin misiniz?")) return;
    setClearing(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("bell_commands")
      .delete()
      .eq("school_id", schoolId);

    if (error) {
      toast("Geçmiş temizlenemedi: " + error.message, "error");
    } else {
      toast("Zil komut geçmişi temizlendi", "success");
      setCommands([]);
    }
    setClearing(false);
  }

  return (
    <div className="space-y-6">
      {/* Okul Zil Sistemi Bağlantı Bilgisi */}
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">🏫 Okul Zil Sistemi Masaüstü Bağlantısı</span>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-sm font-semibold text-foreground">Okul Kodu:</span>
            <code className="text-2xl font-black bg-background border border-border px-3.5 py-1 rounded-lg text-primary tracking-widest select-all shadow-sm">
              {schoolCode || "Belirtilmedi"}
            </code>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Okul bilgisayarındaki zil programının <strong>Ayarlar</strong> sekmesindeki <strong>Okul Kodu</strong> alanına yukarıdaki <strong>{schoolCode || "kodu"}</strong> ve aşağıda belirlediğiniz PIN'i girin.
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
          <Badge
            variant={onlineStatus ? "success" : "outline"}
            className={`text-xs py-1 px-2.5 ${onlineStatus ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-500 border-slate-300"}`}
          >
            {onlineStatus ? "🟢 Zil Programı Aktif" : "🔴 Zil Programı Çevrimdışı"}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {onlineStatus ? "Okul bilgisayarı canlı ve bağlı" : "Zil programı açık değil veya eşleşmedi"}
          </span>
        </div>
      </div>

      {/* Komut Butonları */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base">Uzaktan Zil / Anons Tetikle</CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={onlineStatus ? "success" : "outline"}
              className={onlineStatus ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-500 border-slate-300"}
            >
              {onlineStatus ? "🟢 Zil Programı Aktif" : "🔴 Zil Programı Çevrimdışı"}
            </Badge>
            {onlineStatus && (
              <Button
                variant={bellActive ? "destructive" : "default"}
                size="sm"
                className={`h-7 text-xs font-bold px-3 flex items-center gap-1 active:scale-95 transition-all shrink-0 ${
                  !bellActive ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                }`}
                onClick={() => triggerCommand(bellActive ? "mute_bell" : "unmute_bell")}
                disabled={sending !== null}
              >
                {bellActive ? (
                  <>
                    <BellOff className="h-3.5 w-3.5" /> Zilleri Sustur (Mute)
                  </>
                ) : (
                  <>
                    <Bell className="h-3.5 w-3.5" /> Zilleri Etkinleştir
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Bilgilendirme Kutusu */}
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex flex-col gap-1">
            <span className="font-bold flex items-center gap-1">⚠️ Önemli Uyarı:</span>
            <span>Uzaktan zil kontrolünü kullanabilmek için bilgisayarınızda kurulu olan <strong>Okul Zil Sistemi</strong> uygulamasının ayarlar bölümünde doğru <strong>Zil API PIN</strong> kodunu girdiğinizden emin olun. PIN kodu girilmezse veya eşleşmezse uzaktan komutlar güvenlik nedeniyle çalıştırılmayacaktır.</span>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
            {Object.entries(COMMAND_LABELS)
              .filter(([type]) => type !== "mute_bell" && type !== "unmute_bell")
              .map(([type, config]) => {
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground mt-3 pt-3 border-t border-muted/50">
            <span>⚡ Bu butonlar Electron zil uygulamasına komut gönderir. Uygulama çalışıyorsa ilgili sesi otomatik çalar.</span>
            <a 
              href="https://github.com/Sezo88/kitap/raw/main/public/downloads/Okul_Zil_Sistemi_Setup_1.1.0.exe" 
              className="inline-flex items-center gap-1.5 text-primary hover:underline font-semibold shrink-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              ⬇️ Zil Programını İndir (.exe) - v1.1.0 (MEB Güvenli Proxy)
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Zil Uygulaması Güvenlik & PIN Ayarı */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-primary" />
            Zil Uygulaması Güvenlik PIN'i
          </CardTitle>
          <Badge
            variant={hasPin ? "success" : "outline"}
            className={hasPin ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"}
          >
            {hasPin ? (
              <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> PIN Belirlendi</span>
            ) : (
              <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> PIN Belirlenmedi (Sadece Okul Kodu Yeterli)</span>
            )}
          </Badge>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePin} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="4-6 Haneli PIN Giriniz (ör. 1234)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                maxLength={6}
                className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pinSaving} className="shrink-0 font-medium">
                {pinSaving ? "Kaydediliyor..." : hasPin ? "PIN'i Güncelle" : "PIN Oluştur"}
              </Button>
              {hasPin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pinSaving}
                  onClick={handleClearPin}
                  className="shrink-0 font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  PIN'i Kaldır
                </Button>
              )}
            </div>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            * Okul bilgisayarındaki Zil uygulaması eşleştirme anında bu PIN'i soracaktır. PIN kaldırılırsa bilgisayardan sadece <strong>Okul Kodu ({schoolCode || "737454"})</strong> ile bağlanılabilir.
          </p>
        </CardContent>
      </Card>

      {/* Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" />
            Komut Geçmişi
          </CardTitle>
          {commands.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              disabled={clearing}
              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Geçmişi Temizle
            </Button>
          )}
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
