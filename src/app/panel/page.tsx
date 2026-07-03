"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Trophy, Cake, Shield, CalendarDays, Megaphone, Loader2 } from "lucide-react";

interface Slide {
  type: "welcome" | "announcement" | "lesson_schedule" | "top_readers" | "birthdays" | "duties";
  title?: string;
  content?: string;
  lessons?: Record<string, Array<{ className: string; teacherName: string; subjectName: string }>>;
  bellSchedule?: Array<{ period_no: number; label: string; start_time: string; end_time: string }>;
  topClass?: string;
  topClassCount?: number;
  topStudent?: { name: string; className: string; count: number } | null;
  students?: Array<{ name: string; className: string }>;
  duties?: Array<{ timeSlot: string; location: string; teacherName: string }>;
}

function PanelKioskContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [slides, setSlides] = useState<Slide[]>([]);
  const [duration, setDuration] = useState(10);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fadeState, setFadeState] = useState<"in" | "out">("in");

  // Fetch slide data
  useEffect(() => {
    if (!code) {
      setError("Okul kodu (?code=XYZ) belirtilmelidir.");
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const res = await fetch(`/api/panel/slides?code=${code}`);
        if (!res.ok) throw new Error("Veri yüklenemedi");
        const data = await res.json();
        if (data.slides) {
          setSlides(data.slides);
          setDuration(data.duration || 10);
        }
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Pano verisi çekilirken hata oluştu.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // 5 dakikada bir verileri yenile (RPi arka planda otomatik güncellensin)
    const pollInterval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(pollInterval);
  }, [code]);

  // Slide cycle logic with cross-fade opacity animation
  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      // Fade out
      setFadeState("out");
      setTimeout(() => {
        // Change slide and fade in
        setCurrentIdx((prev) => (prev + 1) % slides.length);
        setFadeState("in");
      }, 500); // Wait for fade-out transition to complete (0.5s)
    }, duration * 1000);

    return () => clearInterval(interval);
  }, [slides, duration]);

  // Clock state
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    function updateClock() {
      const d = new Date();
      setTime(d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDate(d.toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
    }
    updateClock();
    const tInterval = setInterval(updateClock, 1000);
    return () => clearInterval(tInterval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Dijital Pano başlatılıyor...</p>
      </div>
    );
  }

  if (error || !code) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-xl font-bold text-red-500">Pano Hatası</h1>
        <p className="text-sm text-slate-300 max-w-md">{error || "Bağlantıda okul kodu eksik."}</p>
        <p className="text-xs text-slate-500 mt-4">Örnek kullanım: /panel?code=XJ712B</p>
      </div>
    );
  }

  const activeSlide = slides[currentIdx] || { type: "welcome", title: "Okul Pano", content: "Kayıt Bulunamadı" };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden relative font-sans select-none">
      {/* Header bar: Clock & Date */}
      <header className="h-20 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between px-10 z-10">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-primary border-primary/30 px-3 py-1 font-mono text-sm tracking-wide">
            {code}
          </Badge>
          <span className="text-sm text-slate-400 font-medium">Dijital Bilgilendirme Ekranı</span>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div className="text-sm text-slate-400 font-medium">{date}</div>
          <div className="text-2xl font-mono font-bold text-primary tracking-wider">{time}</div>
        </div>
      </header>

      {/* Main Slide Area */}
      <main className="flex-1 flex items-center justify-center p-8 relative">
        <div
          className={`w-full max-w-6xl transition-opacity duration-500 ${
            fadeState === "in" ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          {renderSlideContent(activeSlide)}
        </div>
      </main>

      {/* Bottom Ticker Indicator */}
      <footer className="h-10 bg-slate-900/60 border-t border-slate-800/60 flex items-center justify-center px-10 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentIdx ? "w-6 bg-primary" : "w-2 bg-slate-700"
              }`}
            />
          ))}
        </div>
      </footer>
    </div>
  );
}

export default function PanelKioskPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Dijital Pano yükleniyor...</p>
        </div>
      }
    >
      <PanelKioskContent />
    </Suspense>
  );
}

function renderSlideContent(slide: Slide) {
  switch (slide.type) {
    case "welcome":
      return (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardContent className="flex flex-col items-center text-center p-16 space-y-6">
            <div className="p-4 bg-primary/10 rounded-full border border-primary/20 text-primary">
              <CalendarDays className="h-16 w-16" />
            </div>
            <h1 className="text-5xl font-black tracking-tight text-white">{slide.title}</h1>
            <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">{slide.content}</p>
          </CardContent>
        </Card>
      );

    case "announcement":
      return (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardContent className="p-16 space-y-6">
            <div className="flex items-center gap-4 text-purple-400">
              <Megaphone className="h-10 w-10 shrink-0" />
              <h2 className="text-3xl font-extrabold text-white">Okul Duyurusu</h2>
            </div>
            <h3 className="text-4xl font-black tracking-tight text-white leading-snug">{slide.title}</h3>
            <p className="text-xl text-slate-300 leading-relaxed font-light whitespace-pre-line">{slide.content}</p>
          </CardContent>
        </Card>
      );

    case "lesson_schedule":
      return (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardContent className="p-12 space-y-6">
            <div className="flex items-center gap-3 text-blue-400">
              <CalendarDays className="h-8 w-8" />
              <h2 className="text-2xl font-bold text-white">Bugünkü Ders Akışı</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-h-[500px] overflow-y-auto pr-2">
              {slide.bellSchedule?.map((bell) => {
                const currentPeriodLessons = slide.lessons?.[bell.period_no] || [];
                return (
                  <div key={bell.period_no} className="bg-slate-950/60 border border-slate-800/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-sm font-bold text-primary">{bell.label}</span>
                      <span className="text-xs text-slate-500 font-mono">{bell.start_time} - {bell.end_time}</span>
                    </div>
                    {currentPeriodLessons.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">Ders tanımlanmamış</p>
                    ) : (
                      <div className="space-y-2">
                        {currentPeriodLessons.map((l, idx) => (
                          <div key={idx} className="text-xs flex flex-col gap-0.5">
                            <div className="flex justify-between font-semibold text-slate-200">
                              <span>{l.className}</span>
                              <span className="text-primary/90">{l.subjectName}</span>
                            </div>
                            <div className="text-slate-500 text-[10px]">{l.teacherName}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      );

    case "top_readers":
      return (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardContent className="p-16 flex flex-col items-center text-center space-y-8">
            <div className="flex items-center gap-3 text-yellow-400">
              <Trophy className="h-12 w-12" />
              <h2 className="text-3xl font-black text-white">Okuma Şampiyonları</h2>
            </div>
            <div className="grid gap-8 md:grid-cols-2 w-full max-w-4xl">
              {slide.topClass && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-8 space-y-4">
                  <p className="text-sm font-semibold text-slate-400 tracking-wider uppercase">Haftanın En Çok Okuyan Sınıfı</p>
                  <p className="text-5xl font-black text-white">{slide.topClass}</p>
                  <p className="text-xs text-primary font-mono">{slide.topClassCount} Okuma İşareti</p>
                </div>
              )}
              {slide.topStudent && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-8 space-y-4">
                  <p className="text-sm font-semibold text-slate-400 tracking-wider uppercase">Ayın Kitap Kurdu Öğrencisi</p>
                  <p className="text-4xl font-black text-white">{slide.topStudent.name}</p>
                  <p className="text-sm text-slate-300 font-semibold">{slide.topStudent.className} Sınıfı</p>
                  <p className="text-xs text-primary font-mono">{slide.topStudent.count} Kitap Bitirdi</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      );

    case "birthdays":
      return (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardContent className="p-16 flex flex-col items-center text-center space-y-8">
            <div className="p-4 bg-pink-500/10 border border-pink-500/20 rounded-full text-pink-400">
              <Cake className="h-16 w-16 animate-bounce" />
            </div>
            <h2 className="text-4xl font-black text-white">🎂 Bugün Doğan Öğrencilerimiz</h2>
            <div className="flex flex-wrap justify-center gap-3 max-w-3xl">
              {slide.students?.map((s, idx) => (
                <div key={idx} className="bg-pink-950/20 border border-pink-900/40 rounded-xl px-6 py-3">
                  <p className="text-lg font-bold text-pink-200">{s.name}</p>
                  <p className="text-xs text-pink-400/80">{s.className}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-400 text-lg italic mt-4">Doğum gününüz kutlu olsun, iyi ki varsınız! 🎉</p>
          </CardContent>
        </Card>
      );

    case "duties":
      return (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <CardContent className="p-12 space-y-6">
            <div className="flex items-center gap-3 text-orange-400">
              <Shield className="h-8 w-8" />
              <h2 className="text-2xl font-bold text-white">Bugünün Nöbetçi Öğretmenleri</h2>
            </div>
            <div className="overflow-hidden border border-slate-800 rounded-xl">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900 text-slate-300 font-bold">
                  <tr>
                    <th className="p-4">Nöbet Saati</th>
                    <th className="p-4">Öğretmen</th>
                    <th className="p-4">Nöbet Yeri / Konum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                  {slide.duties?.map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/20">
                      <td className="p-4 font-semibold text-primary">{d.timeSlot}</td>
                      <td className="p-4 text-white font-medium">{d.teacherName}</td>
                      <td className="p-4 text-slate-400">{d.location || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      );

    default:
      return null;
  }
}
