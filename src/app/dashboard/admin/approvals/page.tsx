import { createClient } from "@/lib/supabase/server";
import { PendingApprovals } from "@/components/admin/pending-approvals";

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  if (!profile.school_id) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-2">Henüz bir okula bağlı değilsiniz.</p>
      </div>
    );
  }

  const { data: pendingUsers } = await supabase
    .from("profiles")
    .select("*")
    .eq("school_id", profile.school_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Bekleyen Onaylar</h2>
      <PendingApprovals
        pendingUsers={pendingUsers || []}
        schoolId={profile.school_id}
      />
    </div>
  );
}
