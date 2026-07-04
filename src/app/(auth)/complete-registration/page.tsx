"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Loader2, GraduationCap } from "lucide-react";

export default function CompleteRegistrationPage() {
  const [step, setStep] = useState<"form" | "loading">("loading");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("ogretmen");
  const [schoolCode, setSchoolCode] = useState("");
  const [newSchoolName, setNewSchoolName] = useState("");
  const [createNewSchool, setCreateNewSchool] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setUserId(user.id);
      // Google'dan gelen ismi al
      const googleName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      setFullName(googleName);
      setStep("form");
    }
    init();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError("Ad soyad zorunludur"); return; }
    if (!createNewSchool && !schoolCode.trim()) { setError("Okul kodu gerekli"); return; }
    if (createNewSchool && !newSchoolName.trim()) { setError("Okul adı gerekli"); return; }

    setSaving(true);
    setError("");
    const supabase = createClient();
    let schoolId = "";

    if (createNewSchool) {
      // Yeni okul oluştur (idareci kendi okulunu açar)
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: school, error: schoolErr } = await supabase
        .from("schools")
        .insert({ name: newSchoolName.trim(), code: newCode, created_by: userId })
        .select("id")
        .single();
      if (schoolErr) { setError("Okul oluşturma hatası: " + schoolErr.message); setSaving(false); return; }
      schoolId = school.id;
      setRole("idareci"); // Okul kuran kişi idareci olur
    } else {
      // Mevcut okula katıl
      const { data: school } = await supabase
        .from("schools")
        .select("id")
        .eq("code", schoolCode.trim())
        .single();
      if (!school) { setError("Geçersiz okul kodu"); setSaving(false); return; }
      schoolId = school.id;
    }

    // Profili oluştur
    const { error: profileErr } = await supabase.from("profiles").insert({
      id: userId,
      school_id: schoolId,
      full_name: fullName.trim(),
      role: createNewSchool ? "idareci" : role,
      status: createNewSchool ? "active" : "pending",
    });

    if (profileErr) { setError("Profil oluşturma hatası: " + profileErr.message); setSaving(false); return; }

    router.push("/dashboard");
    router.refresh();
  }

  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <GraduationCap className="h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold">Google ile Kayıt</h1>
        <p className="text-sm text-muted-foreground">Hesabınızı tamamlamak için bilgileri doldurun</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Kaydı Tamamla</CardTitle>
          <CardDescription>Google hesabınız başarıyla doğrulandı</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullname">Ad Soyad</Label>
              <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Ad Soyad" required />
              <p className="text-xs text-muted-foreground">Google adınız otomatik geldi, düzeltebilirsiniz</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Rolünüz</Label>
              <Select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="ogretmen">Öğretmen</option>
                <option value="idareci">İdareci</option>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={createNewSchool}
                onChange={(e) => setCreateNewSchool(e.target.checked)} className="rounded" />
              Yeni okul topluluğu oluştur
            </label>

            {createNewSchool ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="schoolname">Okul Adı</Label>
                <Input id="schoolname" value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  placeholder="örn: İhsan Çelikten Ortaokulu" />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Okul Kodu</Label>
                <Input id="code" value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6 haneli okul kodu" maxLength={6} />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydı Tamamla"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
