import { PDFImportClient } from "@/components/students/pdf-import-client";
import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { redirect } from "next/navigation";

export default async function ImportPDFPage() {
  const { user, profile } = await getCachedUserAndProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();
  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };
  const { data: existingClasses } = await supabase
    .from("classes")
    .select("*")
    .match(schoolFilter)
    .order("name");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">PDF ile Öğrenci İçe Aktar</h2>
      <PDFImportClient
        schoolId={profile.school_id || ""}
        existingClasses={existingClasses || []}
      />
    </div>
  );
}
