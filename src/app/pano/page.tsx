"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Tipler ──────────────────────────────────────────────────
interface BellPeriod {
  period_no: number;
  start_time: string;
  end_time: string;
  label: string;
}

interface LessonRow {
  day_of_week: number;
  period_no: number;
  subject_name?: string;
  teacher_name?: string;
  class_name?: string;
}

interface DutyRow {
  day_of_week: number;
  teacher_name?: string;
  location?: string;
  time_slot?: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  category: string;
  priority: number;
}

interface GalleryItem {
  id: string;
  cloudinary_url: string;
  caption: string | null;
}

interface PanoConfig {
  theme: string;
  school_logo_url: string | null;
  school_motto: string | null;
  slide_interval: number;
  show_clock: boolean;
  show_top_readers: boolean;
  show_top_class: boolean;
}

interface TopReader {
  student_name: string;
  class_name: string;
  book_count: number;
}

// ── Sabitler ────────────────────────────────────────────────
const STORAGE_KEY = "pano_auth";

export default function PanoPage() {
  // Auth state
  const [pin, setPin] = useState("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  // Data state
  const [config, setConfig] = useState<PanoConfig>({ theme: "blue", school_logo_url: null, school_motto: null, slide_interval: 10, show_clock: true, show_top_readers: true, show_top_class: true });
  const [bellSchedule, setBellSchedule] = useState<BellPeriod[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [duties, setDuties] = useState<DutyRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [topReaders, setTopReaders] = useState<TopReader[]>([]);
  const [topClass, setTopClass] = useState<{ class_name: string; avg_rate: number } | null>(null);
  const [birthdays, setBirthdays] = useState<{ full_name: string; class_name: string; dogum_tarihi: string }[]>([]);
  const [dailyQuiz, setDailyQuiz] = useState<any>(null);
  const [yesterdayQuiz, setYesterdayQuiz] = useState<any>(null);

  // UI state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [periodStatus, setPeriodStatus] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const slideTimer = useRef<NodeJS.Timeout | null>(null);
  const galleryTimer = useRef<NodeJS.Timeout | null>(null);
  const clockTimer = useRef<NodeJS.Timeout | null>(null);

  // ── PIN Auth ──────────────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.expires > Date.now()) {
          setSchoolId(data.schoolId);
          setSchoolName(data.schoolName);
          setAuthenticated(true);
          return;
        }
      } catch {}
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) return;
    setPinLoading(true);
    setPinError("");

    const supabase = createClient();
    const { data: school } = await supabase
      .from("schools")
      .select("id, name, pano_pin")
      .eq("pano_pin", pin.trim())
      .maybeSingle();

    if (school) {
      setSchoolId(school.id);
      setSchoolName(school.name);
      setAuthenticated(true);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        schoolId: school.id,
        schoolName: school.name,
        expires: Date.now() + 24 * 60 * 60 * 1000,
      }));
    } else {
      setPinError("Gecersiz PIN kodu!");
    }
    setPinLoading(false);
  }

  // ── Data Fetch ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    const supabase = createClient();

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=pazar, 1=pzt...
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setPeriodStatus("Hafta sonu - Iyi tatiller!");
    }

    const [
      configData,
      bellData,
      lessonData,
      dutyData,
      annData,
      galleryData,
      birthdaysData,
      readersData,
      dailyQuizRes,
      yesterdayQuizRes
    ] = await Promise.all([
      supabase.from("panel_config").select("*").eq("school_id", schoolId).maybeSingle(),
      supabase.from("bell_schedule").select("*").eq("school_id", schoolId).order("period_no"),
      supabase.from("lesson_schedule").select("day_of_week, period_no, subjects(name), profiles!lesson_schedule_teacher_id_fkey(full_name), classes(name)").eq("classes.school_id", schoolId).eq("day_of_week", dayOfWeek).order("period_no"),
      supabase.from("duty_schedule").select("day_of_week, teacher_id, location, time_slot, profiles!duty_schedule_teacher_id_fkey(full_name)").eq("school_id", schoolId).eq("day_of_week", dayOfWeek),
      supabase.from("panel_announcements").select("*").eq("school_id", schoolId).eq("is_active", true).order("priority", { ascending: false }).order("display_order"),
      supabase.from("panel_gallery").select("*").eq("school_id", schoolId).eq("is_active", true).order("display_order"),
      supabase.from("students").select("full_name, class_id, dogum_tarihi, classes(name)").eq("school_id", schoolId).eq("is_active", true).not("dogum_tarihi", "is", null),
      supabase.from("student_books").select("students!inner(full_name, class_id, classes!inner(name))").eq("status", "completed"),
      supabase.from("quiz_daily").select("id, quiz_questions(question, answer)").eq("school_id", schoolId).eq("question_date", today.toISOString().split("T")[0]).maybeSingle(),
      supabase.from("quiz_daily").select("id, question_date, quiz_questions(question, answer)").eq("school_id", schoolId).lt("question_date", today.toISOString().split("T")[0]).order("question_date", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (configData.data) setConfig(configData.data as PanoConfig);
    if (bellData.data) setBellSchedule(bellData.data as BellPeriod[]);

    // Lessons
    if (lessonData.data) {
      setLessons((lessonData.data as any[]).map((l) => ({
        day_of_week: l.day_of_week,
        period_no: l.period_no,
        subject_name: Array.isArray(l.subjects) ? l.subjects[0]?.name : (l.subjects as any)?.name,
        teacher_name: Array.isArray(l.profiles) ? l.profiles[0]?.full_name : (l.profiles as any)?.full_name,
        class_name: Array.isArray(l.classes) ? l.classes[0]?.name : (l.classes as any)?.name,
      })));
    }

    // Duties
    if (dutyData.data) {
      setDuties((dutyData.data as any[]).map((d) => ({
        day_of_week: d.day_of_week,
        teacher_name: Array.isArray(d.profiles) ? d.profiles[0]?.full_name : (d.profiles as any)?.full_name,
        location: d.location,
        time_slot: d.time_slot,
      })));
    }

    // Announcements
    if (annData.data) setAnnouncements(annData.data as Announcement[]);

    // Gallery
    if (galleryData.data) setGallery(galleryData.data as GalleryItem[]);

    // Birthdays (bu ay)
    const now = new Date();
    const thisMonth = now.getMonth();
    if (birthdaysData.data) {
      setBirthdays(
        (birthdaysData.data as any[])
          .filter((s) => {
            if (!s.dogum_tarihi) return false;
            const bMonth = new Date(s.dogum_tarihi).getMonth();
            return bMonth === thisMonth;
          })
          .map((s) => ({
            full_name: s.full_name,
            class_name: Array.isArray(s.classes) ? s.classes[0]?.name : (s.classes as any)?.name,
            dogum_tarihi: s.dogum_tarihi,
          }))
      );
    }

    // Top Readers (son 30 gun)
    if (readersData.data) {
      const countMap = new Map<string, { name: string; className: string; count: number }>();
      (readersData.data as any[]).forEach((sb) => {
        const sid = sb.students?.full_name;
        if (!sid) return;
        if (!countMap.has(sid)) {
          countMap.set(sid, {
            name: sid,
            className: Array.isArray((sb.students as any)?.classes) ? (sb.students as any).classes[0]?.name : (sb.students as any)?.classes?.name,
            count: 0,
          });
        }
        countMap.get(sid)!.count++;
      });
      const sorted = Array.from(countMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);
      setTopReaders(sorted.map((r) => ({ student_name: r.name, class_name: r.className, book_count: r.count })));

      // En cok okuyan sinif
      const classMap = new Map<string, { cname: string; total: number; count: number }>();
      sorted.forEach((r) => {
        if (!classMap.has(r.className)) {
          classMap.set(r.className, { cname: r.className, total: 0, count: 0 });
        }
        const c = classMap.get(r.className)!;
        c.total += r.count;
        c.count++;
      });
      let bestClassName = "";
      let bestAvg = 0;
      classMap.forEach((c) => {
        const avg = c.total / c.count;
        if (avg > bestAvg) { bestAvg = avg; bestClassName = c.cname; }
      });
      if (bestClassName) setTopClass({ class_name: bestClassName, avg_rate: Math.round(bestAvg) });
    }

    // Günün sorusu otomatik seçme akışı
    let daily = dailyQuizRes?.data || null;
    if (!daily && schoolId) {
      try {
        const { error: pickErr } = await supabase.rpc("pick_daily_question", { p_school_id: schoolId });
        if (!pickErr) {
          const { data: fresh } = await supabase.from("quiz_daily").select("id, quiz_questions(question, answer)").eq("school_id", schoolId).eq("question_date", today.toISOString().split("T")[0]).maybeSingle();
          if (fresh) daily = fresh;
        }
      } catch {}
    }
    setDailyQuiz(daily);
    setYesterdayQuiz(yesterdayQuizRes?.data || null);
  }, [schoolId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 dakikada bir yenile
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Clock ─────────────────────────────────────────────────
  useEffect(() => {
    if (!authenticated) return;
    clockTimer.current = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      // Ders durumu
      if (bellSchedule.length > 0) {
        const mins = now.getHours() * 60 + now.getMinutes();
        let status = "Ders Disi";
        for (const p of bellSchedule) {
          const [sh, sm] = p.start_time.split(":").map(Number);
          const [eh, em] = p.end_time.split(":").map(Number);
          if (mins >= sh * 60 + sm && mins <= eh * 60 + em) {
            status = `${p.label} devam ediyor`;
            break;
          }
          if (mins < sh * 60 + sm && status === "Ders Disi") {
            status = `${p.label} baslayacak`;
          }
        }
        setPeriodStatus(status);
      }
    }, 1000);
    return () => { if (clockTimer.current) clearInterval(clockTimer.current); };
  }, [authenticated, bellSchedule]);

  // ── Slideshow ─────────────────────────────────────────────
  useEffect(() => {
    if (!authenticated || announcements.length === 0) return;
    slideTimer.current = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % announcements.length);
    }, config.slide_interval * 1000);
    return () => { if (slideTimer.current) clearInterval(slideTimer.current); };
  }, [authenticated, announcements, config.slide_interval]);

  // ── Gallery ───────────────────────────────────────────────
  useEffect(() => {
    if (!authenticated || gallery.length === 0) return;
    galleryTimer.current = setInterval(() => {
      setGalleryIndex((prev) => (prev + 1) % gallery.length);
    }, 8000);
    return () => { if (galleryTimer.current) clearInterval(galleryTimer.current); };
  }, [authenticated, gallery]);

  // ── PIN Ekrani ────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "'Segoe UI', sans-serif",
      }}>
        <form onSubmit={handlePinSubmit} style={{
          background: "rgba(255,255,255,0.15)",
          backdropFilter: "blur(20px)",
          padding: "40px 50px",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.2)",
          textAlign: "center",
          color: "white",
        }}>
          <h1 style={{ fontSize: 28, marginBottom: 8, fontWeight: 700 }}>Dijital Pano</h1>
          <p style={{ opacity: 0.8, marginBottom: 24, fontSize: 15 }}>Okulunuza ait PIN kodunu girin</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(""); }}
            placeholder="PIN Kodu"
            autoFocus
            style={{
              width: "100%",
              padding: "14px 18px",
              fontSize: 22,
              borderRadius: 12,
              border: "2px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)",
              color: "white",
              textAlign: "center",
              letterSpacing: 8,
              outline: "none",
              marginBottom: 12,
            }}
          />
          {pinError && <p style={{ color: "#FFD700", fontSize: 14, marginBottom: 12 }}>{pinError}</p>}
          <button
            type="submit"
            disabled={pinLoading || pin.length < 4}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 12,
              border: "none",
              background: pin.length < 4 ? "rgba(255,255,255,0.2)" : "white",
              color: pin.length < 4 ? "rgba(255,255,255,0.5)" : "#667eea",
              cursor: pin.length < 4 ? "default" : "pointer",
            }}
          >
            {pinLoading ? "Kontrol ediliyor..." : "Giris Yap"}
          </button>
        </form>
      </div>
    );
  }

  // ── Pano Ekrani ───────────────────────────────────────────
  const currentSlide = announcements[slideIndex];
  const currentGallery = gallery[galleryIndex];

  const todayQuestion = dailyQuiz?.quiz_questions ? (Array.isArray(dailyQuiz.quiz_questions) ? dailyQuiz.quiz_questions[0] : dailyQuiz.quiz_questions) : null;
  const yesterdayQuestion = yesterdayQuiz?.quiz_questions ? (Array.isArray(yesterdayQuiz.quiz_questions) ? yesterdayQuiz.quiz_questions[0] : yesterdayQuiz.quiz_questions) : null;

  let footerText = "";
  if (todayQuestion) {
    footerText += `❓ Günün Sorusu: ${todayQuestion.question}`;
  }
  if (yesterdayQuestion) {
    if (footerText) {
      footerText += "     ◆ ◆ ◆     ";
    }
    footerText += `💡 Dünkü Sorunun Cevabı: ${yesterdayQuestion.answer} (Soru: ${yesterdayQuestion.question})`;
  }
  if (!footerText) {
    footerText = "O.Y.P. - Okul Yönetim Paneline Hoş Geldiniz!";
  }
  const theme = config.theme || "blue";

  const themeColors: Record<string, string> = {
    blue: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    green: "linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)",
    orange: "linear-gradient(135deg, #FF9800 0%, #E65100 100%)",
    purple: "linear-gradient(135deg, #9C27B0 0%, #6A1B9A 100%)",
    red: "linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)",
    teal: "linear-gradient(135deg, #00897B 0%, #00695C 100%)",
    indigo: "linear-gradient(135deg, #303F9F 0%, #1A237E 100%)",
    pink: "linear-gradient(135deg, #E91E63 0%, #C2185B 100%)",
    dark: "linear-gradient(135deg, #424242 0%, #212121 100%)",
    sky: "linear-gradient(135deg, #0288D1 0%, #01579B 100%)",
  };

  const cardBg = "rgba(255,255,255,0.1)";
  const cardBorder = "rgba(255,255,255,0.18)";

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: themeColors[theme] || themeColors.blue,
      color: "white",
      fontFamily: "'Segoe UI', sans-serif",
      overflow: "hidden",
      display: "grid",
      gridTemplateAreas: `"header header header" "left center right" "footer footer footer"`,
      gridTemplateColumns: "1.3fr 2fr 1.3fr",
      gridTemplateRows: "80px 1fr 45px",
      gap: 10,
      padding: 10,
    }}>
      {/* HEADER */}
      <div style={{
        gridArea: "header",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(10px)",
        padding: "10px 25px",
        borderRadius: 15,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          {config.school_logo_url && (
            <img src={config.school_logo_url} alt="Logo" style={{ width: 50, height: 50, borderRadius: 10 }} />
          )}
          <div>
            <div style={{ fontSize: "2em", fontWeight: "bold" }}>{schoolName}</div>
            {config.school_motto && <div style={{ fontSize: "0.85em", opacity: 0.7 }}>{config.school_motto}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "2.5em", fontWeight: "bold", fontVariantNumeric: "tabular-nums" }}>
            {currentTime.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div style={{ fontSize: "0.85em", opacity: 0.8 }}>
            {currentTime.toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
          <div style={{ fontSize: "1em", color: "#FFD700", marginTop: 2 }}>{periodStatus}</div>
        </div>
      </div>

      {/* LEFT PANEL */}
      <div style={{ gridArea: "left", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
        {/* Canli Ders Programi */}
        <div style={{ background: cardBg, backdropFilter: "blur(10px)", borderRadius: 15, padding: 15, border: `1px solid ${cardBorder}`, flex: 1, overflow: "auto" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "1.1em" }}>Bugunun Ders Programi</h3>
          {lessons.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: "0.9em", textAlign: "center", padding: 20 }}>Bugun ders yok</p>
          ) : (
            lessons.slice(0, 10).map((l, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: "0.9em" }}>
                <span style={{ fontWeight: 600, minWidth: 30 }}>{l.period_no}.</span>
                <span style={{ flex: 1 }}>{l.subject_name || "-"}</span>
                <span style={{ opacity: 0.7, fontSize: "0.85em" }}>{l.teacher_name || ""}</span>
              </div>
            ))
          )}
        </div>

        {/* Nobetci Ogretmenler */}
        <div style={{ background: cardBg, backdropFilter: "blur(10px)", borderRadius: 15, padding: 15, border: `1px solid ${cardBorder}`, maxHeight: 200, overflow: "auto" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "1.1em" }}>Bugunun Nobetcileri</h3>
          {duties.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: "0.9em", textAlign: "center", padding: 10 }}>Nobetci yok</p>
          ) : (
            duties.slice(0, 8).map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "0.9em" }}>
                <span style={{ fontWeight: 600 }}>{d.teacher_name}</span>
                <span style={{ opacity: 0.7, fontSize: "0.85em" }}>{d.location || d.time_slot}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CENTER PANEL - Slayt */}
      <div style={{ gridArea: "center", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 15 }}>
        {currentSlide ? (
          <div style={{
            width: "100%", height: "100%",
            background: cardBg,
            backdropFilter: "blur(10px)",
            borderRadius: 15,
            border: `1px solid ${cardBorder}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 30,
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}>
            {currentSlide.image_url && (
              <img src={currentSlide.image_url} alt="" style={{ maxWidth: "60%", maxHeight: "45%", borderRadius: 12, marginBottom: 20, objectFit: "cover" }} />
            )}
            <div style={{
              fontSize: currentSlide.title.length > 30 ? "1.8em" : "2.5em",
              fontWeight: "bold",
              marginBottom: 10,
            }}>
              {currentSlide.title}
            </div>
            {currentSlide.content && (
              <div style={{ fontSize: "1.2em", opacity: 0.85, maxWidth: "80%" }}>{currentSlide.content}</div>
            )}
            <div style={{
              position: "absolute", top: 15, right: 20,
              background: currentSlide.category === "duyuru" ? "#4CAF50" :
                currentSlide.category === "etkinlik" ? "#FF9800" :
                currentSlide.category === "ayin_ogrencisi" ? "#9C27B0" : "#2196F3",
              padding: "4px 12px", borderRadius: 20, fontSize: "0.75em", fontWeight: 600,
            }}>
              {currentSlide.category === "duyuru" ? "DUYURU" :
               currentSlide.category === "etkinlik" ? "ETKINLIK" :
               currentSlide.category === "ayin_ogrencisi" ? "AYIN OGRENCISI" :
               currentSlide.category === "ayin_sinifi" ? "AYIN SINIFI" :
               currentSlide.category === "deneme_liderleri" ? "DENEME LIDERI" : currentSlide.category.toUpperCase()}
            </div>
            {/* Indicators */}
            <div style={{ position: "absolute", bottom: 15, display: "flex", gap: 8 }}>
              {announcements.map((_, i) => (
                <div key={i} style={{
                  width: i === slideIndex ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === slideIndex ? "white" : "rgba(255,255,255,0.3)",
                  transition: "all 0.3s",
                }} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: cardBg,
            backdropFilter: "blur(10px)",
            borderRadius: 15,
            border: `1px solid ${cardBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.5,
            fontSize: "1.2em",
          }}>
            Duyuru eklenmemis
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div style={{ gridArea: "right", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
        {/* Dogum Gunleri */}
        <div style={{ background: cardBg, backdropFilter: "blur(10px)", borderRadius: 15, padding: 15, border: `1px solid ${cardBorder}`, maxHeight: 200, overflow: "auto" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "1.1em" }}>Bu Ay Doganlar</h3>
          {birthdays.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: "0.9em", textAlign: "center", padding: 10 }}>Dogum gunu yok</p>
          ) : (
            birthdays.slice(0, 8).map((b, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "0.9em" }}>
                <span>{b.full_name}</span>
                <span style={{ opacity: 0.7, fontSize: "0.85em" }}>{b.class_name}</span>
              </div>
            ))
          )}
        </div>

        {/* En Cok Okuyanlar */}
        {config.show_top_readers && topReaders.length > 0 && (
          <div style={{ background: cardBg, backdropFilter: "blur(10px)", borderRadius: 15, padding: 15, border: `1px solid ${cardBorder}`, flex: 1, overflow: "auto" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "1.1em" }}>En Cok Kitap Okuyanlar</h3>
            {topReaders.slice(0, 7).map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", fontSize: "0.9em" }}>
                <span style={{ fontWeight: "bold", color: "#FFD700", minWidth: 24, textAlign: "center" }}>
                  {i === 0 ? "1." : i === 1 ? "2." : i === 2 ? "3." : `${i + 1}.`}
                </span>
                <span style={{ flex: 1 }}>{r.student_name}</span>
                <span style={{ opacity: 0.7, fontSize: "0.85em" }}>{r.class_name}</span>
                <span style={{ fontWeight: 600 }}>{r.book_count} kitap</span>
              </div>
            ))}
          </div>
        )}

        {/* En Cok Okuyan Sinif */}
        {config.show_top_class && topClass && (
          <div style={{
            background: "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05))",
            border: "1px solid rgba(255,215,0,0.3)",
            borderRadius: 15, padding: 15, textAlign: "center",
          }}>
            <div style={{ fontSize: "0.85em", opacity: 0.8 }}>En Cok Okuyan Sinif</div>
            <div style={{ fontSize: "1.5em", fontWeight: "bold", color: "#FFD700" }}>{topClass.class_name}</div>
            <div style={{ fontSize: "0.85em", opacity: 0.7 }}>Ort. {topClass.avg_rate} kitap</div>
          </div>
        )}
      </div>

      {/* GALLERY FOOTER */}
      <div style={{
        gridArea: "footer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "rgba(0,0,0,0.3)",
        borderRadius: 10,
        fontSize: "0.8em",
      }}>
        <div className="marquee-container">
          <span className="marquee-text">{footerText}</span>
        </div>

        <span style={{ opacity: 0.7, flexShrink: 0, marginLeft: 15 }}>
          {currentGallery ? (
            <>{galleryIndex + 1} / {gallery.length} - {currentGallery.caption || ""}</>
          ) : (
            gallery.length > 0 ? "Galeri yukleniyor..." : ""
          )}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 15 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50" }}></span>
          Canli
        </span>
      </div>

      <style>{`
        .marquee-container {
          flex: 1;
          overflow: hidden;
          white-space: nowrap;
          margin-right: 15px;
          font-size: 1.4em;
          font-weight: bold;
        }
        .marquee-text {
          display: inline-block;
          animation: marquee 30s linear infinite;
          padding-left: 100%;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

      {/* Gallery image (absolute positioned, cycles) */}
      {currentGallery && (
        <div style={{
          position: "fixed",
          bottom: 55,
          right: 20,
          width: 280,
          height: 180,
          borderRadius: 12,
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.2)",
          zIndex: 100,
        }}>
          <img
            src={currentGallery.cloudinary_url}
            alt={currentGallery.caption || ""}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {currentGallery.caption && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "rgba(0,0,0,0.7)", padding: "4px 10px", fontSize: "0.8em",
            }}>
              {currentGallery.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
