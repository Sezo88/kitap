"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * CapacitorBackButtonHandler
 *
 * Android Capacitor WebView içinde:
 * 1. Fiziksel/gesture geri tuşu → uygulamayı kapatmak yerine sayfa geçmişinde gezinir.
 * 2. Status bar rengini koyu tema ile uyumlu olacak şekilde ayarlar.
 * 3. Google OAuth sonrası deep link (kitappaneli://) ile uygulamaya geri dönüşü yakalar
 *    ve token'ları WebView'de session'a dönüştürür.
 *
 * Sadece Capacitor WebView içinde çalışır; tarayıcıda hiçbir etkisi olmaz.
 */
export default function CapacitorBackButtonHandler() {
  const router = useRouter();
  const deepLinkProcessed = useRef(false);

  useEffect(() => {
    // Guard: yalnızca Capacitor ortamında çalış
    if (typeof window === "undefined" || !("Capacitor" in window)) {
      return;
    }

    const cleanups: (() => void)[] = [];

    // 1. Status bar rengi — koyu tema ile uyumlu
    import("@capacitor/status-bar")
      .then(({ StatusBar, Style }) => {
        StatusBar.setBackgroundColor({ color: "#0a0e1a" }).catch(() => {});
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      })
      .catch(() => {});

    // 2. Android geri tuşu + deep link handler
    import("@capacitor/app")
      .then(async ({ App }) => {
        // Geri tuşu
        const backListener = await App.addListener(
          "backButton",
          ({ canGoBack }) => {
            if (canGoBack || window.history.length > 1) {
              window.history.back();
            } else {
              App.exitApp();
            }
          }
        );

        // Deep link: Google OAuth'tan dönüş (kitappaneli://auth/callback?...)
        const deepLinkListener = await App.addListener(
          "appUrlOpen",
          async (data) => {
            // Tekrar işlemeyi engelle (döngü koruması)
            if (deepLinkProcessed.current) return;

            try {
              const url = new URL(data.url);

              // Sadece auth/callback deep link'lerini yakala
              if (
                url.protocol !== "kitappaneli:" ||
                url.hostname !== "auth"
              ) {
                return;
              }

              deepLinkProcessed.current = true;

              const next = url.searchParams.get("next");
              const accessToken = url.searchParams.get("at");
              const refreshToken = url.searchParams.get("rt");

              // Token varsa WebView'de session'ı kur
              if (accessToken && refreshToken) {
                const supabase = createClient();
                
                // Cookie'ye de manuel yazalım ki Next.js Middleware/SSR hemen algılasın
                try {
                  const maxAge = 60 * 60 * 24 * 365; // 1 yıl
                  const tokenObj = JSON.stringify({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                  });
                  document.cookie = `sb-oyp-auth-token=${encodeURIComponent(tokenObj)}; path=/; max-age=${maxAge}; SameSite=Lax`;
                } catch {
                  // Cookie hatası olursa devam et
                }

                const { error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });

                if (error) {
                  console.error("setSession error:", error.message);
                  deepLinkProcessed.current = false;
                  window.location.replace("/login?error=session_error");
                  return;
                }
              }

              // Chrome Custom Tab'ı kapat (uygulamaya geri dönüşü tamamla)
              import("@capacitor/browser")
                .then(({ Browser }) => Browser.close().catch(() => {}))
                .catch(() => {});

              // Hedef sayfaya tam yönlendirme ile git (state/cookie yenilensin)
              const targetUrl = next && next.startsWith("/") ? next : "/dashboard";
              window.location.replace(targetUrl);
            } catch (err) {
              deepLinkProcessed.current = false;
            }
          }
        );

        cleanups.push(() => {
          backListener.remove();
          deepLinkListener.remove();
        });
      })
      .catch(() => {});

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [router]);

  return null;
}
