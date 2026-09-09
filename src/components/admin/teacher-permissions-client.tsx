"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { saveTeacherPermissions } from "@/lib/actions/permissions";
import { MANAGEABLE_PERMISSIONS, TeacherPermissionConfig } from "@/lib/types/permissions";
import { 
  ShieldCheck, 
  Save, 
  RotateCcw, 
  CheckCheck, 
  Eye, 
  AlertCircle,
  Sparkles,
  BookOpen,
  CalendarDays,
  Bell
} from "lucide-react";

interface Props {
  schoolId: string;
  initialPermissions: Record<string, boolean>;
}

export function TeacherPermissionsClient({ schoolId, initialPermissions }: Props) {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    MANAGEABLE_PERMISSIONS.forEach((p) => {
      initial[p.key] = initialPermissions[p.key] !== undefined 
        ? initialPermissions[p.key] 
        : p.defaultAllowed;
    });
    return initial;
  });

  const [saving, setSaving] = useState(false);

  // Toggle individual permission
  const handleToggle = (key: string) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Reset to system defaults
  const handleResetToDefaults = () => {
    const defaults: Record<string, boolean> = {};
    MANAGEABLE_PERMISSIONS.forEach((p) => {
      defaults[p.key] = p.defaultAllowed;
    });
    setPermissions(defaults);
    toast("Varsayılan yetkiler yüklendi. Kaydetmek için 'Değişiklikleri Kaydet'e basın.", "info");
  };

  // Enable all
  const handleEnableAll = () => {
    const allEnabled: Record<string, boolean> = {};
    MANAGEABLE_PERMISSIONS.forEach((p) => {
      allEnabled[p.key] = true;
    });
    setPermissions(allEnabled);
    toast("Tüm modüller aktif edildi. Kaydetmek için 'Değişiklikleri Kaydet'e basın.", "info");
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveTeacherPermissions(schoolId, permissions);
      if (res.success) {
        toast("Öğretmen yetkileri başarıyla güncellendi! Öğretmenler sayfayı yenilediklerinde yeni menüleri görecekler.", "success");
      } else {
        toast("Hata: " + res.error, "error");
      }
    } catch (err: any) {
      toast("Yetkiler kaydedilirken bir hata oluştu: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by category
  const categories = ["Temel Modüller", "Akademik & Program", "İdare & Zil Sistemi"] as const;

  const getCategoryIcon = (cat: string) => {
    if (cat === "Temel Modüller") return <BookOpen className="w-5 h-5 text-indigo-500" />;
    if (cat === "Akademik & Program") return <CalendarDays className="w-5 h-5 text-amber-500" />;
    return <Bell className="w-5 h-5 text-rose-500" />;
  };

  // Count active modules
  const activeCount = Object.values(permissions).filter(Boolean).length;
  const totalCount = MANAGEABLE_PERMISSIONS.length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Üst Bilgi Kartı */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 border border-indigo-900/50 shadow-xl">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-400/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>İdare Özel Yetki Yönetimi</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Öğretmen Menü ve Sayfa Yetkileri
            </h1>
            <p className="text-indigo-200/80 text-sm max-w-2xl">
              Öğretmen rolündeki kullanıcıların sol menüde hangi sayfaları görebileceğini ve erişebileceğini buradan özelleştirebilirsiniz. Değişiklikler anında geçerli olur.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefaults}
              className="text-xs font-semibold border-white/20 bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Varsayılana Sıfırla
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnableAll}
              className="text-xs font-semibold border-white/20 bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              Tümünü Aç
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-700/30 border border-emerald-500/30 cursor-pointer"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </Button>
          </div>
        </div>

        {/* İstatistik Çubuğu */}
        <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs text-indigo-200/90">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Aktif Modüller: <strong>{activeCount} / {totalCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Gizli Modüller: <strong>{totalCount - activeCount}</strong></span>
          </div>
          <div className="ml-auto text-indigo-300/70 text-[11px]">
            * İdareci ve Süper Admin tüm menülere her zaman tam yetkilidir.
          </div>
        </div>
      </div>

      {/* Kategoriler ve İzin Kartları */}
      <div className="space-y-6">
        {categories.map((category) => {
          const categoryItems = MANAGEABLE_PERMISSIONS.filter((p) => p.category === category);
          return (
            <Card key={category} className="shadow-xs border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  {getCategoryIcon(category)}
                  <CardTitle className="text-base sm:text-lg font-bold">
                    {category}
                  </CardTitle>
                  <Badge variant="outline" className="ml-auto text-xs font-medium">
                    {categoryItems.filter((i) => permissions[i.key]).length} / {categoryItems.length} Aktif
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {category === "Temel Modüller" && "Öğretmenlerin günlük ders ve öğrenci takiplerinde kullandığı temel araçlar."}
                  {category === "Akademik & Program" && "Okul ders programı, nöbet çizelgeleri ve soru havuzuna öğretmen erişimi."}
                  {category === "İdare & Zil Sistemi" && "Zil saatleri, uzaktan zil tetikleme ve akıllı pano yönetimi."}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {categoryItems.map((item) => {
                  const isEnabled = permissions[item.key] || false;
                  return (
                    <div
                      key={item.key}
                      className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-lg"
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {item.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {item.href}
                          </span>
                          {isEnabled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                              Görünür
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              Gizli
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.description}
                        </p>
                      </div>

                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => handleToggle(item.key)}
                        aria-label={item.label}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alt Kaydet Butonu */}
      <div className="sticky bottom-4 z-10 flex items-center justify-between p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Değişikliklerin geçerli olması için kaydetmeyi unutmayınız.
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 shadow-md shadow-emerald-700/20 cursor-pointer"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
        </Button>
      </div>
    </div>
  );
}
