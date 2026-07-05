"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ShieldAlert, Search, MessageSquare, Calendar, X, Coins, Activity, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";

interface School {
  id: string;
  name: string;
  code: string;
  feature_attendance: boolean;
  feature_library: boolean;
  feature_cleanliness: boolean;
  feature_lesson_schedule: boolean;
  feature_bell: boolean;
  license_expires_at: string | null;
}

interface SMSLog {
  id: string;
  phone_number: string;
  message_body: string;
  status: string;
  created_at: string;
  students?: {
    full_name: string;
  };
}

interface SMSSettings {
  id?: string;
  provider_name: string;
  api_key: string;
  api_secret: string | null;
  api_base_url: string | null;
  sender_id: string;
  is_active: boolean;
  sms_unit_cost: number;
}

interface Props {
  initialSchools: School[];
}

export function SchoolsClient({ initialSchools }: Props) {
  const [schools, setSchools] = useState<School[]>(initialSchools);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  // Modal State
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<"settings" | "logs">("settings");
  const [smsSettings, setSmsSettings] = useState<SMSSettings>({
    provider_name: "netgsm",
    api_key: "",
    api_secret: "",
    api_base_url: "",
    sender_id: "",
    is_active: false,
    sms_unit_cost: 0.15
  });
  const [smsLogs, setSmsLogs] = useState<SMSLog[]>([]);
  const [loadingSMS, setLoadingSMS] = useState(false);
  const [savingSMS, setSavingSMS] = useState(false);

  const filteredSchools = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  async function toggleFeature(schoolId: string, feature: keyof School, currentValue: boolean) {
    const nextValue = !currentValue;

    setSchools((prev) =>
      prev.map((s) => (s.id === schoolId ? { ...s, [feature]: nextValue } : s))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("schools")
      .update({ [feature]: nextValue })
      .eq("id", schoolId);

    if (error) {
      setSchools((prev) =>
        prev.map((s) => (s.id === schoolId ? { ...s, [feature]: currentValue } : s))
      );
      toast("Güncelleme hatası: " + error.message, "error");
    } else {
      toast("Okul lisans özellikleri güncellendi.", "success");
    }
  }

  async function updateLicenseExpiry(schoolId: string, dateStr: string) {
    const nextValue = dateStr ? new Date(dateStr).toISOString() : null;

    setSchools((prev) =>
      prev.map((s) => (s.id === schoolId ? { ...s, license_expires_at: nextValue } : s))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("schools")
      .update({ license_expires_at: nextValue })
      .eq("id", schoolId);

    if (error) {
      toast("Lisans tarihi güncellenemedi: " + error.message, "error");
    } else {
      toast("Lisans süresi güncellendi.", "success");
    }
  }

  async function handleDeleteSchool(school: School) {
    const confirmName = window.prompt(
      `DİKKAT: "${school.name}" okulunu ve bu okula ait TÜM sınıfları, öğrencileri, yoklama kayıtlarını ve kitap verilerini kalıcı olarak silmek üzeresiniz!\n\nDevam etmek için okulun adını tam olarak yazın:`
    );

    if (confirmName !== school.name) {
      if (confirmName !== null) {
        toast("Okul adı eşleşmedi, silme işlemi iptal edildi.", "error");
      }
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("schools")
      .delete()
      .eq("id", school.id);

    if (error) {
      toast("Okul silinemedi: " + error.message, "error");
    } else {
      setSchools((prev) => prev.filter((s) => s.id !== school.id));
      toast(`"${school.name}" okulu ve tüm ilişkili verileri başarıyla silindi.`, "success");
    }
  }

  // SMS Ayarları ve Raporları Yükle
  async function openSMSManagement(school: School) {
    setSelectedSchool(school);
    setActiveTab("settings");
    setLoadingSMS(true);
    
    const supabase = createClient();

    // 1. SMS Ayarlarını Getir
    const { data: settingsData } = await supabase
      .from("sms_provider_settings")
      .select("*")
      .eq("school_id", school.id)
      .maybeSingle();

    if (settingsData) {
      setSmsSettings({
        id: settingsData.id,
        provider_name: settingsData.provider_name || "netgsm",
        api_key: settingsData.api_key || "",
        api_secret: settingsData.api_secret || "",
        api_base_url: settingsData.api_base_url || "",
        sender_id: settingsData.sender_id || "",
        is_active: settingsData.is_active || false,
        sms_unit_cost: Number(settingsData.sms_unit_cost) || 0.15
      });
    } else {
      // Varsayılan boş ayarlar
      setSmsSettings({
        provider_name: "netgsm",
        api_key: "",
        api_secret: "",
        api_base_url: "",
        sender_id: "",
        is_active: false,
        sms_unit_cost: 0.15
      });
    }

    // 2. Son 100 SMS Loglarını Getir
    const { data: logsData } = await supabase
      .from("sms_logs")
      .select("*, students(full_name)")
      .order("created_at", { ascending: false })
      .limit(100);

    // SQL join'i filter edelim (PostgREST nested filter yerine JavaScript ile filtreleme daha güvenlidir)
    const schoolStudents = await supabase
      .from("students")
      .select("id")
      .eq("school_id", school.id);
    
    const studentIds = new Set(schoolStudents.data?.map(s => s.id) || []);
    
    const filteredLogs = (logsData || []).filter(log => studentIds.has(log.student_id));
    setSmsLogs(filteredLogs);

    setLoadingSMS(false);
  }

  // SMS Ayarlarını Kaydet
  async function saveSMSSettings() {
    if (!selectedSchool) return;
    setSavingSMS(true);

    const supabase = createClient();
    let res;

    const payload = {
      school_id: selectedSchool.id,
      provider_name: smsSettings.provider_name,
      api_key: smsSettings.api_key,
      api_secret: smsSettings.api_secret || null,
      api_base_url: smsSettings.api_base_url || null,
      sender_id: smsSettings.sender_id,
      is_active: smsSettings.is_active,
      sms_unit_cost: smsSettings.sms_unit_cost,
      updated_by: (await supabase.auth.getUser()).data.user?.id
    };

    if (smsSettings.id) {
      // Update
      res = await supabase
        .from("sms_provider_settings")
        .update(payload)
        .eq("id", smsSettings.id);
    } else {
      // Insert
      res = await supabase
        .from("sms_provider_settings")
        .insert(payload);
    }

    if (res.error) {
      toast("SMS ayarları kaydedilemedi: " + res.error.message, "error");
    } else {
      toast("SMS ayarları başarıyla güncellendi.", "success");
      // Modalı kapat
      setSelectedSchool(null);
    }
    setSavingSMS(false);
  }

  // Maliyet Raporları
  const totalSentSMS = smsLogs.filter(l => l.status === "sent").length;
  const totalSMSCost = totalSentSMS * smsSettings.sms_unit_cost;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Okul Listesi ve Lisans Kontrol Paneli
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Okul adı veya kodu ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Okul Adı</TableHead>
                  <TableHead>Okul Kodu</TableHead>
                  <TableHead>Lisans Bitiş Tarihi</TableHead>
                  <TableHead className="text-center">Yoklama Yetkisi</TableHead>
                  <TableHead className="text-center">Kitap Yetkisi</TableHead>
                  <TableHead className="text-center">Temiz Sınıf Yetkisi</TableHead>
                  <TableHead className="text-center">Ders Programı Yetkisi</TableHead>
                  <TableHead className="text-center">Zil Yetkisi</TableHead>
                  <TableHead className="text-center">SMS Ayar</TableHead>
                  <TableHead className="text-center">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchools.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Okul bulunamadı
                    </TableCell>
                  </TableRow>
                )}
                {filteredSchools.map((school) => {
                  const isExpired = school.license_expires_at && new Date(school.license_expires_at).getTime() < Date.now();
                  return (
                    <TableRow key={school.id} className={isExpired ? "bg-rose-50/30" : ""}>
                      <TableCell className="font-semibold">
                        <div className="flex flex-col">
                          <span>{school.name}</span>
                          {isExpired && (
                            <span className="text-[10px] text-destructive font-bold mt-0.5">⚠️ LİSANS SÜRESİ DOLDU</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded border">
                          {school.code}
                        </span>
                      </TableCell>

                      {/* Lisans Bitiş */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                          <input
                            type="date"
                            value={school.license_expires_at ? new Date(school.license_expires_at).toISOString().split('T')[0] : ""}
                            onChange={(e) => updateLicenseExpiry(school.id, e.target.value)}
                            className={`border rounded px-2 py-1 text-xs bg-background ${
                              isExpired ? "border-destructive text-destructive font-semibold" : ""
                            }`}
                          />
                        </div>
                      </TableCell>
                      
                      {/* Yoklama */}
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => toggleFeature(school.id, "feature_attendance", school.feature_attendance)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                            school.feature_attendance ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              school.feature_attendance ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </TableCell>

                      {/* Kitap */}
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => toggleFeature(school.id, "feature_library", school.feature_library)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                            school.feature_library ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              school.feature_library ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </TableCell>

                      {/* Temiz Sınıf */}
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => toggleFeature(school.id, "feature_cleanliness", school.feature_cleanliness)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                            school.feature_cleanliness ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              school.feature_cleanliness ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </TableCell>

                      {/* Ders Programı */}
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => toggleFeature(school.id, "feature_lesson_schedule", school.feature_lesson_schedule)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                            school.feature_lesson_schedule ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              school.feature_lesson_schedule ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </TableCell>

                      {/* Zil */}
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => toggleFeature(school.id, "feature_bell", school.feature_bell)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                            school.feature_bell ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              school.feature_bell ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </TableCell>

                      {/* SMS Ayar Butonu */}
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => openSMSManagement(school)}
                          className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors border border-primary/20"
                          title="SMS Ayarlarını & Raporlarını Yönet"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      </TableCell>

                      {/* Okul Silme Butonu */}
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteSchool(school)}
                          className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors border border-destructive/20"
                          title="Okulu Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── SMS YÖNETİM MODALI (OVERLAY) ─────────────────────── */}
      {selectedSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-lg">{selectedSchool.name}</h3>
                <p className="text-xs text-muted-foreground">SMS Sağlayıcı Ayarları & Gönderim Raporları</p>
              </div>
              <button
                onClick={() => setSelectedSchool(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b bg-muted/40">
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === "settings"
                    ? "border-primary text-primary bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                ⚙️ SMS Sağlayıcı Ayarları
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === "logs"
                    ? "border-primary text-primary bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                📊 Gönderim Geçmişi & Maliyet Raporu
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingSMS ? (
                <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
              ) : activeTab === "settings" ? (
                /* TAB 1: SETTINGS FORM */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold block mb-1">SMS Servis Sağlayıcı</label>
                      <select
                        value={smsSettings.provider_name}
                        onChange={(e) => setSmsSettings({ ...smsSettings, provider_name: e.target.value })}
                        className="w-full text-sm border rounded px-3 py-2 bg-background"
                      >
                        <option value="netgsm">NetGSM</option>
                        <option value="iletim_merkezi">İletim Merkezi</option>
                        <option value="vatan_sms">Vatan SMS</option>
                        <option value="custom">Özel HTTP API</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold block mb-1">Başlık (Sender ID)</label>
                      <Input
                        value={smsSettings.sender_id}
                        onChange={(e) => setSmsSettings({ ...smsSettings, sender_id: e.target.value })}
                        placeholder="ör: BİLGE_KOLEJ"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">API Key / Kullanıcı Adı</label>
                    <Input
                      value={smsSettings.api_key}
                      onChange={(e) => setSmsSettings({ ...smsSettings, api_key: e.target.value })}
                      placeholder="API Anahtarı veya kullanıcı adı..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold block mb-1">API Secret / Şifre</label>
                      <Input
                        type="password"
                        value={smsSettings.api_secret || ""}
                        onChange={(e) => setSmsSettings({ ...smsSettings, api_secret: e.target.value })}
                        placeholder="Boş bırakılabilir..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold block mb-1">Birim SMS Maliyeti (TL)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={smsSettings.sms_unit_cost}
                        onChange={(e) => setSmsSettings({ ...smsSettings, sms_unit_cost: Number(e.target.value) })}
                        placeholder="ör: 0.15"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Özel API URL (Custom Provider İçin)</label>
                    <Input
                      value={smsSettings.api_base_url || ""}
                      onChange={(e) => setSmsSettings({ ...smsSettings, api_base_url: e.target.value })}
                      placeholder="ör: https://api.servis.com/send"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="sms-active-switch"
                      checked={smsSettings.is_active}
                      onChange={(e) => setSmsSettings({ ...smsSettings, is_active: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="sms-active-switch" className="text-sm font-semibold select-none cursor-pointer">
                      Bu okul için SMS gönderimini aktif et
                    </label>
                  </div>
                </div>
              ) : (
                /* TAB 2: LOGS & COSTS REPORT */
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-3 text-center">
                        <div className="text-xs text-muted-foreground">Başarılı Gönderim</div>
                        <div className="text-xl font-bold mt-1 text-primary">{totalSentSMS} SMS</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-emerald-50 border-emerald-200">
                      <CardContent className="p-3 text-center">
                        <div className="text-xs text-emerald-800">Birim Maliyet</div>
                        <div className="text-xl font-bold mt-1 text-emerald-700">{smsSettings.sms_unit_cost.toFixed(2)} TL</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-rose-50 border-rose-200">
                      <CardContent className="p-3 text-center">
                        <div className="text-xs text-rose-800">Toplam Harcama</div>
                        <div className="text-xl font-bold mt-1 text-rose-700">{totalSMSCost.toFixed(2)} TL</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Logs Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="text-xs">Öğrenci</TableHead>
                          <TableHead className="text-xs">Telefon</TableHead>
                          <TableHead className="text-xs">Durum</TableHead>
                          <TableHead className="text-xs">Maliyet</TableHead>
                          <TableHead className="text-xs">Tarih</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {smsLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                              Gönderilmiş SMS kaydı bulunmuyor.
                            </TableCell>
                          </TableRow>
                        ) : (
                          smsLogs.map((log) => (
                            <TableRow key={log.id} className="text-xs">
                              <TableCell className="font-semibold">{log.students?.full_name || "-"}</TableCell>
                              <TableCell className="font-mono">{log.phone_number}</TableCell>
                              <TableCell>
                                {log.status === "sent" ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                                    <CheckCircle className="h-3.5 w-3.5" /> İletildi
                                  </span>
                                ) : log.status === "failed" ? (
                                  <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                                    <XCircle className="h-3.5 w-3.5" /> Hata
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                                    <Clock className="h-3.5 w-3.5" /> Bekliyor
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="font-semibold text-slate-700">
                                {log.status === "sent" ? `${smsSettings.sms_unit_cost.toFixed(2)} TL` : "0.00 TL"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(log.created_at).toLocaleString("tr-TR")}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t flex justify-end gap-2 bg-muted/20">
              <button
                type="button"
                onClick={() => setSelectedSchool(null)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium transition-colors"
              >
                Kapat
              </button>
              {activeTab === "settings" && (
                <button
                  type="button"
                  onClick={saveSMSSettings}
                  disabled={savingSMS}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/95 transition-colors active:scale-95"
                >
                  {savingSMS ? "Kaydediliyor..." : "Ayarları Kaydet"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
