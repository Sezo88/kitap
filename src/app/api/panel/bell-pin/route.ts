import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";

export async function POST(req: Request) {
  try {
    const { profile } = await getCachedUserAndProfile();

    if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();
    const { pin, schoolId } = body;

    const targetSchoolId = profile.role === "super_admin" ? (schoolId || profile.school_id) : profile.school_id;

    if (!targetSchoolId) {
      return NextResponse.json({ error: "Okul ID geçersiz" }, { status: 400 });
    }

    if (!pin || typeof pin !== "string" || pin.trim().length < 4) {
      return NextResponse.json({ error: "PIN en az 4 karakter olmalıdır" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("set_bell_pin", {
      p_school_id: targetSchoolId,
      p_pin: pin.trim(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Zil API PIN başarıyla güncellendi." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Bir hata oluştu" }, { status: 500 });
  }
}
