import { createClient } from "@/lib/supabase/server";
import { ArchiveManager } from "@/components/admin/archive-manager";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function ArchivePage() {
  const supabase = await createClient();
  const { user, profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const { data: seasons } = await supabase
    .from("archive_seasons")
    .select("*, profiles(full_name)")
    .eq("school_id", profile.school_id)
    .order("archived_at", { ascending: false });

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Sezon Arşivleme</h2>
      <ArchiveManager
        schoolId={profile.school_id}
        userId={user?.id || ""}
        initialSeasons={seasons || []}
      />
    </div>
  );
}
