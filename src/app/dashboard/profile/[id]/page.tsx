import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, CalendarCheck, TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";

function getAcademicYear(dateStrOrObj: string | Date | null): string {
  if (!dateStrOrObj) return "Bilinmeyen";
  const date = new Date(dateStrOrObj);
  if (isNaN(date.getTime())) return "Bilinmeyen";
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 11 = Dec
  if (month >= 8) { // September to December
    return `${year}-${year + 1}`;
  } else { // January to August
    return `${year - 1}-${year}`;
  }
}

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { year: selectedYearParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  if (!profile) return null;

  let studentId = id;
  if (id === "me") {
    // Redirect to own profile doesn't make sense for students; teachers don't have tracking
    // Just show the first student from their class
    const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", user!.id).limit(1);
    if (tc?.[0]) {
      const { data: firstStudent } = await supabase.from("students").select("id").eq("class_id", tc[0].class_id).limit(1).single();
      if (firstStudent) studentId = firstStudent.id;
    }
  }

  const { data: student } = await supabase
    .from("students")
    .select("*, classes(name)")
    .eq("id", studentId)
    .single();

  if (!student) notFound();

  // Reading history
  const { data: readingLogs } = await supabase
    .from("reading_logs")
    .select("*")
    .eq("student_id", studentId)
    .order("log_date", { ascending: false })
    .limit(1000);

  // Books read
  const { data: studentBooks } = await supabase
    .from("student_books")
    .select("*, books(title, author)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(500);

  const currentAcademicYear = getAcademicYear(new Date());

  // Collect all unique academic years from logs and books
  const yearsSet = new Set<string>([currentAcademicYear]);

  readingLogs?.forEach((log) => {
    yearsSet.add(getAcademicYear(log.log_date));
  });

  studentBooks?.forEach((sb) => {
    yearsSet.add(getAcademicYear(sb.started_at || sb.created_at));
  });

  const availableYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));

  const selectedYear = (typeof selectedYearParam === "string" && yearsSet.has(selectedYearParam))
    ? selectedYearParam
    : currentAcademicYear;

  const filteredLogs = readingLogs?.filter((log) => getAcademicYear(log.log_date) === selectedYear) || [];
  const filteredStudentBooks = studentBooks?.filter((sb) => getAcademicYear(sb.started_at || sb.created_at) === selectedYear) || [];

  const totalDays = filteredLogs.length;
  const readDays = filteredLogs.filter((l) => l.did_read).length;
  const broughtDays = filteredLogs.filter((l) => l.brought_book).length;
  const readRate = totalDays > 0 ? Math.round((readDays / totalDays) * 100) : 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold">Öğrenci Profili</h2>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Eğitim Yılı:</span>
          <div className="flex gap-1 bg-muted p-1 rounded-lg border">
            {availableYears.map((yr) => (
              <a
                key={yr}
                href={`?year=${yr}`}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  selectedYear === yr
                    ? "bg-background text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                {yr} {yr === currentAcademicYear ? "• Aktif" : ""}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Student Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> {student.full_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm text-muted-foreground">Sınıf: </span>
              <Badge variant="outline">{student.classes?.name}</Badge>
            </div>
            {student.e_okul_no && (
              <div>
                <span className="text-sm text-muted-foreground">e-Okul No: </span>
                <span className="text-sm">{student.e_okul_no}</span>
              </div>
            )}
            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Toplam Takip Günü</span>
                <span className="font-semibold">{totalDays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Kitap Getirdiği Gün</span>
                <span className="font-semibold">{broughtDays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Okuduğu Gün</span>
                <span className="font-semibold">{readDays}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-medium">Okuma Oranı</span>
                <span className="font-bold text-primary">%{readRate}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reading History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" /> Okuma Takip Geçmişi ({selectedYear})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-center">Kitap Getirdi</TableHead>
                  <TableHead className="text-center">Okudu</TableHead>
                  <TableHead>Not</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!filteredLogs || filteredLogs.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Seçilen eğitim yılı için okuma kaydı bulunamadı
                    </TableCell>
                  </TableRow>
                )}
                {filteredLogs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.log_date).toLocaleDateString("tr-TR")}</TableCell>
                    <TableCell className="text-center">
                      {log.brought_book ? (
                        <Badge variant="success">✓ Getirdi</Badge>
                      ) : (
                        <Badge variant="destructive">✗ Getirmedi</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {log.did_read ? (
                        <Badge variant="success">✓ Okudu</Badge>
                      ) : (
                        <Badge variant="destructive">✗ Okumadı</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{log.note || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Books Read */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Okuduğu Kitaplar ({selectedYear})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kitap</TableHead>
                  <TableHead>Yazar</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Başlangıç</TableHead>
                  <TableHead>Bitiş</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!filteredStudentBooks || filteredStudentBooks.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Seçilen eğitim yılı için okunan kitap bulunamadı
                    </TableCell>
                  </TableRow>
                )}
                {filteredStudentBooks?.map((sb) => (
                  <TableRow key={sb.id}>
                    <TableCell className="font-medium">{sb.books?.title || "-"}</TableCell>
                    <TableCell>{sb.books?.author || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={sb.status === "active" ? "success" : sb.status === "completed" ? "secondary" : "outline"}>
                        {sb.status === "active" ? "Aktif" : sb.status === "completed" ? "Tamamlandı" : "Bırakıldı"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(sb.started_at).toLocaleDateString("tr-TR")}</TableCell>
                    <TableCell>{sb.finished_at ? new Date(sb.finished_at).toLocaleDateString("tr-TR") : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
