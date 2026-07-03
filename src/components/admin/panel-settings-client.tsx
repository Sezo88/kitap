"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Plus, Trash2, Megaphone, Monitor, Copy, Check } from "lucide-react";
import type { PanelSettings, PanelAnnouncement } from "@/lib/types/database";

interface Props {
  initialSettings: PanelSettings;
  initialAnnouncements: PanelAnnouncement[];
  schoolId: string;
  schoolCode: string;
}

const SLIDE_OPTIONS = [
  { id: "announcements", label: "Aktif Duyurular" },
  { id: "lessons", label: "Bugünün Ders Programı" },
  { id: "top_readers", label: "Okuma Şampiyonları (Haftalık/Aylık)" },
  { id: "birthdays", label: "Bugün Doğan Öğrenciler" },
  { id: "duties", label: "Bugünün Nöbetçi Öğretmenleri" },
];

export function PanelSettingsClient({ initialSettings, initialAnnouncements, schoolId, schoolCode }: Props) {
  const [activeSlides, setActiveSlides] = useState<string[]>(initialSettings.active_slides);
  const [duration, setDuration] = useState(initialSettings.slide_duration);
  const [announcements, setAnnouncements] = useState<PanelAnnouncement[]>(initialAnnouncements);
  const [savingSettings, setSavingSettings] = useState(false);

  // Yeni Duyuru Formu
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [addingAnnouncement, setAddingAnnouncement] = useState(false);

  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const panoUrl = typeof window !== "undefined" 
    ? `${window.location.protocol}//${window.location.host}/panel?code=${schoolCode}` 
    : `/panel?code=${schoolCode}`;

  function handleToggleSlide(slideId: string, checked: boolean) {
    if (checked) {
      setActiveSlides([...activeSlides, slideId]);
    } else {
      setActiveSlides(activeSlides.filter((s) => s !== slideId));
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("panel_settings")
      .update({
        active_slides: activeSlides,
        slide_duration: duration,
      })
      .eq("id", initialSettings.id);

    if (error) {
      toast("Ayarlar kaydedilemedi: " + error.message, "error");
    } else {
      toast("Pano ayarları güncellendi", "success");
    }
    setSavingSettings(false);
  }

  async function handleAddAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toast("Lütfen başlık ve içerik girin", "error");
      return;
    }

    setAddingAnnouncement(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("panel_announcements")
      .insert({
        school_id: schoolId,
        title: newTitle,
        content: newContent,
        expires_at: newExpiresAt || null,
      })
      .select("*")
      .single();

    if (error) {
      toast("Duyuru eklenemedi: " + error.message, "error");
    } else {
      toast("Yeni duyuru eklendi", "success");
      if (data) setAnnouncements([data, ...announcements]);
      setNewTitle("");
      setNewContent("");
      setNewExpiresAt("");
    }
    setAddingAnnouncement(false);
  }

  async function handleDeleteAnnouncement(id: string) {
    if (!confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;

    const supabase = createClient();
    const { error } = await supabase.from("panel_announcements").delete().eq("id", id);

    if (error) {
      toast("Duyuru silinemedi: " + error.message, "error");
    } else {
      toast("Duyuru silindi", "success");
      setAnnouncements(announcements.filter((a) => a.id !== id));
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(panoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast("Pano bağlantısı kopyalandı", "success");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Sol taraf: Pano Bağlantısı & Slayt Ayarları */}
      <div className="lg:col-span-1 space-y-6">
        {/* Pano Bağlantısı */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Monitor className="h-5 w-5 text-primary" />
              Pano Bağlantısı (Kiosk URL)
            </CardTitle>
            <CardDescription className="text-xs">
              Bu bağlantıyı Raspberry Pi veya akıllı tahtadaki tarayıcıda tam ekran (kiosk modda) açın.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={panoUrl} readOnly className="text-xs font-mono select-all bg-background" />
              <Button type="button" size="icon" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              * Bu bağlantı okul kodunu içerir ve şifresiz çalışır, sadece panoda göstermek içindir.
            </p>
          </CardContent>
        </Card>

        {/* Slayt Seçimleri */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktif Slaytlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {SLIDE_OPTIONS.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id={opt.id}
                    checked={activeSlides.includes(opt.id)}
                    onChange={(e) => handleToggleSlide(opt.id, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-800 cursor-pointer"
                  />
                  <Label htmlFor={opt.id} className="text-sm font-normal cursor-pointer select-none">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="duration" className="text-xs font-semibold">Slayt Geçiş Süresi (Saniye)</Label>
              <Input
                id="duration"
                type="number"
                min="5"
                max="120"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 10)}
                className="w-24"
              />
            </div>

            <Button type="button" onClick={handleSaveSettings} disabled={savingSettings} className="w-full mt-2">
              <Save className="h-4 w-4 mr-1.5" />
              {savingSettings ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sağ taraf: Duyurular Yönetimi */}
      <div className="lg:col-span-2 space-y-6">
        {/* Yeni Duyuru Ekle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-5 w-5 text-purple-600" />
              Yeni Duyuru Ekle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddAnnouncement} className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="title" className="text-xs">Duyuru Başlığı</Label>
                <Input
                  id="title"
                  placeholder="Örn: Veli Toplantısı Duyurusu"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="content" className="text-xs">Duyuru İçeriği</Label>
                <Input
                  id="content"
                  placeholder="Duyuru metnini buraya yazın..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="expires" className="text-xs">Son Gösterim Tarihi (Opsiyonel)</Label>
                <Input
                  id="expires"
                  type="date"
                  value={newExpiresAt}
                  onChange={(e) => setNewExpiresAt(e.target.value)}
                  className="w-48"
                />
              </div>

              <Button type="submit" disabled={addingAnnouncement} className="mt-2">
                <Plus className="h-4 w-4 mr-1.5" />
                {addingAnnouncement ? "Ekleniyor..." : "Duyuruyu Ekle"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Mevcut Duyurular */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mevcut Duyurular</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Başlık</TableHead>
                  <TableHead>İçerik</TableHead>
                  <TableHead>Son Gösterim</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Henüz duyuru eklenmemiş.
                    </TableCell>
                  </TableRow>
                )}
                {announcements.map((ann) => (
                  <TableRow key={ann.id}>
                    <TableCell className="font-medium text-sm">{ann.title}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate" title={ann.content}>
                      {ann.content}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ann.expires_at ? new Date(ann.expires_at).toLocaleDateString("tr-TR") : "Süresiz"}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
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
