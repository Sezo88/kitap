"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function QuizPage() {
  const [step, setStep] = useState<"pin" | "question" | "done" | "already">("pin");
  const [schoolCode, setSchoolCode] = useState("");
  const [pin, setPin] = useState("");
  const [classData, setClassData] = useState<any>(null);
  const [dailyQuestion, setDailyQuestion] = useState<any>(null);
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolCode.trim() || !pin.trim()) { setError("Okul kodu ve sınıf PIN'i gerekli"); return; }
    setLoading(true);
    setError("");

    const supabase = createClient();

    // Once okulu bul (RPC üzerinden)
    const { data: schoolsList } = await supabase
      .rpc("resolve_school_code", { p_code: schoolCode.trim() });

    const school = schoolsList && schoolsList.length > 0 ? schoolsList[0] : null;

    if (!school) { setError("Geçersiz okul kodu!"); setLoading(false); return; }

    // Sinifi bul (okul icinde)
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id, name, school_id")
      .eq("school_id", school.id)
      .eq("quiz_pin", pin.trim())
      .maybeSingle();

    if (clsErr || !cls) { setError("Geçersiz sınıf PIN'i! Öğretmeninize danışın."); setLoading(false); return; }
    setClassData(cls);

    // Bugünün sorusunu bul
    const today = new Date().toISOString().split("T")[0];
    const { data: daily } = await supabase
      .from("quiz_daily")
      .select("id, question_id, quiz_questions(question, answer, option_a, option_b, option_c, option_d, difficulty, category)")
      .eq("school_id", cls.school_id)
      .eq("question_date", today)
      .maybeSingle();

    if (!daily) { setError("Bugün için henüz soru seçilmemiş. Daha sonra tekrar deneyin."); setLoading(false); return; }

    // Bu sınıf zaten cevapladı mı?
    const { data: existing } = await supabase
      .from("quiz_answers")
      .select("id, answer, is_correct")
      .eq("daily_id", daily.id)
      .eq("class_id", cls.id)
      .maybeSingle();

    if (existing) {
      setResult(existing);
      setDailyQuestion(daily);
      setStep("already");
      setLoading(false);
      return;
    }

    setDailyQuestion(daily);
    setStep("question");
    setLoading(false);
  }

  async function handleSubmitAnswer() {
    const finalAnswer = selectedOption || answer;
    if (!finalAnswer.trim()) { setError("Lütfen bir cevap girin"); return; }

    setLoading(true);
    setError("");
    const supabase = createClient();

    const { data, error: ansErr } = await supabase
      .from("quiz_answers")
      .insert({
        daily_id: dailyQuestion.id,
        class_id: classData.id,
        answer: finalAnswer.trim(),
      })
      .select("id, answer, is_correct")
      .single();

    if (ansErr) {
      if (ansErr.code === "23505") {
        setError("Bu sınıf bugün zaten cevap vermiş!");
      } else {
        setError("Cevap kaydedilemedi: " + ansErr.message);
      }
    } else {
      setResult(data);
      setStep("done");
    }
    setLoading(false);
  }

  const q = dailyQuestion?.quiz_questions;
  // Supabase join'den gelen veriyi normalize et
  const questionData = Array.isArray(q) ? q[0] : q;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "'Segoe UI', sans-serif",
      padding: 20,
    }}>
      <div style={{
        background: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(20px)",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.2)",
        padding: "40px",
        maxWidth: 550,
        width: "100%",
        color: "white",
        textAlign: "center",
      }}>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Günün Sorusu</h1>

        {step === "pin" && (
          <form onSubmit={handlePinSubmit}>
            <p style={{ opacity: 0.8, marginBottom: 20, fontSize: 14 }}>
              Okul kodu ve sınıf PIN'inizi girin
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={schoolCode}
              onChange={(e) => { setSchoolCode(e.target.value.replace(/\D/g,"")); setError(""); }}
              placeholder="Okul Kodu"
              autoFocus
              style={{
                width: "100%", padding: "12px 18px", fontSize: 18,
                borderRadius: 12, border: "2px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.1)", color: "white",
                textAlign: "center", letterSpacing: 4, outline: "none", marginBottom: 10,
              }}
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g,"")); setError(""); }}
              placeholder="Sınıf PIN"
              style={{
                width: "100%", padding: "14px 18px", fontSize: 22,
                borderRadius: 12, border: "2px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.1)", color: "white",
                textAlign: "center", letterSpacing: 6, outline: "none", marginBottom: 12,
              }}
            />
            {error && <p style={{ color: "#FFD700", fontSize: 14, marginBottom: 12 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading || schoolCode.length < 4 || pin.length < 3}
              style={{
                width: "100%", padding: 14, fontSize: 16, fontWeight: 700,
                borderRadius: 12, border: "none",
                background: schoolCode.length < 4 || pin.length < 3 ? "rgba(255,255,255,0.2)" : "white",
                color: schoolCode.length < 4 || pin.length < 3 ? "rgba(255,255,255,0.5)" : "#667eea",
                cursor: schoolCode.length < 4 || pin.length < 3 ? "default" : "pointer",
              }}
            >
              {loading ? "Kontrol ediliyor..." : "Soruyu Gör"}
            </button>
          </form>
        )}

        {(step === "question" || step === "already" || step === "done") && questionData && (
          <div style={{ textAlign: "left" }}>
            <div style={{
              background: "rgba(255,255,255,0.1)", borderRadius: 12,
              padding: "14px 18px", marginBottom: 20, fontSize: 15,
            }}>
              <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>
                {classData?.name} • {questionData.difficulty === "zor" ? "🔴" : questionData.difficulty === "kolay" ? "🟢" : "🟡"} {questionData.difficulty}
                {questionData.category && ` • ${questionData.category}`}
              </div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{questionData.question}</div>
            </div>

            {/* Çoktan seçmeli varsa */}
            {questionData.option_a && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {["A", "B", "C", "D"].map((opt) => {
                  const val = questionData[`option_${opt.toLowerCase()}`];
                  if (!val) return null;
                  const isSelected = selectedOption === val;
                  return (
                    <button
                      key={opt}
                      onClick={() => { setSelectedOption(val); setAnswer(val); }}
                      disabled={step !== "question"}
                      style={{
                        textAlign: "left", padding: "12px 16px",
                        borderRadius: 10, border: isSelected ? "2px solid white" : "2px solid rgba(255,255,255,0.2)",
                        background: isSelected ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)",
                        color: "white", cursor: step === "question" ? "pointer" : "default",
                        fontSize: 14, opacity: step !== "question" ? 0.7 : 1,
                      }}
                    >
                      <strong>{opt})</strong> {val}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Direkt yazı cevabı */}
            {!questionData.option_a && step === "question" && (
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Cevabınızı yazın"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
                style={{
                  width: "100%", padding: "12px 16px", fontSize: 16,
                  borderRadius: 10, border: "2px solid rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.1)", color: "white",
                  outline: "none", marginBottom: 16,
                }}
              />
            )}

            {step === "question" && (
              <>
                {error && <p style={{ color: "#FFD700", fontSize: 14, marginBottom: 12 }}>{error}</p>}
                <button
                  onClick={handleSubmitAnswer}
                  disabled={loading}
                  style={{
                    width: "100%", padding: 14, fontSize: 16, fontWeight: 700,
                    borderRadius: 12, border: "none",
                    background: "white", color: "#667eea", cursor: "pointer",
                  }}
                >
                  {loading ? "Gönderiliyor..." : "Cevabı Gönder"}
                </button>
              </>
            )}

            {(step === "already" || step === "done") && (
              <div style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: 12, padding: "20px", textAlign: "center",
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>
                  ✉️
                </div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  Cevap Gönderildi!
                </div>
                <div style={{ fontSize: 14, opacity: 0.9, marginTop: 8 }}>
                  {step === "already" ? "Bu sınıf bugün için zaten cevap vermiş." : "Cevabınız başarıyla kaydedildi."}
                </div>
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 12 }}>
                  Doğru cevap yarın okul panosunda açıklanacaktır.
                </div>
              </div>
            )}
          </div>
        )}

        {step === "pin" && (
          <p style={{ marginTop: 20, fontSize: 11, opacity: 0.5 }}>
            Okul kodu ve sınıf PIN'inizi öğretmeninizden alabilirsiniz
          </p>
        )}
      </div>
    </div>
  );
}
