import { PDFImportClient } from "@/components/students/pdf-import-client";
import { createClient } from "@/lib/supabase/server";

export default async function ImportPDFPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  const schoolFilter = profile?.role === "super_admin" ? {} : { school_id: profile?.school_id };
  const { data: existingClasses } = await supabase.from("classes").select("*").match(schoolFilter).order("name");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">PDF ile Öğrenci İçe Aktar</h2>
      <PDFImportClient
        schoolId={profile?.school_id || ""}
        existingClasses={existingClasses || []}
      />
    </div>
  );
}
