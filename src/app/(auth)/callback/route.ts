import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  // Email/PW sifirlama veya OAuth icin code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
    }
  }

  // Kullanıcı oturumunu kontrol et
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);

  // Şifre sıfırlama akışında profil kontrolünü atla (şifre değiştikten sonra dashboard layout'u zaten yakalayacak)
  if (next.startsWith("/reset-password")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Profil kontrolü
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, school_id")
    .eq("id", user.id)
    .maybeSingle();

  // Eğer profil yoksa veya okul_id / ad_soyad bilgileri eksikse (super_admin hariç)
  const isIncomplete = !profile || 
                       !profile.full_name || 
                       profile.full_name === "Yeni Kullanıcı" || 
                       (profile.role !== "super_admin" && !profile.school_id);

  if (isIncomplete) {
    return NextResponse.redirect(`${origin}/complete-registration`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
