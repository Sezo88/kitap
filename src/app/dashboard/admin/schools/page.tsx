import { createClient } from "@/lib/supabase/server";
import { SchoolsClient } from "./schools-client";

export default async function SchoolsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  if (!profile || profile.role !== "super_admin") {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok. (Sadece Süper Admin)</div>;
  }

  // Tüm okulları çek
  const { data: schools } = await supabase
    .from("schools")
    .select("*")
    .order("name");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Okul Lisansları</h2>
      <SchoolsClient initialSchools={schools || []} />
    </div>
  );
}
