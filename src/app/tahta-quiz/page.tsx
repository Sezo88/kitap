"use client";

import { useState, useEffect, useRef, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitTahtaQuizAnswer } from "@/lib/actions/tahta-quiz";
import { Loader2, Award, Clock, CheckCircle2, XCircle, Volume2, VolumeX, Sparkles, Trophy } from "lucide-react";

// Web Audio API Sound Synthesizer (Harici dosya gerektirmez, %100 yerel ve guvenli)
class SoundFx {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playTick(urgent = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(urgent ? 1000 : 700, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {}
  }

  playCorrect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.2, this.ctx!.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + i * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(this.ctx!.currentTime + i * 0.08);
        osc.stop(this.ctx!.currentTime + i * 0.08 + 0.3);
      });
    } catch {}
  }

  playWrong() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, this.ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch {}
  }
}

const sfx = new SoundFx();

export default function TahtaQuizPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="h-10 w-10 animate-spin" /></div>}>
      <TahtaQuizContent />
    </Suspense>
  );
}

function TahtaQuizContent() {
  const searchParams = useSearchParams();
  const schoolCodeParam = searchParams.get("okul") || "";
  const classParam = searchParams.get("sinif") || "";

  const [step, setStep] = useState<"loading" | "pin" | "question" | "result" | "already" | "not_active">("loading");
  const [schoolCode, setSchoolCode] = useState(schoolCodeParam);
  const [pin, setPin] = useState("");
  const [schoolInfo, setSchoolInfo] = useState<{ id: string; name: string } | null>(null);
  const [classInfo, setClassInfo] = useState<{ id: string; name: string } | null>(null);
  const [dailyQuestion, setDailyQuestion] = useState<any>(null);
  const [duration, setDuration] = useState(30);
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [autoCloseLeft, setAutoCloseLeft] = useState(15);
  const [soundOn, setSoundOn] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ses ayarını senkronize et
  useEffect(() => {
    sfx.enabled = soundOn;
  }, [soundOn]);

  // 1. Okul ve Soru Bilgilerini Yükle
  useEffect(() => {
    async function loadData() {
      if (!schoolCodeParam) {
        setStep("pin");
        return;
      }

      const supabase = createClient();

      // Okul kodu çöz
      const { data: school } = await supabase
        .from("schools")
        .select("id, name, code")
        .eq("code", schoolCodeParam.trim())
        .maybeSingle();

      if (!school) {
        setErrorMsg("Geçersiz okul kodu!");
        setStep("pin");
        return;
      }
      setSchoolInfo(school);
      setSchoolCode(school.code);

      // Ayarları ve aktif soru kontrolünü yap
      const today = new Date().toISOString().split("T")[0];
      const [dailyRes, settingsRes] = await Promise.all([
        supabase
          .from("quiz_daily")
          .select("id, question_id, quiz_questions(question, answer, option_a, option_b, option_c, option_d, difficulty, category)")
          .eq("school_id", school.id)
          .eq("question_date", today)
          .maybeSingle(),
        supabase
          .from("panel_settings")
          .select("tahta_quiz_duration, tahta_quiz_enabled, tahta_quiz_auto_close_seconds")
          .eq("school_id", school.id)
          .maybeSingle(),
      ]);

      if (settingsRes.data) {
        if (settingsRes.data.tahta_quiz_enabled === false) {
          setStep("not_active");
          return;
        }
        if (settingsRes.data.tahta_quiz_duration) {
          setDuration(settingsRes.data.tahta_quiz_duration);
          setTimeLeft(settingsRes.data.tahta_quiz_duration);
        }
        if (settingsRes.data.tahta_quiz_auto_close_seconds) {
          setAutoCloseLeft(settingsRes.data.tahta_quiz_auto_close_seconds);
        }
      }

      if (!dailyRes.data || !dailyRes.data.quiz_questions) {
        setErrorMsg("Bugün için soru belirlenmemiş.");
        setStep("not_active");
        return;
      }

      setDailyQuestion(dailyRes.data);
      setStep("pin");
    }

    loadData();
  }, [schoolCodeParam]);

  // PIN Giriş Kontrolü
  async function handlePinSubmit(pinCode: string) {
    if (!pinCode.trim()) return;
    setErrorMsg("");
    const supabase = createClient();

    let targetSchoolId = schoolInfo?.id;
    if (!targetSchoolId && schoolCode) {
      const { data: sc } = await supabase.from("schools").select("id, name").eq("code", schoolCode.trim()).maybeSingle();
      if (sc) {
        targetSchoolId = sc.id;
        setSchoolInfo(sc);
      }
    }

    if (!targetSchoolId) {
      setErrorMsg("Lütfen geçerli bir okul kodu girin.");
      return;
    }

    // Sınıfı PIN ile bul
    const { data: cls } = await supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", targetSchoolId)
      .eq("quiz_pin", pinCode.trim())
      .neq("is_active", false)
      .maybeSingle();

    if (!cls) {
      setErrorMsg("Hatalı PIN Kodu! Lütfen sınıf PIN'inizi kontrol edin.");
      setPin("");
      return;
    }
    setClassInfo(cls);

    // Bu sınıfın bugün cevap verip vermediğini kontrol et
    if (dailyQuestion) {
      const { data: existingAns } = await supabase
        .from("quiz_answers")
        .select("id, is_correct, points_awarded, answer")
        .eq("daily_id", dailyQuestion.id)
        .eq("class_id", cls.id)
        .maybeSingle();

      if (existingAns) {
        setResult({
          isCorrect: existingAns.is_correct,
          pointsEarned: existingAns.points_awarded || 0,
          className: cls.name,
        });
        setStep("already");
        startAutoClose();
        return;
      }
    }

    // Soruyu Başlat
    setTimeLeft(duration);
    setStep("question");
    startTimer();
  }

  // 30 Saniyelik Geri Sayım
  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeOut();
          return 0;
        }
        sfx.playTick(prev <= 6);
        return prev - 1;
      });
    }, 1000);
  }

  // Süre Bitince Otomatik Cevap (Yanlış Kabul Edilir)
  async function handleTimeOut() {
    sfx.playWrong();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const res = await submitTahtaQuizAnswer({
      schoolCode: schoolInfo?.id ? schoolCode : schoolCodeParam,
      pin,
      answer: "SURE_DOLDU",
      secondsLeft: 0,
    });

    setResult(res);
    setStep("result");
    setIsSubmitting(false);
    startAutoClose();
  }

  // Şık Seçilince Cevap Gönder
  async function handleSelectOption(opt: string) {
    if (isSubmitting || selectedAnswer) return;
    setSelectedAnswer(opt);
    if (timerRef.current) clearInterval(timerRef.current);

    setIsSubmitting(true);
    const seconds = timeLeft;

    const res = await submitTahtaQuizAnswer({
      schoolCode: schoolInfo?.id ? schoolCode : schoolCodeParam,
      pin,
      answer: opt,
      secondsLeft: seconds,
    });

    if (res.isCorrect) {
      sfx.playCorrect();
    } else {
      sfx.playWrong();
    }

    setResult(res);
    setStep("result");
    setIsSubmitting(false);
    startAutoClose();
  }

  // Otomatik Kapanma Sayacı
  function startAutoClose() {
    if (closeTimerRef.current) clearInterval(closeTimerRef.current);
    closeTimerRef.current = setInterval(() => {
      setAutoCloseLeft((prev) => {
        if (prev <= 1) {
          clearInterval(closeTimerRef.current!);
          closeWindow();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function closeWindow() {
    try {
      window.close();
    } catch {}
    // Kiosk modda kapanamazsa bos ekrana yonlendir
    window.location.href = "about:blank";
  }

  // PIN Pad tus basimi
  function handleKeyPress(val: string) {
    if (val === "C") {
      setPin("");
      setErrorMsg("");
      return;
    }
    if (val === "OK") {
      if (pin.length >= 2) handlePinSubmit(pin);
      return;
    }
    if (pin.length < 6) {
      const nextPin = pin + val;
      setPin(nextPin);
      setErrorMsg("");
      if (nextPin.length === 4) {
        handlePinSubmit(nextPin);
      }
    }
  }

  const qObj = dailyQuestion?.quiz_questions;
  const options = qObj
    ? [
        { key: "A", text: qObj.option_a, color: "from-red-600/90 to-rose-700/90 hover:from-red-500 hover:to-rose-600 border-red-400/40" },
        { key: "B", text: qObj.option_b, color: "from-blue-600/90 to-cyan-700/90 hover:from-blue-500 hover:to-cyan-600 border-blue-400/40" },
        { key: "C", text: qObj.option_c, color: "from-amber-600/90 to-yellow-700/90 hover:from-amber-500 hover:to-yellow-600 border-amber-400/40" },
        { key: "D", text: qObj.option_d, color: "from-emerald-600/90 to-green-700/90 hover:from-emerald-500 hover:to-green-600 border-emerald-400/40" },
      ].filter((o) => !!o.text)
    : [];

  const timePct = Math.max(0, Math.min(100, (timeLeft / duration) * 100));
  const timerColor = timeLeft > 10 ? "#10b981" : timeLeft > 5 ? "#f59e0b" : "#ef4444";

  return (
    <main className="min-h-screen w-full bg-[#070b14] text-white flex flex-col justify-between select-none overflow-hidden relative font-sans">
      {/* Arka Plan Isik Efektleri */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* ── UST BILGI SERITI ────────────────────────────────────── */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-md bg-white/[0.02] z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black shadow-lg shadow-amber-500/20">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              {schoolInfo?.name || "Akıllı Tahta Günün Sorusu"}
            </h1>
            <p className="text-xs text-slate-400">
              {classInfo ? `${classInfo.name} Sınıfı` : "Sınıflar Arası Günlük Bilgi Ligi"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-slate-300"
            title="Ses Aç/Kapat"
          >
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-red-400" />}
          </button>
          <button
            onClick={closeWindow}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/40 text-xs font-semibold text-slate-300 transition"
          >
            Ekranı Kapat
          </button>
        </div>
      </header>

      {/* ── ANA ICERIK ALANI ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 z-10">
        {/* ADIM: YUKLENIYOR */}
        {step === "loading" && (
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-amber-400" />
            <p className="text-slate-400 text-lg">Günün sorusu hazırlanıyor...</p>
          </div>
        )}

        {/* ADIM: AKTIF DEGIL */}
        {step === "not_active" && (
          <div className="max-w-md w-full text-center p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl space-y-4">
            <Clock className="h-16 w-16 mx-auto text-amber-400/80 animate-pulse" />
            <h2 className="text-2xl font-bold">Yarışma Saati Dışındasınız</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Günün sorusu idarenin belirlediği saat aralığında açılmaktadır. Ders başlangıcında veya teneffüste tekrar deneyiniz.
            </p>
            <button
              onClick={closeWindow}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold text-base shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 transition"
            >
              Tahtaya Dön
            </button>
          </div>
        )}

        {/* ADIM: PIN GIRIS EKRANI */}
        {step === "pin" && (
          <div className="max-w-sm w-full p-6 sm:p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="text-center space-y-1">
              <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-2">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-black">Sınıf PIN Kodu</h2>
              <p className="text-xs text-slate-400">Yarışmaya başlamak için 4 haneli PIN girin</p>
            </div>

            {/* PIN Gostergesi */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all ${
                    pin[i]
                      ? "border-amber-400 bg-amber-400/10 text-amber-300 scale-105 shadow-md shadow-amber-500/20"
                      : "border-white/15 bg-white/5 text-transparent"
                  }`}
                >
                  {pin[i] ? "●" : ""}
                </div>
              ))}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center font-medium">
                {errorMsg}
              </div>
            )}

            {/* Dokunmatik Ekran Tus Takimi (Keypad) */}
            <div className="grid grid-cols-3 gap-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className={`h-14 rounded-2xl text-xl font-bold flex items-center justify-center transition active:scale-95 ${
                    key === "OK"
                      ? "bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black shadow-lg shadow-amber-500/30"
                      : key === "C"
                      ? "bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
                      : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ADIM: SORU VE GERI SAYIM EKRANI */}
        {step === "question" && qObj && (
          <div className="max-w-4xl w-full flex flex-col items-center gap-6">
            {/* Dairesel Sayaç & Puan Bilgisi */}
            <div className="flex items-center justify-between w-full px-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {qObj.category || "Genel Kültür"}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Zorluk: {qObj.difficulty || "Orta"}
                </span>
              </div>

              {/* Dairesel 30sn Timer */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke={timerColor}
                    strokeWidth="8"
                    strokeDasharray={264}
                    strokeDashoffset={264 - (264 * timePct) / 100}
                    strokeLinecap="round"
                    fill="none"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black ${timeLeft <= 5 ? "animate-ping text-red-400" : ""}`} style={{ color: timerColor }}>
                    {timeLeft}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold tracking-tighter uppercase">Saniye</span>
                </div>
              </div>
            </div>

            {/* Soru Kutusu */}
            <div className="w-full p-8 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-2xl text-center">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight tracking-tight text-white drop-shadow-md">
                {qObj.question}
              </h2>
            </div>

            {/* Secenekler (A, B, C, D) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {options.map((opt) => {
                const isSelected = selectedAnswer === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectOption(opt.key)}
                    disabled={isSubmitting}
                    className={`p-6 rounded-2xl bg-gradient-to-r ${opt.color} border text-left flex items-center gap-5 transition-all shadow-xl active:scale-98 ${
                      isSelected ? "ring-4 ring-white scale-102" : "hover:scale-[1.01]"
                    }`}
                  >
                    <span className="w-12 h-12 rounded-xl bg-black/30 border border-white/20 flex items-center justify-center text-2xl font-black shrink-0">
                      {opt.key}
                    </span>
                    <span className="text-xl sm:text-2xl font-bold leading-snug break-words">
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ADIM: CEVAP SONUCU & LIDERLIK */}
        {step === "result" && result && (
          <div className="max-w-md w-full text-center p-8 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-2xl space-y-6">
            {result.isCorrect ? (
              <div className="space-y-4">
                <div className="inline-flex p-4 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 className="h-16 w-16" />
                </div>
                <h2 className="text-3xl font-black text-emerald-400">TEBRİKLER! DOĞRU CEVAP!</h2>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-sm text-slate-300">
                    <span>Doğru Cevap:</span>
                    <span className="font-bold text-emerald-400">+100 Puan</span>
                  </div>
                  {result.pointsEarned > 100 && (
                    <div className="flex justify-between items-center text-sm text-slate-300">
                      <span>Hız Bonusu:</span>
                      <span className="font-bold text-amber-300">+{result.pointsEarned - 100} Puan</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-white/10 flex justify-between items-center text-base font-black">
                    <span>Kazanılan Toplam:</span>
                    <span className="text-emerald-400 text-xl">+{result.pointsEarned} Puan</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="inline-flex p-4 rounded-3xl bg-red-500/20 border border-red-500/40 text-red-400 shadow-xl shadow-red-500/20">
                  <XCircle className="h-16 w-16" />
                </div>
                <h2 className="text-3xl font-black text-red-400">
                  {selectedAnswer ? "YANLIŞ CEVAP!" : "SÜRE DOLDU!"}
                </h2>
                {result.correctAnswer && (
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-sm text-slate-300">
                    Doğru Cevap: <span className="font-bold text-emerald-400 text-lg ml-1">{result.correctAnswer}</span>
                  </div>
                )}
              </div>
            )}

            {/* Sınıf Sıralama Bilgisi */}
            {result.schoolRank && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-amber-300 font-bold">
                  <Award className="h-5 w-5" />
                  <span>Okul Sıralamanız:</span>
                </div>
                <span className="text-xl font-black text-amber-400">#{result.schoolRank}</span>
              </div>
            )}

            <div className="pt-2 space-y-3">
              <p className="text-xs text-slate-400 font-medium">
                Bu ekran {autoCloseLeft} saniye içinde kendiliğinden kapanacaktır...
              </p>
              <button
                onClick={closeWindow}
                className="w-full py-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/20 text-sm font-bold transition"
              >
                Hemen Kapat
              </button>
            </div>
          </div>
        )}

        {/* ADIM: BUGUN ZATEN YANITLANDI */}
        {step === "already" && result && (
          <div className="max-w-md w-full text-center p-8 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-2xl space-y-5">
            <Award className="h-16 w-16 mx-auto text-amber-400" />
            <h2 className="text-2xl font-black">Bugünün Sorusu Cevaplandı!</h2>
            <p className="text-slate-300 text-sm">
              <strong className="text-amber-300">{result.className}</strong> sınıfı bugünün sorusuna daha önce katılım sağladı.
            </p>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center text-sm">
              <span>Sonuç:</span>
              <span className={`font-bold ${result.isCorrect ? "text-emerald-400" : "text-red-400"}`}>
                {result.isCorrect ? "Doğru (+100 Puan)" : "Yanlış (0 Puan)"}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Ekran {autoCloseLeft} saniye içinde kapanacaktır...
            </p>
            <button
              onClick={closeWindow}
              className="w-full py-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/20 text-sm font-bold transition"
            >
              Kapat
            </button>
          </div>
        )}
      </div>

      {/* ── ALT SERIT ─────────────────────────────────────────── */}
      <footer className="px-6 py-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 z-10">
        <span>Okul Yönetim Portalı • Akıllı Tahta Yarışma Modülü</span>
        <span>Pardus ETA 23 Uyumlu</span>
      </footer>
    </main>
  );
}
