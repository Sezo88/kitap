import { NextResponse } from "next/server";
import { sendSms } from "@/lib/sms/send-sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/sms/test
 * İdareci panelinden test SMS gönderimi.
 * Body: { phone: string, schoolId: string }
 */
export async function POST(request: Request) {
  try {
    // Auth kontrolü
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();

    if (!profile || !["idareci", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
    }

    const { phone, schoolId } = await request.json();

    if (!phone || !schoolId) {
      return NextResponse.json({ error: "Telefon ve okul ID gerekli" }, { status: 400 });
    }

    // Test SMS gönder — fake student ID kullan
    const result = await sendSms({
      schoolId,
      studentId: "00000000-0000-0000-0000-000000000000", // Placeholder for test
      phoneNumber: phone,
      messageBody: "Bu bir test mesajıdır. SMS entegrasyonunuz başarılı şekilde yapılandırılmıştır.",
      messageType: "test",
    });

    // Provider settings'teki test sonucunu güncelle
    const admin = createAdminClient();
    await admin
      .from("sms_provider_settings")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_result: result.success ? "Başarılı" : (result.errorMessage || "Başarısız"),
      })
      .eq("school_id", schoolId);

    return NextResponse.json({
      success: result.success,
      message: result.success ? "Test SMS başarıyla gönderildi" : (result.errorMessage || "SMS gönderilemedi"),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
