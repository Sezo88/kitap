"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetEmail, setResetEmail] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Giriş başarısız: " + error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);

    // Capacitor ortamında mıyız?
    const isCapacitor =
      typeof window !== "undefined" && "Capacitor" in window;

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: isCapacitor
          ? `${window.location.origin}/callback?next=/dashboard&mobile=1`
          : `${window.location.origin}/callback?next=/dashboard`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setError("Google giriş hatası: " + error.message);
      setLoading(false);
      return;
    }

    // Capacitor'da: Chrome Custom Tabs ile aç (kullanıcının Google oturumu tarayıcıda hazır)
    if (isCapacitor && data?.url) {
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: data.url });
        // Tarayıcı açıldı — kullanıcı Google'da giriş yapacak,
        // callback route'u deep link ile uygulamaya geri dönecek
      } catch {
        // Browser plugin yüklenemezse normal akışa bırak
      }
    }
    // loading state kapanmaz — sayfa deep link ile yeniden yüklenecek
  }

  async function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) { setError("Lütfen e-posta adresinizi girin"); return; }
    setError(""); setSuccess("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) setError("Hata: " + error.message);
    else {
      setResetSent(true);
      setSuccess("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
    }
  }

  if (resetSent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle className="text-center">E-postanızı Kontrol Edin</CardTitle></CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">{success}</p>
          <Button variant="outline" className="w-full" onClick={() => { setResetSent(false); setMode("login"); }}>
            Girişe Dön
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "forgot") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Şifremi Sıfırla</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground text-center">
              Şifre sıfırlama bağlantısı almak için e-posta adresinizi girin.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-email">E-posta</Label>
              <Input id="reset-email" type="email" placeholder="ornek@okul.com"
                value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sıfırlama Bağlantısı Gönder"}
            </Button>
            <div className="text-center text-xs mt-2">
              <button type="button" onClick={() => { setMode("login"); setError(""); }}
                className="text-primary hover:underline">Giriş Yap Sayfasına Dön</button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-center">Giriş Yap</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" type="email" placeholder="ornek@okul.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Şifre</Label>
            <Input id="password" type="password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Giriş Yap"}
          </Button>

          <div className="flex items-center gap-2 text-xs">
            <button type="button" onClick={() => { setMode("forgot"); setError(""); }}
              className="text-primary hover:underline">Şifremi Unuttum</button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">veya</span>
            </div>
          </div>

          <Button type="button" variant="outline" onClick={handleGoogleLogin} disabled={loading} className="w-full">
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google ile Giriş Yap
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
