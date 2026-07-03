import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCachedUserAndProfile();

  if (!user) {
    redirect("/login");
  }

  // If pending, show waiting page (no sidebar)
  if (profile?.status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold mb-2">Onay Bekleniyor</h1>
          <p className="text-muted-foreground mb-4">
            Hesabınız okul idarecisinin onayını bekliyor. Onaylandıktan sonra giriş yapabileceksiniz.
          </p>
          <form action={async () => {
            "use server";
            const supabase2 = await createClient();
            await supabase2.auth.signOut();
            redirect("/login");
          }}>
            <button type="submit" className="text-sm text-primary hover:underline cursor-pointer">
              Çıkış yap
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Get school details from joined relation (already fetched in getCachedUserAndProfile)
  const schoolData = (profile as any)?.schools;
  const school = Array.isArray(schoolData) ? schoolData[0] : schoolData;

  const isLicenseExpired = school?.license_expires_at && new Date(school.license_expires_at).getTime() < Date.now();

  const schoolFeatures = {
    feature_attendance: school?.feature_attendance !== false,
    feature_library: school?.feature_library !== false,
    feature_cleanliness: school?.feature_cleanliness !== false,
    feature_lesson_schedule: school?.feature_lesson_schedule !== false,
    feature_bell: school?.feature_bell !== false,
  };

  const activeFeatures = (isLicenseExpired && profile?.role !== "super_admin") ? {
    feature_attendance: false,
    feature_library: false,
    feature_cleanliness: false,
    feature_lesson_schedule: false,
    feature_bell: false,
  } : schoolFeatures;

  return (
    <DashboardLayoutClient
      role={profile?.role || "ogretmen"}
      fullName={profile?.full_name}
      schoolName={school?.name || null}
      schoolFeatures={activeFeatures}
    >
      {(isLicenseExpired && profile?.role !== "super_admin") ? (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-6 sm:p-8 max-w-lg text-center shadow-lg space-y-4">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl sm:text-2xl font-bold text-red-700">Okul Lisans Süresi Dolmuştur</h1>
            <p className="text-sm text-red-600 leading-relaxed">
              Okulunuzun sistem kullanım lisansı sonlanmıştır. Özellikleri tekrar aktif edebilmek için lütfen sistem yöneticiniz <strong>Sezai KAYA</strong> ile iletişime geçiniz.
            </p>
          </div>
        </div>
      ) : children}
    </DashboardLayoutClient>
  );
}

