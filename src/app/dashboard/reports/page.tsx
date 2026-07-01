import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ClipboardList, ArrowRight, Sparkles } from "lucide-react";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function ReportsPortalPage() {
  const { profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci" && profile.role !== "ogretmen")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const reports = [
    {
      title: "Okuma & Kitap Raporları",
      description: "Öğrencilerin okuma oranları, tamamlanan kitap süreleri, sınıf sıralamaları ve en çok/en az okuyan öğrenci listeleri.",
      href: "/dashboard/reports/reading",
      icon: BookOpen,
      color: "text-blue-600 bg-blue-100",
    },
    {
      title: "Yoklama & Devamsızlık Raporları",
      description: "Günlük gelmeyen veya geç kalan öğrenciler, veli iletişim bilgileri, tekrarlayan devamsızlıklar ve SMS bildirim maliyet özetleri.",
      href: "/dashboard/reports/attendance",
      icon: ClipboardList,
      color: "text-red-600 bg-red-100",
    },
    {
      title: "Temiz Sınıf Raporları",
      description: "Sınıfların haftalık temizlik puan sıralamaları, haftanın birincileri, günlük puan kırılımları ve aylık/yıllık liderlik tabloları.",
      href: "/dashboard/reports/cleanliness",
      icon: Sparkles,
      color: "text-amber-600 bg-amber-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold">Raporlar Portalı</h2>
        <p className="text-sm text-muted-foreground mt-1">Okulunuza ait analiz ve rapor gruplarını seçin.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.title} className="hover:shadow-md transition-shadow flex flex-col justify-between">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${report.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                </div>
                <CardDescription className="mt-3 text-sm leading-relaxed">
                  {report.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href={report.href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  Raporu Görüntüle <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
