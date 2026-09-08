"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { revalidatePath } from "next/cache";

export interface TahtaQuizSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
  duration: number;
  speedBonus: boolean;
  autoCloseSeconds: number;
}

export async function getTahtaQuizSettings(schoolId: string): Promise<TahtaQuizSettings> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("panel_settings")
    .select("tahta_quiz_enabled, tahta_quiz_start_time, tahta_quiz_end_time, tahta_quiz_duration, tahta_quiz_speed_bonus, tahta_quiz_auto_close_seconds")
    .eq("school_id", schoolId)
    .maybeSingle();

  return {
    enabled: data?.tahta_quiz_enabled ?? true,
    startTime: data?.tahta_quiz_start_time ?? "08:30",
    endTime: data?.tahta_quiz_end_time ?? "08:55",
    duration: data?.tahta_quiz_duration ?? 30,
    speedBonus: data?.tahta_quiz_speed_bonus ?? true,
    autoCloseSeconds: data?.tahta_quiz_auto_close_seconds ?? 15,
  };
}

export async function saveTahtaQuizSettings(schoolId: string, settings: TahtaQuizSettings) {
  const { user, profile } = await getCachedUserAndProfile();
  if (!user || !profile) return { success: false, error: "Oturum açmanız gerekiyor" };
  if (profile.role !== "super_admin" && profile.role !== "idareci") {
    return { success: false, error: "Bu işlem için yetkiniz yok" };
  }

  const supabase = createAdminClient();

  // Check if panel_settings exists for this school
  const { data: existing } = await supabase
    .from("panel_settings")
    .select("id")
    .eq("school_id", schoolId)
    .maybeSingle();

  const payload = {
    tahta_quiz_enabled: settings.enabled,
    tahta_quiz_start_time: settings.startTime,
    tahta_quiz_end_time: settings.endTime,
    tahta_quiz_duration: settings.duration,
    tahta_quiz_speed_bonus: settings.speedBonus,
    tahta_quiz_auto_close_seconds: settings.autoCloseSeconds,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("panel_settings")
      .update(payload)
      .eq("id", existing.id);

    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("panel_settings")
      .insert({
        school_id: schoolId,
        ...payload,
      });

    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/admin/quiz");
  revalidatePath("/tahta-quiz");
  return { success: true };
}

export interface QuizSubmitResult {
  success: boolean;
  error?: string;
  isCorrect?: boolean;
  correctAnswer?: string;
  pointsEarned?: number;
  totalScore?: number;
  schoolRank?: number;
  className?: string;
}

export async function submitTahtaQuizAnswer(params: {
  schoolCode: string;
  pin: string;
  answer: string;
  secondsLeft: number;
}): Promise<QuizSubmitResult> {
  const supabase = createAdminClient();

  // 1. Okulu bul
  const { data: school } = await supabase
    .from("schools")
    .select("id, name")
    .eq("code", params.schoolCode.trim())
    .maybeSingle();

  if (!school) {
    return { success: false, error: "Geçersiz okul kodu" };
  }

  // 2. Sınıfı bul
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, school_id, is_active")
    .eq("school_id", school.id)
    .eq("quiz_pin", params.pin.trim())
    .neq("is_active", false)
    .maybeSingle();

  if (!cls) {
    return { success: false, error: "Geçersiz sınıf PIN kodu" };
  }

  // 3. Bugünün sorusunu bul
  const today = new Date().toISOString().split("T")[0];
  const { data: daily } = await supabase
    .from("quiz_daily")
    .select("id, question_id, quiz_questions(question, answer)")
    .eq("school_id", school.id)
    .eq("question_date", today)
    .maybeSingle();

  if (!daily || !daily.quiz_questions) {
    return { success: false, error: "Bugün için aktif soru bulunamadı" };
  }

  // 4. Bu sınıf zaten cevap verdi mi?
  const { data: existingAns } = await supabase
    .from("quiz_answers")
    .select("id, answer, is_correct, points_awarded")
    .eq("daily_id", daily.id)
    .eq("class_id", cls.id)
    .maybeSingle();

  if (existingAns) {
    // Mevcut skoru ve sıralamayı çek
    const { rank, totalScore } = await getClassRankAndScore(school.id, cls.id);
    return {
      success: true,
      error: "Bu sınıf bugünün sorusunu zaten yanıtlamış!",
      isCorrect: existingAns.is_correct ?? false,
      pointsEarned: existingAns.points_awarded ?? 0,
      totalScore,
      schoolRank: rank,
      className: cls.name,
    };
  }

  // 5. Doğruluk ve Puanlama Hesaplama
  const qData: any = daily.quiz_questions;
  const rawExpected = (qData.answer || "").trim().toLowerCase();
  const rawGiven = (params.answer || "").trim().toLowerCase();
  const isCorrect = rawGiven === rawExpected;

  // Ayarları oku (hız bonusu açık mı?)
  const settings = await getTahtaQuizSettings(school.id);
  let points = 0;
  if (isCorrect) {
    points = 100; // Standart doğru cevap
    if (settings.speedBonus && params.secondsLeft > 0) {
      points += Math.min(params.secondsLeft, 30); // Kalan her saniye için +1 puan (max 30)
    }
  }

  // 6. Cevabı kaydet
  const { error: insErr } = await supabase
    .from("quiz_answers")
    .insert({
      daily_id: daily.id,
      class_id: cls.id,
      answer: params.answer.trim(),
      is_correct: isCorrect,
      seconds_left: Math.max(0, params.secondsLeft),
      points_awarded: points,
    });

  if (insErr) {
    if (insErr.code === "23505") {
      return { success: false, error: "Bu sınıf soruyu daha önce yanıtladı" };
    }
    return { success: false, error: "Cevap kaydedilemedi: " + insErr.message };
  }

  // 7. quiz_scores tablosundaki toplam skoru güncelle
  if (points > 0) {
    const { data: existingScore } = await supabase
      .from("quiz_scores")
      .select("score")
      .eq("school_id", school.id)
      .eq("class_id", cls.id)
      .maybeSingle();

    if (existingScore) {
      await supabase
        .from("quiz_scores")
        .update({
          score: (existingScore.score || 0) + points,
          class_name: cls.name,
          updated_at: new Date().toISOString(),
        })
        .eq("school_id", school.id)
        .eq("class_id", cls.id);
    } else {
      await supabase
        .from("quiz_scores")
        .insert({
          school_id: school.id,
          class_id: cls.id,
          class_name: cls.name,
          score: points,
        });
    }
  }

  const { rank, totalScore } = await getClassRankAndScore(school.id, cls.id);

  return {
    success: true,
    isCorrect,
    correctAnswer: qData.answer,
    pointsEarned: points,
    totalScore,
    schoolRank: rank,
    className: cls.name,
  };
}

async function getClassRankAndScore(schoolId: string, classId: string) {
  const supabase = createAdminClient();
  const { data: scores } = await supabase
    .from("quiz_scores")
    .select("class_id, score")
    .eq("school_id", schoolId)
    .order("score", { ascending: false });

  if (!scores || scores.length === 0) {
    return { rank: 1, totalScore: 0 };
  }

  const index = scores.findIndex((s) => s.class_id === classId);
  const rank = index === -1 ? scores.length + 1 : index + 1;
  const current = scores.find((s) => s.class_id === classId);

  return {
    rank,
    totalScore: current?.score || 0,
  };
}
