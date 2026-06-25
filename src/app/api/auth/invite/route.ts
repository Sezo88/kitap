import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("profiles").select("role, school_id").eq("id", user.id).single();

    if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const { email, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json({ error: "E-posta ve rol zorunludur" }, { status: 400 });
    }

    // Generate a random invite code
    const inviteCode = Math.random().toString(36).substring(2, 10);

    // Invite user via Supabase (sends email)
    const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        role,
        school_id: profile.school_id,
        invite_code: inviteCode,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin")}/callback`,
    });

    if (error) {
      // Fallback: if admin API not available, just return the invite code
      return NextResponse.json({
        success: true,
        inviteCode,
        message: "Supabase admin API kullanılamadı. Kullanıcıya kayıt linkini manuel gönderin.",
      });
    }

    return NextResponse.json({ success: true, inviteCode });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Sunucu hatası" }, { status: 500 });
  }
}
