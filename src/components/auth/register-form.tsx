"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { Loader2, Building, Users } from "lucide-react";
import type { Role } from "@/lib/types/database";

export function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("ogretmen");
  const [schoolAction, setSchoolAction] = useState<"create" | "join">("join");
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const supabase = createClient();

    // Validate
    if (role === "idareci" && schoolAction === "create") {
      if (!schoolName.trim()) {
        setError("Okul adı zorunludur");
        setLoading(false);
        return;
      }
      if (!schoolCode.trim()) {
        setError("Okul kodu zorunludur");
        setLoading(false);
        return;
      }
    }
    if ((role === "ogretmen") || (role === "idareci" && schoolAction === "join")) {
      if (!schoolCode.trim()) {
        setError("Okul kodu zorunludur");
        setLoading(false);
        return;
      }
    }

    // Build metadata for DB trigger
    const metadata: Record<string, string> = {
      full_name: fullName,
      role: role,
    };

    if (role === "idareci" && schoolAction === "create") {
      metadata.school_action = "create";
      metadata.school_name = schoolName.trim();
      metadata.school_code = schoolCode.trim().toUpperCase();
    } else {
      metadata.school_code = schoolCode.trim().toUpperCase();
    }

    const { error: signUpError, data } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });

    if (signUpError) {
      // Check if it's our custom error from the trigger
      if (signUpError.message.includes("Geçersiz okul kodu")) {
        setError("Bu okul kodu geçersiz. Lütfen kontrol edin.");
      } else {
        setError("Kayıt başarısız: " + signUpError.message);
      }
      setLoading(false);
      return;
    }

    // Determine success message
    if (role === "idareci" && schoolAction === "create") {
      setSuccess("Okulunuz oluşturuldu! Giriş yapabilirsiniz.");
    } else if (role === "idareci" && schoolAction === "join") {
      setSuccess("Kaydınız alındı. Okul idarecisi onaylayınca giriş yapabileceksiniz.");
    } else {
      setSuccess("Kaydınız alındı. İdareci onaylayınca giriş yapabileceksiniz.");
    }

    setLoading(false);

    // If creating school (active user), redirect to dashboard
    if (role === "idareci" && schoolAction === "create") {
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1500);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Kayıt Ol</CardTitle>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="text-center py-4">
            <div className="text-green-600 text-lg font-semibold mb-2">✓</div>
            <p className="text-sm">{success}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Ad Soyad */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Ad Soyad</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            {/* E-posta */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            {/* Şifre */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Şifre</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>

            {/* Rol */}
            <div className="flex flex-col gap-1.5">
              <Label>Rol</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("ogretmen")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                    role === "ogretmen"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">Öğretmen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("idareci")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                    role === "idareci"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  <Building className="h-4 w-4" />
                  <span className="text-sm font-medium">İdareci</span>
                </button>
              </div>
            </div>

            {/* İdareci: Yeni okul mu, mevcut okula katılım mı? */}
            {role === "idareci" && (
              <div className="flex flex-col gap-1.5">
                <Label>Okul</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSchoolAction("create")}
                    className={`p-3 rounded-lg border-2 text-sm transition-colors cursor-pointer ${
                      schoolAction === "create"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-input hover:border-primary/50"
                    }`}
                  >
                    <div className="font-medium">Yeni Okul Oluştur</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Okul kodu otomatik oluşur</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchoolAction("join")}
                    className={`p-3 rounded-lg border-2 text-sm transition-colors cursor-pointer ${
                      schoolAction === "join"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-input hover:border-primary/50"
                    }`}
                  >
                    <div className="font-medium">Mevcut Okula Katıl</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Okul kodu ile</div>
                  </button>
                </div>
              </div>
            )}

            {/* Okul Adı + Kodu (yeni okul) */}
            {role === "idareci" && schoolAction === "create" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="schoolName">Okul Adı</Label>
                  <Input
                    id="schoolName"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="örn. İhsan Çelikten Ortaokulu"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="schoolCode">Okul Kodu</Label>
                  <Input
                    id="schoolCode"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                    placeholder="örn. 737454"
                    className="text-center text-lg tracking-widest font-mono"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Okulunuzun mevcut 6 haneli kodunu girin
                  </p>
                </div>
              </>
            )}

            {/* Okul Kodu (mevcut okula katılım veya öğretmen) */}
            {(role === "ogretmen" || (role === "idareci" && schoolAction === "join")) && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schoolCode">Okul Kodu</Label>
                <Input
                  id="schoolCode"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                  placeholder="örn. A1B2C3"
                  className="text-center text-lg tracking-widest font-mono"
                  maxLength={6}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {role === "ogretmen"
                    ? "İdarecinizden aldığınız 6 haneli okul kodunu girin"
                    : "Katılmak istediğiniz okulun 6 haneli kodunu girin"}
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Kaydediliyor..." : "Kayıt Ol"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
