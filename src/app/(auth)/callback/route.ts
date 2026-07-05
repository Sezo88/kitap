import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  // Email/PW sifirlama vs icin code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // OAuth veya mevcut session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);

  // Google ile giris yapmissa direkt kayit tamamlama sayfasina git
  // (trigger bos profil olusturmus olabilir, complete-registration halledecek)
  const isOAuth = user.app_metadata?.provider === "google";
  if (isOAuth) return NextResponse.redirect(`${origin}/complete-registration`);

  // Email ile giris — profile kontrol et
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, school_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.full_name || !profile.school_id) {
    return NextResponse.redirect(`${origin}/complete-registration`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
