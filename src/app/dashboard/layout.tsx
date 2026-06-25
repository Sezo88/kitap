import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

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

  // Get school name for active users
  const { data: school } = profile?.school_id
    ? await supabase.from("schools").select("name, code").eq("id", profile.school_id).single()
    : { data: null };

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
