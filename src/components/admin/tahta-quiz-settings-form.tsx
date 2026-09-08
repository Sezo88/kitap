"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { saveTahtaQuizSettings, type TahtaQuizSettings } from "@/lib/actions/tahta-quiz";
import { Monitor, Clock, Zap, Copy, Check, ExternalLink, ShieldCheck, Terminal, HelpCircle } from "lucide-react";

interface Props {
  schoolId: string;
  schoolCode: string;
  initialSettings: TahtaQuizSettings;
}

export function TahtaQuizSettingsForm({ schoolId, schoolCode, initialSettings }: Props) {
  const [settings, setSettings] = useState<TahtaQuizSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const installCommand = `curl -sL ${typeof window !== "undefined" ? window.location.origin : ""}/api/tahta/kurulum.sh | sudo bash -s ${schoolCode}`;

  async function handleSave() {
    setSaving(true);
    const res = await saveTahtaQuizSettings(schoolId, settings);
    if (!res.success) {
      toast("Ayarlar kaydedilemedi: " + res.error, "error");
    } else {
      toast("Akıllı tahta yarışma ayarları güncellendi!", "success");
    }
    setSaving(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    toast("Kurulum komutu panoya kopyalandı", "success");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="space-y-6">
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Monitor className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg">Akıllı Tahta / Günün Sorusu Ayarları</CardTitle>
                <CardDescription className="text-xs">
                  Pardus ETA 23 akıllı tahtalarda sabah oturum açılmadan önce sorulacak yarışma saatini ve kurallarını belirleyin.
                </CardDescription>
              </div>
            </div>
            <a
              href={`/tahta-quiz?okul=${schoolCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline px-3 py-1.5 rounded-lg border border-border hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Tahta Ekranını Önizle
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Aktiflik Switch */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border">
            <div>
              <div className="font-semibold text-sm">Günün Sorusu Tahtalarda Otomatik Açılsın mı?</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Kapatırsanız belirlenen saat gelse dahi tahtalarda soru ekranı açılmaz (sınav haftaları veya tatiller için).
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>

          {/* Saat ve Süre Ayarları */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Başlangıç Saati
              </Label>
              <Input
                type="time"
                value={settings.startTime}
                onChange={(e) => setSettings({ ...settings, startTime: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">Örn: 08:30 (Dersten önceki toplanma)</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Bitiş Saati
              </Label>
              <Input
                type="time"
                value={settings.endTime}
                onChange={(e) => setSettings({ ...settings, endTime: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">Örn: 08:55 (Ders zili çalmadan kapanır)</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                Soru Çözme Süresi (Saniye)
              </Label>
              <Input
                type="number"
                min={15}
                max={120}
                value={settings.duration}
                onChange={(e) => setSettings({ ...settings, duration: parseInt(e.target.value, 10) || 30 })}
              />
              <p className="text-[11px] text-muted-foreground">Önerilen: 30 saniye</p>
            </div>
          </div>

          {/* Ekstra Kurallar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl border">
              <div>
                <div className="text-xs font-semibold">Hız Bonusu Puanı Verilsin mi?</div>
                <div className="text-[11px] text-muted-foreground">Kalan saniye kadar ekstra puan eklenir</div>
              </div>
              <input
                type="checkbox"
                checked={settings.speedBonus}
                onChange={(e) => setSettings({ ...settings, speedBonus: e.target.checked })}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border">
              <div>
                <div className="text-xs font-semibold">Cevaptan Sonra Otomatik Kapanma</div>
                <div className="text-[11px] text-muted-foreground">Cevap onaylandıktan sonra tahta kilit ekranına döner</div>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={5}
                  max={60}
                  className="w-16 h-8 text-xs text-center"
                  value={settings.autoCloseSeconds}
                  onChange={(e) => setSettings({ ...settings, autoCloseSeconds: parseInt(e.target.value, 10) || 15 })}
                />
                <span className="text-xs text-muted-foreground">sn</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pardus ETA 23 Tek Tikla Kurulum Kutusu */}
      <Card className="border shadow-sm bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5 text-amber-400">
            <Terminal className="h-5 w-5" />
            <CardTitle className="text-base text-white">Pardus ETA 23 Akıllı Tahtalara Tek Tıkla Kurulum</CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-400">
            Bu komutu akıllı tahtanın terminalinde <strong>sadece bir defa</strong> çalıştırmanız yeterlidir. Tahta kendini otomatik günceller, bir daha tahtanın yanına gitmeniz gerekmez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-3 font-mono text-xs">
            <span className="text-emerald-400 break-all select-all">
              {installCommand}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="shrink-0 bg-white/10 hover:bg-white/20 border-white/20 text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>Oturum Açmadan Çalışır:</strong> Öğretmen şifresi gerekmeden kilit ekranının önünde başlar.
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5">
              <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Dersleri Asla Bölmez:</strong> Süre dolunca veya cevaplanınca kendiliğinden kapanır.
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5">
              <Zap className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong>Uzaktan Güncellenir:</strong> Saati veya kuralları buradan değiştirdiğinizde tüm tahtalar anında uygular.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
