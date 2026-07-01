import { NextResponse } from "next/server";
import { sendSms, buildAbsenceMessage, buildCorrectionMessage } from "@/lib/sms/send-sms";
import { createClient } from "@/lib/supabase/server";
import type { SmsMessageType } from "@/lib/types/database";

/**
 * POST /api/sms/send
 * Yoklama kaydından SMS tetikleme.
 * Body: {
 *   attendanceLogId: string,
 *   studentId: string,
 *   studentName: string,
 *   phoneNumber: string,
 *   schoolId: string,
 *   messageType: "absence_alert" | "correction_alert",
 *   logDate: string,
 *   lessonNo?: number,
 * }
 */
export async function POST(request: Request) {
  try {
    // Auth kontrolü
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const body = await request.json();
    const { attendanceLogId, studentId, studentName, phoneNumber, schoolId, messageType, logDate, lessonNo } = body;

    if (!studentId || !phoneNumber || !schoolId || !messageType) {
      return NextResponse.json({ error: "Eksik parametreler" }, { status: 400 });
    }

    // Mesaj oluştur
    let messageBody: string;
    if (messageType === "absence_alert") {
      messageBody = buildAbsenceMessage(studentName, logDate, lessonNo);
    } else if (messageType === "correction_alert") {
      messageBody = buildCorrectionMessage(studentName);
    } else {
      return NextResponse.json({ error: "Geçersiz mesaj tipi" }, { status: 400 });
    }

    // SMS gönder (asenkron — client'ı bloklamaz)
    const result = await sendSms({
      schoolId,
      studentId,
      attendanceLogId,
      phoneNumber,
      messageBody,
      messageType: messageType as SmsMessageType,
    });

    return NextResponse.json({
      success: result.success,
      message: result.success ? "SMS gönderildi" : (result.errorMessage || "SMS gönderilemedi"),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
