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

  return (
    <DashboardLayoutClient
      role={profile?.role || "ogretmen"}
      fullName={profile?.full_name}
      schoolName={school?.name || null}
    >
      {children}
    </DashboardLayoutClient>
  );
}

