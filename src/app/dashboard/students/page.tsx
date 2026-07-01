import { createClient } from "@/lib/supabase/server";
import { StudentList } from "@/components/students/student-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export default async function StudentsPage() {
  const supabase = await createClient();
  const { user, profile } = await getCachedUserAndProfile();

  if (!profile) return null;

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };

  // Build teacher classes filter if necessary
  let teacherClassIds: string[] | null = null;
  if (profile.role === "ogretmen") {
    const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", user!.id);
    teacherClassIds = tc?.map((t) => t.class_id) || [];
  }

  // Build student query
  let studentsQuery = supabase
    .from("students")
    .select("*, classes!inner(name)")
    .match(schoolFilter)
    .eq("is_active", true)
    .order("full_name");

  if (profile.role === "ogretmen" && teacherClassIds) {
    if (teacherClassIds.length > 0) {
      studentsQuery = studentsQuery.in("class_id", teacherClassIds);
    } else {
      studentsQuery = studentsQuery.eq("class_id", "00000000-0000-0000-0000-000000000000");
    }
  }

  // Parallelize student query, classes list, and books list
  const [
    { data: studentsData },
    { data: classes },
    { data: books }
  ] = await Promise.all([
    studentsQuery,
    supabase.from("classes").select("*").match(schoolFilter).order("name"),
    supabase.from("books").select("id, title").match(schoolFilter).order("title")
  ]);

  const studentIds = studentsData?.map((s) => s.id) || [];
  let activeBooks: any[] = [];
  if (studentIds.length > 0) {
    const { data } = await supabase
      .from("student_books")
      .select("student_id, books(title)")
      .eq("status", "active")
      .in("student_id", studentIds);
    activeBooks = data || [];
  }

  const students = studentsData?.map((s) => {
    const activeBook = activeBooks.find((ab) => ab.student_id === s.id);
    return {
      ...s,
      active_book_title: activeBook ? (Array.isArray(activeBook.books) ? activeBook.books[0]?.title : activeBook.books?.title) || null : null
    };
  }) || [];

  const canEdit = profile?.role === "super_admin" || profile?.role === "idareci" || profile?.role === "ogretmen";
  const canImport = profile?.role === "super_admin" || profile?.role === "idareci";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Öğrenciler</h2>
        {canImport && (
          <div className="flex gap-2">
            <Link href="/dashboard/students/import-pdf">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-1" /> PDF İçe Aktar
              </Button>
            </Link>
            <Link href="/dashboard/students/import">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1" /> Excel İçe Aktar
              </Button>
            </Link>
          </div>
        )}
      </div>
      <StudentList
        students={students || []}
        classes={classes || []}
        books={books || []}
        role={profile?.role || "ogretmen"}
        schoolId={profile?.school_id || ""}
        canEdit={canEdit}
      />
    </div>
  );
}
