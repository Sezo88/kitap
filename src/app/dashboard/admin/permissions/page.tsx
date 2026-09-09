import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { TeacherPermissionsClient } from "@/components/admin/teacher-permissions-client";
import { getSchoolTeacherPermissions } from "@/lib/server/permissions";

export default async function TeacherPermissionsPage() {
  const { user, profile } = await getCachedUserAndProfile();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Bu sayfaya yalnızca okul idarecileri erişebilir.
      </div>
    );
  }

  if (!profile.school_id) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Herhangi bir okula bağlı değilsiniz.
      </div>
    );
  }

  const permissions = await getSchoolTeacherPermissions(profile.school_id);

  return (
    <div>
      <TeacherPermissionsClient
        schoolId={profile.school_id}
        initialPermissions={permissions}
      />
    </div>
  );
}
