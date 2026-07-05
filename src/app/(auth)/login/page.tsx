import { LoginForm } from "@/components/auth/login-form";
import { GraduationCap, Bell, BookOpen, UserCheck, Tv } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-12 bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sol Panel: Tanıtım & Özellikler */}
      <div className="hidden lg:flex lg:col-span-7 relative flex-col justify-between p-12 bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 border-r border-slate-800/50">
        {/* Dekoratif Işıklar */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10" />

        {/* Logo / Başlık */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/20 rounded-xl border border-primary/30 shadow-lg shadow-primary/10">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-pink-500">EduOS</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Eğitim Yönetim İşletim Sistemi</p>
          </div>
        </div>

        {/* Özellik Listesi */}
        <div className="my-auto space-y-8 max-w-lg">
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight">Okulunuz İçin Tüm Özellikler Tek Bir Yerde.</h2>
            <p className="text-slate-400 text-sm">Sadece bir kitap takip uygulaması değil; dijital zil, akıllı pano, öğrenci yoklama ve sınıf içi tüm süreçlerinizi yöneten kapsamlı eğitim işletim sistemi.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800/40 hover:border-slate-700/60 transition-colors">
              <div className="p-2 h-10 w-10 shrink-0 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/20">
                <Tv className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Akıllı Pano (PanoOS)</h4>
                <p className="text-xs text-slate-400 mt-1">Sıralamalar, günün sorusu ve duyurular dijital panoda.</p>
              </div>
            </div>

            <div className="flex gap-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800/40 hover:border-slate-700/60 transition-colors">
              <div className="p-2 h-10 w-10 shrink-0 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center border border-amber-500/20">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Uzaktan Zil Kontrolü</h4>
                <p className="text-xs text-slate-400 mt-1">Zil planları, tören müzikleri ve anonslar tek tıkla uzaktan.</p>
              </div>
            </div>

            <div className="flex gap-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800/40 hover:border-slate-700/60 transition-colors">
              <div className="p-2 h-10 w-10 shrink-0 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center border border-emerald-500/20">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Kitap & Kütüphane</h4>
                <p className="text-xs text-slate-400 mt-1">Öğrenci okuma gelişimleri, kitap teslimatları ve analizler.</p>
              </div>
            </div>

            <div className="flex gap-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800/40 hover:border-slate-700/60 transition-colors">
              <div className="p-2 h-10 w-10 shrink-0 bg-rose-500/10 text-rose-400 rounded-lg flex items-center justify-center border border-rose-500/20">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Akıllı Yoklama</h4>
                <p className="text-xs text-slate-400 mt-1">Hızlı sınıf yoklaması ve velilere anlık otomatik SMS bildirimi.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-500">
          <span>© {new Date().getFullYear()} EduOS. Tüm hakları saklıdır.</span>
        </div>
      </div>

      {/* Sağ Panel: Giriş Formu */}
      <div className="lg:col-span-5 flex flex-col justify-center items-center p-8 lg:p-12 bg-slate-950 relative">
        {/* Mobil Logo Görünümü */}
        <div className="lg:hidden flex flex-col items-center gap-2 mb-8 text-center">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
            <GraduationCap className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">EduOS</h1>
          <p className="text-xs text-slate-400 max-w-xs">Kitap okuma, yoklama, akıllı pano ve uzaktan zil yönetim sistemi</p>
        </div>

        <div className="w-full max-w-sm">
          <LoginForm />
          
          <p className="mt-6 text-center text-xs text-slate-400">
            Hesabınız yok mu?{" "}
            <Link href="/register" className="text-primary hover:underline font-semibold">
              Kayıt olun
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
