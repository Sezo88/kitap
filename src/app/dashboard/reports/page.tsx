import Link from "next/link";
import { BookOpen, ClipboardList, Sparkles, Trophy, ArrowRight, ChevronRight, BarChart3, Star, CheckCircle2, TrendingUp } from "lucide-react";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function ReportsPortalPage() {
  const { profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci" && profile.role !== "ogretmen")) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="p-4 rounded-2xl bg-destructive/10 text-destructive mb-3">
          <ClipboardList className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold">Erişim Yetkiniz Bulunmuyor</h3>
        <p className="text-sm text-muted-foreground mt-1">Bu sayfayı görüntülemek için idareci veya öğretmen yetkisi gereklidir.</p>
      </div>
    );
  }

  const schoolData = (profile as any)?.schools;
  const school = Array.isArray(schoolData) ? schoolData[0] : schoolData;

  const showLibrary = school?.feature_library !== false;
  const showAttendance = school?.feature_attendance !== false;
  const showCleanliness = school?.feature_cleanliness !== false;
  const showQuiz = true; // Günün sorusu & lig yarışması

  const reports = [
    {
      id: "quiz",
      title: "Günün Sorusu & Bilgi Yarışması Ligi",
      subtitle: "Akıllı Tahta Yarışma Raporları",
      description: "Sınıflar arası lig sıralaması, kazanılan puanlar, soru bazlı doğru/yanlış dağılımları ve hız istatistikleri.",
      href: "/dashboard/reports/quiz",
      icon: Trophy,
      badgeText: "Canlı Lig Tablosu",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      accentGradient: "from-amber-500/10 via-yellow-500/5 to-transparent",
      iconBg: "bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-amber-500/25",
      tags: ["Lig Sıralaması", "Günlük Yanıtlar", "Hız Bonusu", "Sınıf Karnesi"],
      show: showQuiz,
    },
    {
      id: "cleanliness",
      title: "Temiz Sınıf & Düzen Raporları",
      subtitle: "Haftalık Temizlik Değerlendirmesi",
      description: "Sınıfların haftalık temizlik puan sıralamaları, haftanın birincileri, günlük puan kırılımları ve dönem liderleri.",
      href: "/dashboard/reports/cleanliness",
      icon: Sparkles,
      badgeText: "Haftanın Birincileri",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      accentGradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
      iconBg: "bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/25",
      tags: ["Haftalık Puanlar", "Kriter Kırılımı", "Dönem Arşivi", "Sıralama"],
      show: showCleanliness,
    },
    {
      id: "reading",
      title: "Okuma & Kitap Takip Raporları",
      subtitle: "Kütüphane ve Okuma Analizleri",
      description: "Öğrencilerin okuma oranları, tamamlanan kitap süreleri, sınıf bazlı okuma grafikleri ve en çok okuyanlar listesi.",
      href: "/dashboard/reports/reading",
      icon: BookOpen,
      badgeText: "Okuma Oranları",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      accentGradient: "from-blue-500/10 via-indigo-500/5 to-transparent",
      iconBg: "bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-blue-500/25",
      tags: ["Öğrenci Karnesi", "Sınıf Ortalaması", "Kitap Sayıları", "Excel / PDF"],
      show: showLibrary,
    },
    {
      id: "attendance",
      title: "Yoklama & Devamsızlık Raporları",
      subtitle: "Günlük ve Dönemlik Devamsızlık",
      description: "Günlük gelmeyen/geç kalan öğrenciler, veli iletişim durumları, kronik devamsızlıklar ve SMS bildirim raporları.",
      href: "/dashboard/reports/attendance",
      icon: ClipboardList,
      badgeText: "Günlük Takip & SMS",
      badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      accentGradient: "from-rose-500/10 via-red-500/5 to-transparent",
      iconBg: "bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-rose-500/25",
      tags: ["Günlük Yoklama", "Veli Bildirimi", "SMS Maliyeti", "Sınıf Özeti"],
      show: showAttendance,
    },
  ].filter((r) => r.show || profile.role === "super_admin");

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── UST BASLIK ALANI ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Yönetim & Performans
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Raporlar & Analiz Portalı
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Okulunuzun tüm modüllerine ait detaylı istatistikleri ve sınıf sıralamalarını inceleyin.
          </p>
        </div>
      </div>

      {/* ── BUYUK TIKLANABILIR KARTLAR (MOBIL ODAKLI) ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link
              key={report.id}
              href={report.href}
              className="group relative flex flex-col justify-between p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-card hover:bg-card/90 border border-border/70 hover:border-primary/50 shadow-sm hover:shadow-xl transition-all duration-300 active:scale-[0.99] touch-manipulation overflow-hidden"
            >
              {/* Arka Plan Yumusak Renk Isiltisi */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${report.accentGradient} opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none`}
              />

              {/* Kart Ust Kisim: Ikon + Rozet */}
              <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3.5">
                  <div className={`p-3 sm:p-3.5 rounded-2xl ${report.iconBg} shadow-md group-hover:scale-105 transition-transform shrink-0`}>
                    <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground block uppercase tracking-wider">
                      {report.subtitle}
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                      {report.title}
                    </h2>
                  </div>
                </div>

                <span className={`hidden xs:inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${report.badgeColor}`}>
                  {report.badgeText}
                </span>
              </div>

              {/* Kart Orta Kisim: Aciklama */}
              <div className="relative z-10 my-1">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {report.description}
                </p>
              </div>

              {/* Kart Alt Kisim: Etiketler & Eyleme Cagri Butonu */}
              <div className="relative z-10 pt-4 mt-3 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Ozellik Etiketleri */}
                <div className="flex flex-wrap gap-1.5">
                  {report.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border/40"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Buton Tarzi Isaretci */}
                <div className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground font-bold text-xs transition-colors shrink-0 self-end sm:self-auto shadow-sm">
                  <span>Raporu Aç</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
