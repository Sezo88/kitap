import { createAdminClient } from "@/lib/supabase/admin";
import { netgsmAdapter } from "./providers/netgsm";
import { iletimMerkeziAdapter } from "./providers/iletim-merkezi";
import { vatanSmsAdapter } from "./providers/vatan-sms";
import { customAdapterSendSms } from "./providers/custom";
import type { SmsResult } from "./types";
import type { SmsProviderName, SmsMessageType } from "@/lib/types/database";

/**
 * SMS gönderim ana fonksiyonu.
 * 1. Okulun SMS provider ayarlarını admin client ile okur
 * 2. Doğru adapter'ı seçer
 * 3. SMS'i gönderir
 * 4. sms_logs'a kaydeder
 *
 * SADECE SERVER TARAFINDA çağrılmalı (API route / Server Action)
 */
export async function sendSms(params: {
  schoolId: string;
  studentId: string;
  attendanceLogId?: string | null;
  phoneNumber: string;
  messageBody: string;
  messageType: SmsMessageType;
}): Promise<SmsResult> {
  const { schoolId, studentId, attendanceLogId, phoneNumber, messageBody, messageType } = params;
  const admin = createAdminClient();

  // 1. Provider ayarlarını oku
  const { data: settings, error: settingsError } = await admin
    .from("sms_provider_settings")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .single();

  if (settingsError || !settings) {
    // Log kaydı oluştur — failed
    await admin.from("sms_logs").insert({
      student_id: studentId,
      attendance_log_id: attendanceLogId || null,
      phone_number: phoneNumber,
      message_type: messageType,
      message_body: messageBody,
      status: "failed",
      provider_response: { error: "SMS sağlayıcı ayarları bulunamadı veya pasif" },
    });
    return { success: false, errorMessage: "SMS sağlayıcı ayarları bulunamadı veya pasif" };
  }

  // 2. Pending log kaydı oluştur
  const { data: logEntry } = await admin
    .from("sms_logs")
    .insert({
      student_id: studentId,
      attendance_log_id: attendanceLogId || null,
      phone_number: phoneNumber,
      message_type: messageType,
      message_body: messageBody,
      status: "pending",
    })
    .select("id")
    .single();

  // 3. Doğru adapter'ı seç ve gönder
  let result: SmsResult;
  const providerName = settings.provider_name as SmsProviderName;
  const adapterParams = {
    phone: phoneNumber,
    message: messageBody,
    apiKey: settings.api_key,
    apiSecret: settings.api_secret,
    senderId: settings.sender_id,
    apiBaseUrl: settings.api_base_url,
  };

  try {
    switch (providerName) {
      case "netgsm":
        result = await netgsmAdapter.sendSms(adapterParams);
        break;
      case "iletim_merkezi":
        result = await iletimMerkeziAdapter.sendSms(adapterParams);
        break;
      case "vatan_sms":
        result = await vatanSmsAdapter.sendSms(adapterParams);
        break;
      case "custom":
        result = await customAdapterSendSms({
          ...adapterParams,
          apiBaseUrl: settings.api_base_url || "",
          httpMethod: settings.http_method as "GET" | "POST",
          headerTemplate: settings.header_template as Record<string, string> | null,
          bodyTemplate: settings.body_template,
        });
        break;
      default:
        result = { success: false, errorMessage: `Bilinmeyen sağlayıcı: ${providerName}` };
    }
  } catch (err: any) {
    result = { success: false, errorMessage: `SMS gönderim hatası: ${err.message}`, providerResponse: { error: err.message } };
  }

  // 4. Log kaydını güncelle
  if (logEntry?.id) {
    await admin
      .from("sms_logs")
      .update({
        status: result.success ? "sent" : "failed",
        provider_response: result.providerResponse || null,
        sent_at: result.success ? new Date().toISOString() : null,
      })
      .eq("id", logEntry.id);
  }

  return result;
}

/**
 * Devamsızlık SMS mesajını oluşturur
 */
export function buildAbsenceMessage(studentName: string, date: string, lessonNo?: number): string {
  const dateStr = new Date(date).toLocaleDateString("tr-TR");
  const lessonStr = lessonNo ? ` ${lessonNo}. derse` : "";
  return `Sayın Veli, öğrenciniz ${studentName} ${dateStr} tarihinde${lessonStr} gelmemiştir. Bilginize.`;
}

/**
 * Düzeltme SMS mesajını oluşturur
 */
export function buildCorrectionMessage(studentName: string): string {
  return `Sayın Veli, öğrenciniz ${studentName} okula gelmiştir. Önceki mesajımızı dikkate almayınız.`;
}
