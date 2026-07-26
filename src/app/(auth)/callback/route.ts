import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const isMobile = searchParams.get("mobile") === "1";

  const supabase = await createClient();

  let currentSession: { access_token: string; refresh_token: string } | null = null;

  // Email/PW sifirlama veya OAuth icin code exchange
  if (code) {
    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return isMobile
        ? mobileRedirect("auth_callback_error")
        : NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
    }
    if (exchangeData?.session) {
      currentSession = {
        access_token: exchangeData.session.access_token,
        refresh_token: exchangeData.session.refresh_token,
      };
    }
  }

  // Kullanıcı oturumunu kontrol et
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return isMobile
      ? mobileRedirect("no_user")
      : NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
  }

  // Profil kontrolü (şifre sıfırlama hariç)
  if (!next.startsWith("/reset-password")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, role, school_id")
      .eq("id", user.id)
      .maybeSingle();

    const isIncomplete =
      !profile ||
      !profile.full_name ||
      profile.full_name === "Yeni Kullanıcı" ||
      (profile.role !== "super_admin" && !profile.school_id);

    if (isIncomplete) {
      return isMobile
        ? mobileRedirect(
            "complete-registration",
            currentSession?.access_token,
            currentSession?.refresh_token
          )
        : NextResponse.redirect(`${origin}/complete-registration`);
    }
  }

  // Mobile (Capacitor): token'ları deep link ile uygulamaya taşı
  if (isMobile) {
    if (!currentSession) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        currentSession = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        };
      }
    }

    if (currentSession) {
      return mobileRedirect(
        next,
        currentSession.access_token,
        currentSession.refresh_token
      );
    }
    return mobileRedirect(next);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

/**
 * Mobile (Capacitor) için: deep link HTML sayfası döndür.
 * 302 redirect yerine HTML kullanıyoruz çünkü Chrome Custom Tabs
 * custom scheme redirect'lerini JavaScript olmadan engelleyebiliyor.
 */
function mobileRedirect(
  pathOrError: string,
  accessToken?: string,
  refreshToken?: string
): NextResponse {
  const isError = ["auth_callback_error", "no_user"].includes(pathOrError);
  const nextPath = isError
    ? `/login?error=${pathOrError}`
    : pathOrError.startsWith("/")
      ? pathOrError
      : `/${pathOrError}`;

  const params = new URLSearchParams();
  params.set("next", nextPath);
  if (accessToken) params.set("at", accessToken);
  if (refreshToken) params.set("rt", refreshToken);

  const deepLink = `kitappaneli://auth/callback?${params.toString()}`;

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Giriş Başarılı</title>
  <style>
    body { font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0e1a; color: #fff; text-align: center; }
    a { color: #60a5fa; }
  </style>
</head>
<body>
  <div>
    <p>Giriş başarılı, uygulamaya dönülüyor…</p>
    <p style="font-size:0.85rem;opacity:0.7">Yönlendirme olmazsa aşağıdaki bağlantıya tıklayın:</p>
    <a href="${deepLink.replace(/"/g, '&quot;')}">Uygulamaya Dön</a>
  </div>
  <script>
    window.location.href = "${deepLink.replace(/"/g, '\\"')}";
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
