"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Save, Send, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { SmsProviderSettings, SmsProviderName } from "@/lib/types/database";

interface Props {
  schoolId: string;
  existingSettings: SmsProviderSettings | null;
  schoolTotalLessons: number;
}

const PROVIDERS: { value: SmsProviderName; label: string; description: string }[] = [
  { value: "netgsm", label: "Netgsm", description: "Türkiye'nin en yaygın toplu SMS servisi" },
  { value: "iletim_merkezi", label: "İletim Merkezi", description: "REST JSON API tabanlı SMS servisi" },
  { value: "vatan_sms", label: "Vatan SMS", description: "Uygun fiyatlı toplu SMS servisi" },
  { value: "custom", label: "Diğer / Özel API", description: "Kendi SMS sağlayıcınızı yapılandırın" },
];

export function SmsSettingsClient({ schoolId, existingSettings, schoolTotalLessons }: Props) {
  const [providerName, setProviderName] = useState<SmsProviderName>(existingSettings?.provider_name || "netgsm");
  const [apiKey, setApiKey] = useState(existingSettings?.api_key || "");
  const [apiSecret, setApiSecret] = useState(existingSettings?.api_secret || "");
  const [senderId, setSenderId] = useState(existingSettings?.sender_id || "");
  const [isActive, setIsActive] = useState(existingSettings?.is_active || false);
  const [smsUnitCost, setSmsUnitCost] = useState(existingSettings?.sms_unit_cost?.toString() || "");
  const [totalLessons, setTotalLessons] = useState(schoolTotalLessons.toString());

  // Custom fields
  const [apiBaseUrl, setApiBaseUrl] = useState(existingSettings?.api_base_url || "");
  const [httpMethod, setHttpMethod] = useState<"GET" | "POST">(
    (existingSettings?.http_method as "GET" | "POST") || "POST"
  );
  const [headerTemplate, setHeaderTemplate] = useState(
    existingSettings?.header_template ? JSON.stringify(existingSettings.header_template, null, 2) : '{\n  "Authorization": "Bearer {api_key}"\n}'
  );
  const [bodyTemplate, setBodyTemplate] = useState(
    existingSettings?.body_template || '{\n  "to": "{phone}",\n  "message": "{message}",\n  "from": "{sender_id}"\n}'
  );

  // Test
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSchool, setSavingSchool] = useState(false);

  const { toast } = useToast();
  const isCustom = providerName === "custom";

  async function handleSaveSchoolSettings() {
    setSavingSchool(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("schools")
      .update({ total_lessons: parseInt(totalLessons) })
      .eq("id", schoolId);

    if (error) {
      toast("Okul ayarları güncellenemedi: " + error.message, "error");
    } else {
      toast("Okul genel ayarları güncellendi", "success");
    }
    setSavingSchool(false);
  }

  async function handleSave() {
    if (!apiKey || !senderId) {
      toast("API anahtarı ve gönderici başlığı zorunlu", "error");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    let parsedHeaders: Record<string, string> | null = null;
    if (isCustom && headerTemplate) {
      try {
        parsedHeaders = JSON.parse(headerTemplate);
      } catch {
        toast("Header şablonu geçerli bir JSON değil", "error");
        setSaving(false);
        return;
      }
    }

    const payload = {
      school_id: schoolId,
      provider_name: providerName,
      api_key: apiKey,
      api_secret: apiSecret || null,
      sender_id: senderId,
      is_active: isActive,
      sms_unit_cost: smsUnitCost ? parseFloat(smsUnitCost) : null,
      api_base_url: isCustom ? apiBaseUrl : null,
      http_method: isCustom ? httpMethod : "POST",
      header_template: isCustom ? parsedHeaders : null,
      body_template: isCustom ? bodyTemplate : null,
      updated_at: new Date().toISOString(),
    };

    // Sadece SMS ayarlarını kaydet
    if (existingSettings) {
      const { error } = await supabase
        .from("sms_provider_settings")
        .update(payload)
        .eq("id", existingSettings.id);
      if (error) {
        toast("Güncelleme hatası: " + error.message, "error");
      } else {
        toast("SMS ayarları güncellendi", "success");
      }
    } else {
      const { error } = await supabase
        .from("sms_provider_settings")
        .insert(payload);
      if (error) {
        toast("Kayıt hatası: " + error.message, "error");
      } else {
        toast("SMS ayarları kaydedildi", "success");
      }
    }

    setSaving(false);
  }

  async function handleTest() {
    if (!testPhone) {
      toast("Test için telefon numarası girin", "error");
      return;
    }
    setTesting(true);
    setTestResult(null);

    // Önce kaydet
    await handleSave();

    try {
      const res = await fetch("/api/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone, schoolId }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message || data.error || "Bilinmeyen sonuç" });
    } catch (err: any) {
      setTestResult({ success: false, message: `Bağlantı hatası: ${err.message}` });
    }

    setTesting(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Security notice */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
        <Shield className="h-4 w-4 shrink-0 mt-0.5" />
        <p>API anahtarlarınız güvenli şekilde saklanır ve sadece sunucu tarafında kullanılır.</p>
      </div>

      {/* Okul Genel Ayarları */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Okul Genel Ayarları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="totalLessons">Günlük Toplam Yoklama/Ders Saati</Label>
            <Select id="totalLessons" value={totalLessons} onChange={(e) => setTotalLessons(e.target.value)}>
              {[4, 5, 6, 7, 8, 9, 10].map((num) => (
                <option key={num} value={num.toString()}>{num} Ders Saati</option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">Öğretmenlerin günlük alabileceği toplam yoklama/ders saati sayısıdır.</p>
          </div>
          <Button onClick={handleSaveSchoolSettings} disabled={savingSchool} size="sm">
            <Save className="h-4 w-4 mr-1" /> {savingSchool ? "Kaydediliyor..." : "Okul Ayarlarını Kaydet"}
          </Button>
        </CardContent>
      </Card>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMS Sağlayıcı Seçimi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => setProviderName(p.value)}
                className={`text-left p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  providerName === p.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <p className="font-medium text-sm">{p.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Anahtarı (Key / Kullanıcı Kodu) *</Label>
              <Input id="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API anahtarınız" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiSecret">API Secret / Şifre</Label>
              <Input id="apiSecret" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="Opsiyonel" type="password" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="senderId">Gönderici Başlığı (Sender ID) *</Label>
              <Input id="senderId" value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder="Örn: OKUMATAK" />
              <p className="text-xs text-muted-foreground">Operatörce onaylanmış SMS başlığı</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitCost">Birim SMS Maliyeti (₺)</Label>
              <Input id="unitCost" value={smsUnitCost} onChange={(e) => setSmsUnitCost(e.target.value)} placeholder="Örn: 0.0350" type="number" step="0.001" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom API Settings */}
      {isCustom && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Özel API Yapılandırması</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="baseUrl">API URL *</Label>
                <Input id="baseUrl" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://api.example.com/sms/send" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="httpMeth">HTTP Metodu</Label>
                <Select id="httpMeth" value={httpMethod} onChange={(e) => setHttpMethod(e.target.value as "GET" | "POST")}>
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="headerTpl">Header Şablonu (JSON)</Label>
              <textarea
                id="headerTpl"
                value={headerTemplate}
                onChange={(e) => setHeaderTemplate(e.target.value)}
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                placeholder='{"Authorization": "Bearer {api_key}"}'
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bodyTpl">Body Şablonu</Label>
              <textarea
                id="bodyTpl"
                value={bodyTemplate}
                onChange={(e) => setBodyTemplate(e.target.value)}
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Yer tutucular: <code className="bg-muted px-1 rounded">{"{phone}"}</code>, <code className="bg-muted px-1 rounded">{"{message}"}</code>, <code className="bg-muted px-1 rounded">{"{api_key}"}</code>, <code className="bg-muted px-1 rounded">{"{api_secret}"}</code>, <code className="bg-muted px-1 rounded">{"{sender_id}"}</code>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active toggle + Save */}
      <Card>
        <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <div>
              <p className="text-sm font-medium">SMS Gönderimi {isActive ? "Aktif" : "Pasif"}</p>
              <p className="text-xs text-muted-foreground">Pasif iken yoklamada SMS gitmez</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-1" /> {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </Button>
        </CardContent>
      </Card>

      {/* Test SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test SMS Gönder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+905XXXXXXXXX"
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={testing} variant="outline">
              <Send className="h-4 w-4 mr-1" /> {testing ? "Gönderiliyor..." : "Test Gönder"}
            </Button>
          </div>
          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${testResult.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
              {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
              <p>{testResult.message}</p>
            </div>
          )}
          {existingSettings?.last_tested_at && (
            <p className="text-xs text-muted-foreground">
              Son test: {new Date(existingSettings.last_tested_at).toLocaleString("tr-TR")} — <Badge variant={existingSettings.last_test_result?.startsWith("Başarılı") ? "success" : "destructive"} className="text-xs">{existingSettings.last_test_result}</Badge>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
