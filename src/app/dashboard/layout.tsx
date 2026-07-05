import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { user, profile } = await getCachedUserAndProfile();

  if (!user) {
    redirect("/login");
  }

  // Profil eksikse kaydı tamamlama sayfasına yönlendir (super_admin hariç)
  const isIncomplete = !profile || 
                       !profile.full_name || 
                       profile.full_name === "Yeni Kullanıcı" || 
                       (profile.role !== "super_admin" && !profile.school_id);

  if (isIncomplete) {
    redirect("/complete-registration");
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

  // Get pending approvals count
  let pendingApprovalsCount = 0;
  if (profile?.role === "idareci" && profile.school_id) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("school_id", profile.school_id)
      .eq("status", "pending");
    pendingApprovalsCount = count || 0;
  } else if (profile?.role === "super_admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingApprovalsCount = count || 0;
  }

  return (
    <DashboardLayoutClient
      role={profile?.role || "ogretmen"}
      fullName={profile?.full_name}
      schoolName={school?.name || null}
      schoolFeatures={schoolFeatures}
      pendingApprovalsCount={pendingApprovalsCount}
    >
      {children}
    </DashboardLayoutClient>
  );
}

