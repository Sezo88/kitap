import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const schoolCode = searchParams.get("code")?.toUpperCase();
  const schoolIdParam = searchParams.get("school_id");

  if (!schoolCode && !schoolIdParam) {
    return NextResponse.json({ error: "Okul kodu veya ID gerekli" }, { status: 400 });
  }

  // API rotasında RLS'i bypass etmek için service_role kullanıyoruz.
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  let schoolId = schoolIdParam;

  if (schoolCode) {
    const { data: school, error: schoolErr } = await adminClient
      .from("schools")
      .select("id")
      .eq("code", schoolCode)
      .single();

    if (schoolErr || !school) {
      return NextResponse.json({ error: "Okul bulunamadı" }, { status: 404 });
    }
    schoolId = school.id;
  }

  // 1. Pano Ayarlarını ve Zil Saatlerini Al
  const [
    { data: settings },
    { data: bellSchedule }
  ] = await Promise.all([
    adminClient.from("panel_settings").select("*").eq("school_id", schoolId).single(),
    adminClient.from("bell_schedule").select("*").eq("school_id", schoolId).order("period_no")
  ]);

  const activeSlides = settings?.active_slides || ["announcements", "lessons", "top_readers", "birthdays", "duties"];
  const duration = settings?.slide_duration || 10;

  // Bugünün bilgilerini al
  const now = new Date(new Date().getTime() + 3 * 3600 * 1000);
  const todayStr = now.toISOString().split("T")[0];
  const jsDay = now.getDay();
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;
  const todayMonth = now.getMonth() + 1;
  const todayDate = now.getDate();

  const slides: any[] = [];

  // ── 1. DUYURULAR SLAYTI ──
  if (activeSlides.includes("announcements")) {
    const { data: announcements } = await adminClient
      .from("panel_announcements")
      .select("title, content")
      .eq("school_id", schoolId)
      .or(`expires_at.is.null,expires_at.gte.${todayStr}`)
      .order("created_at", { ascending: false });

    if (announcements && announcements.length > 0) {
      announcements.forEach((ann) => {
        slides.push({
          type: "announcement",
          title: ann.title,
          content: ann.content
        });
      });
    }
  }

  // ── 2. DERS PROGRAMI SLAYTI ──
  if (activeSlides.includes("lessons") && dayOfWeek <= 5 && bellSchedule && bellSchedule.length > 0) {
    const { data: lessons } = await adminClient
      .from("lesson_schedule")
      .select("period_no, classes(name), profiles(full_name), subjects(name)")
      .eq("school_id", schoolId!)
      .eq("day_of_week", dayOfWeek);

    if (lessons && lessons.length > 0) {
      // Zil saatlerine göre eşleştirip gruplayalım
      const lessonsByPeriod = lessons.reduce((acc: any, cur: any) => {
        const period = cur.period_no;
        if (!acc[period]) acc[period] = [];
        acc[period].push({
          className: cur.classes?.name || "",
          teacherName: cur.profiles?.full_name || "",
          subjectName: cur.subjects?.name || ""
        });
        return acc;
      }, {});

      // Slaytlara ekle (her zil saati için ayrı slayt da yapabiliriz veya genel)
      slides.push({
        type: "lesson_schedule",
        lessons: lessonsByPeriod,
        bellSchedule: bellSchedule.map(b => ({
          period_no: b.period_no,
          label: b.label,
          start_time: b.start_time.substring(0, 5),
          end_time: b.end_time.substring(0, 5)
        }))
      });
    }
  }

  // ── 3. EN ÇOK OKUYANLAR SLAYTI ──
  if (activeSlides.includes("top_readers")) {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [
      { data: classLogs },
      { data: bookLogs }
    ] = await Promise.all([
      adminClient.from("reading_logs").select("class_id, classes(name)").eq("did_read", true).gte("log_date", sevenDaysAgo),
      adminClient.from("student_books").select("student_id, students(full_name, classes(name))").eq("status", "completed").gte("finished_at", thirtyDaysAgo)
    ]);

    // En çok okuyan sınıf
    const classCounts: Record<string, number> = {};
    classLogs?.forEach((log: any) => {
      const name = log.classes?.name;
      if (name) classCounts[name] = (classCounts[name] || 0) + 1;
    });
    let topClass = "";
    let topClassCount = 0;
    Object.entries(classCounts).forEach(([name, count]) => {
      if (count > topClassCount) {
        topClass = name;
        topClassCount = count;
      }
    });

    // En çok okuyan öğrenci
    const studentCounts: Record<string, { name: string; className: string; count: number }> = {};
    bookLogs?.forEach((log: any) => {
      const student = log.students;
      if (student) {
        const id = log.student_id;
        if (!studentCounts[id]) {
          studentCounts[id] = { name: student.full_name, className: student.classes?.name || "", count: 0 };
        }
        studentCounts[id].count++;
      }
    });
    let topStudent = { name: "", className: "", count: 0 };
    Object.values(studentCounts).forEach((s) => {
      if (s.count > topStudent.count) {
        topStudent = s;
      }
    });

    if (topClass || topStudent.name) {
      slides.push({
        type: "top_readers",
        topClass,
        topClassCount,
        topStudent: topStudent.name ? topStudent : null
      });
    }
  }

  // ── 4. DOĞUM GÜNLERİ SLAYTI ──
  if (activeSlides.includes("birthdays")) {
    const { data: birthdayStudents } = await adminClient
      .from("students")
      .select("full_name, dogum_tarihi, classes(name)")
      .eq("school_id", schoolId!)
      .eq("is_active", true)
      .not("dogum_tarihi", "is", null);

    const birthdays = (birthdayStudents || []).filter((s: any) => {
      const d = new Date(s.dogum_tarihi);
      return d.getMonth() + 1 === todayMonth && d.getDate() === todayDate;
    });

    if (birthdays.length > 0) {
      slides.push({
        type: "birthdays",
        students: birthdays.map((s: any) => ({
          name: s.full_name,
          className: s.classes?.name || ""
        }))
      });
    }
  }

  // ── 5. NÖBETÇİ ÖĞRETMENLER SLAYTI ──
  if (activeSlides.includes("duties") && dayOfWeek <= 5) {
    const { data: duties } = await adminClient
      .from("duty_schedule")
      .select("time_slot, location, profiles(full_name)")
      .eq("school_id", schoolId!)
      .eq("day_of_week", dayOfWeek);

    if (duties && duties.length > 0) {
      slides.push({
        type: "duties",
        duties: duties.map((d: any) => ({
          timeSlot: d.time_slot,
          location: d.location || "",
          teacherName: d.profiles?.full_name || ""
        }))
      });
    }
  }

  return NextResponse.json({
    duration,
    slides: slides.length > 0 ? slides : [{ type: "welcome", title: "EduOS", content: "Dijital Pano Sistemine Hoş Geldiniz" }]
  });
}
