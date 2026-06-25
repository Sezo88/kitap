import { createClient } from "@/lib/supabase/server";
import { StudentList } from "@/components/students/student-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  const schoolFilter = profile?.role === "super_admin" ? {} : { school_id: profile?.school_id };

  // Build query based on role
  let studentsQuery = supabase
    .from("students")
    .select("*, classes!inner(name)")
    .match(schoolFilter)
    .eq("is_active", true)
    .order("full_name");

  // If teacher, only show students from assigned classes
  if (profile?.role === "ogretmen") {
    const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", user!.id);
    const classIds = tc?.map((t) => t.class_id) || [];
    if (classIds.length > 0) {
      studentsQuery = studentsQuery.in("class_id", classIds);
    } else {
      studentsQuery = studentsQuery.eq("class_id", "00000000-0000-0000-0000-000000000000"); // no results
    }
  }

  const { data: studentsData } = await studentsQuery;
  const { data: classes } = await supabase.from("classes").select("*").match(schoolFilter).order("name");
  const { data: books } = await supabase.from("books").select("id, title").match(schoolFilter).order("title");

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
