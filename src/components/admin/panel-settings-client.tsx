"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Plus, Trash2, Megaphone, Monitor, Copy, Check, Image, Palette, Key } from "lucide-react";
import type { PanelSettings, PanelAnnouncement } from "@/lib/types/database";

interface GalleryItem {
  id: string;
  cloudinary_url: string;
  caption: string | null;
  display_order: number;
}

interface PanoConfig {
  id?: string;
  theme: string;
  school_logo_url: string | null;
  school_motto: string | null;
  slide_interval: number;
  show_clock: boolean;
  show_top_readers: boolean;
  show_top_class: boolean;
}

interface Props {
  initialSettings: PanelSettings;
  initialConfig: PanoConfig | null;
  initialAnnouncements: PanelAnnouncement[];
  initialGallery: GalleryItem[];
  schoolId: string;
  schoolCode: string;
  panoPin: string;
}

const THEMES = [
  { id: "blue", label: "Mavi (Varsayilan)", color: "#667eea" },
  { id: "green", label: "Yesil", color: "#2E7D32" },
  { id: "orange", label: "Turuncu", color: "#FF9800" },
  { id: "purple", label: "Mor", color: "#9C27B0" },
  { id: "red", label: "Kirmizi", color: "#D32F2F" },
  { id: "teal", label: "Turkuaz", color: "#00897B" },
  { id: "indigo", label: "Lacivert", color: "#303F9F" },
  { id: "pink", label: "Pembe", color: "#E91E63" },
  { id: "dark", label: "Koyu", color: "#424242" },
  { id: "sky", label: "Gokyuzu", color: "#0288D1" },
];

const SLIDE_CATEGORIES = [
  { id: "duyuru", label: "Duyuru" },
  { id: "etkinlik", label: "Etkinlik" },
  { id: "ayin_ogrencisi", label: "Ayin Ogrencisi" },
  { id: "ayin_sinifi", label: "Ayin Sinifi" },
  { id: "deneme_liderleri", label: "Deneme Liderleri" },
];

export function PanelSettingsClient({ initialSettings, initialConfig, initialAnnouncements, initialGallery, schoolId, schoolCode, panoPin: initialPin }: Props) {
  const [activeSlides, setActiveSlides] = useState<string[]>(initialSettings.active_slides);
  const [duration, setDuration] = useState(initialSettings.slide_duration);
  const [announcements, setAnnouncements] = useState<PanelAnnouncement[]>(initialAnnouncements);
  const [gallery, setGallery] = useState<GalleryItem[]>(initialGallery);

  // Config
  const [theme, setTheme] = useState(initialConfig?.theme || "blue");
  const [logoUrl, setLogoUrl] = useState(initialConfig?.school_logo_url || "");
  const [motto, setMotto] = useState(initialConfig?.school_motto || "");
  const [slideInterval, setSlideInterval] = useState(initialConfig?.slide_interval || 10);
  const [showClock, setShowClock] = useState(initialConfig?.show_clock ?? true);
  const [showTopReaders, setShowTopReaders] = useState(initialConfig?.show_top_readers ?? true);
  const [showTopClass, setShowTopClass] = useState(initialConfig?.show_top_class ?? true);

  // PIN
  const [panoPin, setPanoPin] = useState(initialPin);

  // Announcement form
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("duyuru");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newPriority, setNewPriority] = useState(0);
  const [addingAnnouncement, setAddingAnnouncement] = useState(false);

  // Gallery form
  const [newGalleryUrl, setNewGalleryUrl] = useState("");
  const [newGalleryCaption, setNewGalleryCaption] = useState("");
  const [addingGallery, setAddingGallery] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Cloudinary widget script yukle
  useEffect(() => {
    if (document.getElementById('cloudinary-widget-script')) return;
    const script = document.createElement('script');
    script.id = 'cloudinary-widget-script';
    script.src = 'https://upload-widget.cloudinary.com/global/all.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const panoUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/pano`
    : "/pano";

  // ── Config kaydet ─────────────────────────────────────────
  async function handleSaveConfig() {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      school_id: schoolId,
      theme, school_logo_url: logoUrl || null, school_motto: motto || null,
      slide_interval: slideInterval, show_clock: showClock,
      show_top_readers: showTopReaders, show_top_class: showTopClass,
      updated_by: (await supabase.auth.getUser()).data.user?.id,
    };

    let error;
    if (initialConfig?.id) {
      ({ error } = await supabase.from("panel_config").update(payload).eq("id", initialConfig.id));
    } else {
      ({ error } = await supabase.from("panel_config").insert(payload));
    }

    if (error) toast("Ayarlar kaydedilemedi: " + error.message, "error");
    else toast("Pano ayarlari guncellendi", "success");
    setSaving(false);
  }

  // ── PIN kaydet ────────────────────────────────────────────
  async function handleSavePin() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("schools").update({ pano_pin: panoPin || null }).eq("id", schoolId);
    if (error) toast("PIN kaydedilemedi: " + error.message, "error");
    else toast("Pano PIN'i guncellendi", "success");
    setSaving(false);
  }

  // ── Settings kaydet ───────────────────────────────────────
  async function handleSaveSettings() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("panel_settings").update({
      active_slides: activeSlides, slide_duration: duration,
    }).eq("id", initialSettings.id);
    if (error) toast("Ayarlar kaydedilemedi: " + error.message, "error");
    else toast("Slayt ayarlari guncellendi", "success");
    setSaving(false);
  }

  // ── Duyuru ────────────────────────────────────────────────
  async function handleAddAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) { toast("Baslik gerekli", "error"); return; }
    setAddingAnnouncement(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("panel_announcements").insert({
      school_id: schoolId, title: newTitle, content: newContent || null,
      category: newCategory, image_url: newImageUrl || null, priority: newPriority,
    }).select("*").single();
    if (error) toast("Hata: " + error.message, "error");
    else {
      if (data) setAnnouncements([data, ...announcements]);
      toast("Duyuru eklendi", "success");
      setNewTitle(""); setNewContent(""); setNewImageUrl(""); setNewPriority(0);
    }
    setAddingAnnouncement(false);
  }

  async function handleDeleteAnnouncement(id: string) {
    if (!confirm("Bu duyuruyu silmek istediginize emin misiniz?")) return;
    const supabase = createClient();
    await supabase.from("panel_announcements").delete().eq("id", id);
    setAnnouncements(announcements.filter((a) => a.id !== id));
    toast("Duyuru silindi", "success");
  }

  // ── Galeri ────────────────────────────────────────────────
  async function handleAddGallery(e: React.FormEvent) {
    e.preventDefault();
    if (!newGalleryUrl.trim()) { toast("Cloudinary URL gerekli", "error"); return; }
    setAddingGallery(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("panel_gallery").insert({
      school_id: schoolId, cloudinary_url: newGalleryUrl,
      caption: newGalleryCaption || null, display_order: gallery.length,
    }).select("*").single();
    if (error) toast("Hata: " + error.message, "error");
    else {
      if (data) setGallery([...gallery, data as GalleryItem]);
      toast("Gorsel eklendi", "success");
      setNewGalleryUrl(""); setNewGalleryCaption("");
    }
    setAddingGallery(false);
  }

  function handleCloudinaryUpload() {
    setUploading(true);
    // Cloudinary Upload Widget
    const widget = (window as any).cloudinary.createUploadWidget({
      cloudName: 'dvvh4n2oh',
      uploadPreset: 'okul_pano',
      sources: ['local', 'url', 'camera'],
      multiple: false,
      maxFileSize: 10000000,
      language: 'tr',
      text: { 'tr': { menu: { files: 'Dosyalarim' } } },
    }, async (error: any, result: any) => {
      if (error) { toast("Yukleme hatasi: " + error.message, "error"); setUploading(false); return; }
      if (result.event === 'success') {
        const url = result.info.secure_url;
        setNewGalleryUrl(url);
        // Otomatik kaydet
        const supabase = createClient();
        const { error: dbErr } = await supabase.from("panel_gallery").insert({
          school_id: schoolId, cloudinary_url: url,
          caption: null, display_order: gallery.length,
        }).select("*").single();
        if (!dbErr) {
          // Refresh gallery list
          const { data: fresh } = await supabase.from("panel_gallery").select("*").eq("school_id", schoolId).order("display_order");
          if (fresh) setGallery(fresh as GalleryItem[]);
          toast("Gorsel yuklendi ve kaydedildi!", "success");
        }
        setUploading(false);
      }
      if (result.event === 'close') setUploading(false);
    });
    widget.open();
  }

  async function handleDeleteGallery(id: string) {
    const supabase = createClient();
    await supabase.from("panel_gallery").delete().eq("id", id);
    setGallery(gallery.filter((g) => g.id !== id));
    toast("Gorsel silindi", "success");
  }

  function handleCopy() {
    navigator.clipboard.writeText(panoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast("Pano baglantisi kopyalandi", "success");
  }

  return (
    <Tabs defaultValue="general">
      <TabsList className="mb-4 flex-wrap h-auto gap-1">
        <TabsTrigger value="general"><Palette className="h-3.5 w-3.5 mr-1" />Gorunum</TabsTrigger>
        <TabsTrigger value="slides"><Monitor className="h-3.5 w-3.5 mr-1" />Slaytlar</TabsTrigger>
        <TabsTrigger value="announcements"><Megaphone className="h-3.5 w-3.5 mr-1" />Duyurular</TabsTrigger>
        <TabsTrigger value="gallery"><Image className="h-3.5 w-3.5 mr-1" />Galeri</TabsTrigger>
        <TabsTrigger value="security"><Key className="h-3.5 w-3.5 mr-1" />Guvenlik</TabsTrigger>
      </TabsList>

      {/* ── GENEL GORUNUM ──────────────────────────────── */}
      <TabsContent value="general">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Tema */}
          <Card>
            <CardHeader><CardTitle className="text-base">Tema</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select value={theme} onChange={(e) => setTheme(e.target.value)}>
                {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
              <div className="flex gap-2 flex-wrap">
                {THEMES.map((t) => (
                  <button key={t.id} onClick={() => setTheme(t.id)}
                    className={`w-8 h-8 rounded-full border-2 ${theme === t.id ? "border-primary scale-110" : "border-transparent opacity-60"}`}
                    style={{ background: t.color }} title={t.label} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Logo & Motto */}
          <Card>
            <CardHeader><CardTitle className="text-base">Okul Kimligi</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Logo URL (Cloudinary)</Label>
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://res.cloudinary.com/..." /></div>
              <div><Label>Okul Mottosu</Label>
                <Input value={motto} onChange={(e) => setMotto(e.target.value)} placeholder="Orn: Bilim ve Ahlak" /></div>
            </CardContent>
          </Card>

          {/* Gosterim Ayarlari */}
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Gosterim</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Slayt Gecis Suresi (sn)</Label>
                  <Input type="number" min={5} max={120} value={slideInterval} onChange={(e) => setSlideInterval(parseInt(e.target.value) || 10)} className="w-24" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showClock} onChange={(e) => setShowClock(e.target.checked)} /> Saat goster</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showTopReaders} onChange={(e) => setShowTopReaders(e.target.checked)} /> En cok okuyanlar</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showTopClass} onChange={(e) => setShowTopClass(e.target.checked)} /> En cok okuyan sinif</label>
                </div>
              </div>
              <Button onClick={handleSaveConfig} disabled={saving}><Save className="h-4 w-4 mr-1" />Kaydet</Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* ── SLAYT AYARLARI ──────────────────────────────── */}
      <TabsContent value="slides">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Pano Baglantisi</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={panoUrl} readOnly className="text-xs font-mono select-all" />
                <Button size="icon" onClick={handleCopy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
              </div>
              <p className="text-xs text-muted-foreground">Raspberry Pi veya akilli tahtada tam ekran acin. PIN: {panoPin || "ayarlanmadi"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Slayt Secimi</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: "announcements", label: "Duyurular" },
                { id: "lessons", label: "Bugunun Ders Programi" },
                { id: "top_readers", label: "Okuma Sampiyonlari" },
                { id: "birthdays", label: "Dogum Gunleri" },
                { id: "duties", label: "Nobetci Ogretmenler" },
              ].map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={activeSlides.includes(opt.id)}
                    onChange={(e) => {
                      if (e.target.checked) setActiveSlides([...activeSlides, opt.id]);
                      else setActiveSlides(activeSlides.filter((s) => s !== opt.id));
                    }} /> {opt.label}
                </label>
              ))}
              <div>
                <Label>Gecis Suresi (sn)</Label>
                <Input type="number" min={5} max={120} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 10)} className="w-24" />
              </div>
              <Button onClick={handleSaveSettings} disabled={saving}><Save className="h-4 w-4 mr-1" />Kaydet</Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* ── DUYURULAR ─────────────────────────────────── */}
      <TabsContent value="announcements">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Yeni Slayt / Duyuru</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleAddAnnouncement} className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div><Label>Baslik</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Duyuru basligi" /></div>
                  <div><Label>Kategori</Label>
                    <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                      {SLIDE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div><Label>Icerik</Label><Input value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Detayli aciklama" /></div>
                  <div><Label>Gorsel URL (Cloudinary, opsiyonel)</Label><Input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="https://res.cloudinary.com/..." /></div>
                </div>
                <div className="flex items-center gap-4">
                  <div><Label>Oncelik</Label><Input type="number" min={0} max={10} value={newPriority} onChange={(e) => setNewPriority(parseInt(e.target.value) || 0)} className="w-20" /></div>
                  <Button type="submit" disabled={addingAnnouncement} className="mt-auto"><Plus className="h-4 w-4 mr-1" />Ekle</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Mevcut Duyurular ({announcements.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Baslik</TableHead><TableHead>Kategori</TableHead><TableHead>Oncelik</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {announcements.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Duyuru yok</TableCell></TableRow>}
                  {announcements.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">{a.title}</TableCell>
                      <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{a.category || "duyuru"}</span></TableCell>
                      <TableCell className="text-xs">{a.priority}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteAnnouncement(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* ── GALERI ────────────────────────────────────── */}
      <TabsContent value="gallery">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Yeni Gorsel Yukle</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button onClick={handleCloudinaryUpload} disabled={uploading} variant="default" size="lg">
                  <Image className="h-5 w-5 mr-2" />
                  {uploading ? "Yukleniyor..." : "Cloudinary'ye Gorsel Yukle"}
                </Button>
                <p className="text-xs text-muted-foreground">Gorsel Cloudinary'ye yuklenir ve otomatik olarak galeriye eklenir.</p>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">veya manuel URL ekle</p>
                  <form onSubmit={handleAddGallery} className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div><Label>Cloudinary URL</Label><Input value={newGalleryUrl} onChange={(e) => setNewGalleryUrl(e.target.value)} placeholder="https://res.cloudinary.com/dvvh4n2oh/..." /></div>
                      <div><Label>Aciklama</Label><Input value={newGalleryCaption} onChange={(e) => setNewGalleryCaption(e.target.value)} placeholder="Gorsel aciklamasi" /></div>
                    </div>
                    <Button type="submit" disabled={addingGallery} variant="outline"><Plus className="h-4 w-4 mr-1" />Ekle</Button>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Galeri ({gallery.length} gorsel)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {gallery.length === 0 && <p className="col-span-full text-center py-8 text-muted-foreground text-sm">Henuz gorsel yok</p>}
                {gallery.map((g) => (
                  <div key={g.id} className="relative group rounded-lg overflow-hidden border aspect-video bg-muted">
                    <img src={g.cloudinary_url} alt={g.caption || ""} className="w-full h-full object-cover" />
                    <button onClick={() => handleDeleteGallery(g.id)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {g.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate">{g.caption}</div>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* ── GUVENLIK ──────────────────────────────────── */}
      <TabsContent value="security">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Key className="h-5 w-5" />Pano PIN Kodu</CardTitle>
            <CardDescription>Bu PIN ile panoya giris yapilir. Okulunuza ozel 4-6 haneli bir sayi belirleyin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Pano PIN</Label>
              <Input type="text" inputMode="numeric" maxLength={6} value={panoPin} onChange={(e) => setPanoPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Orn: 1234" className="text-2xl tracking-widest text-center w-40" /></div>
            <div><Label>Pano URL</Label>
              <div className="flex gap-2"><Input value={panoUrl} readOnly className="text-xs font-mono" />
                <Button size="icon" onClick={handleCopy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button></div>
            </div>
            <Button onClick={handleSavePin} disabled={saving}><Save className="h-4 w-4 mr-1" />PIN'i Kaydet</Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
