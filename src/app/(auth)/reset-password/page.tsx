"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?error=reset_link_invalid");
      } else {
        setVerifying(false);
      }
    }
    checkSession();
  }, [router]);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Şifreler uyuşmuyor.");
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    setLoading(false);
    if (updateError) {
      setError("Şifre güncellenemedi: " + updateError.message);
    } else {
      toast("Şifreniz başarıyla güncellendi!", "success");
      router.push("/dashboard");
      router.refresh();
    }
  }

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <KeyRound className="h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold">Yeni Şifre Oluştur</h1>
        <p className="text-sm text-muted-foreground">Lütfen yeni şifrenizi girin</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Şifre Güncelle</CardTitle>
          <CardDescription>Güvenliğiniz için güçlü bir şifre seçin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Yeni Şifre</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Yeni Şifre (Tekrar)</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Şifreyi Güncelle"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
