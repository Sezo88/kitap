import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const schoolCode = searchParams.get("okul_kodu") || searchParams.get("code") || "";
  const className = searchParams.get("sinif") || "";

  if (!schoolCode.trim()) {
    return NextResponse.json(
      { success: false, error: "okul_kodu parametresi gerekli" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 1. Okulu bul
  const { data: school } = await supabase
    .from("schools")
    .select("id, name, code")
    .eq("code", schoolCode.trim())
    .maybeSingle();

  if (!school) {
    return NextResponse.json(
      { success: false, error: "Okul bulunamadı" },
      { status: 404 }
    );
  }

  // 2. Ayarları çek
  const { data: settings } = await supabase
    .from("panel_settings")
    .select("tahta_quiz_enabled, tahta_quiz_start_time, tahta_quiz_end_time, tahta_quiz_duration, tahta_quiz_speed_bonus, tahta_quiz_auto_close_seconds")
    .eq("school_id", school.id)
    .maybeSingle();

  const enabled = settings?.tahta_quiz_enabled ?? true;
  const startTimeStr = settings?.tahta_quiz_start_time ?? "08:30";
  const endTimeStr = settings?.tahta_quiz_end_time ?? "08:55";
  const duration = settings?.tahta_quiz_duration ?? 30;
  const autoCloseSeconds = settings?.tahta_quiz_auto_close_seconds ?? 15;

  // 3. Zaman kontrolü (Türkiye Saati: UTC+3)
  const now = new Date();
  const trFormatter = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = trFormatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  const second = parseInt(parts.find((p) => p.type === "second")?.value || "0", 10);
  const currentTotalSeconds = hour * 3600 + minute * 60 + second;

  const [sH, sM] = startTimeStr.split(":").map((v: string) => parseInt(v, 10));
  const startTotalSeconds = sH * 3600 + sM * 60;

  const [eH, eM] = endTimeStr.split(":").map((v: string) => parseInt(v, 10));
  const endTotalSeconds = eH * 3600 + eM * 60;

  // Hafta sonu kontrolü (Cumartesi = 6, Pazar = 0)
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const inWindow =
    enabled &&
    !isWeekend &&
    currentTotalSeconds >= startTotalSeconds &&
    currentTotalSeconds <= endTotalSeconds;

  let secondsUntilWindow = 0;
  if (currentTotalSeconds < startTotalSeconds) {
    secondsUntilWindow = startTotalSeconds - currentTotalSeconds;
  } else if (currentTotalSeconds > endTotalSeconds) {
    // Yarınki başlangıç zamanı (yaklaşık 24 saat fark)
    secondsUntilWindow = 86400 - currentTotalSeconds + startTotalSeconds;
  }

  // Quiz URL
  const origin = request.nextUrl.origin;
  const quizUrlParams = new URLSearchParams();
  quizUrlParams.set("okul", school.code);
  if (className) quizUrlParams.set("sinif", className);
  const quizUrl = `${origin}/tahta-quiz?${quizUrlParams.toString()}`;

  return NextResponse.json({
    success: true,
    school_name: school.name,
    school_code: school.code,
    enabled,
    is_weekend: isWeekend,
    in_window: inWindow,
    start_time: startTimeStr,
    end_time: endTimeStr,
    duration_seconds: duration,
    auto_close_seconds: autoCloseSeconds,
    seconds_until_window: secondsUntilWindow,
    server_time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
    quiz_url: quizUrl,
    version: "1.0.0",
  });
}
