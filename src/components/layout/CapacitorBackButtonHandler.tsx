"use client";

import { useEffect } from "react";
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
      .then(({ App }) => {
        // Geri tuşu
        const backListener = App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack || window.history.length > 1) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });

        // Deep link: Google OAuth'tan dönüş (kitappaneli://auth/callback?...)
        const deepLinkListener = App.addListener("appUrlOpen", async (data) => {
          try {
            const url = new URL(data.url);

            // Sadece auth/callback deep link'lerini yakala
            if (url.protocol !== "kitappaneli:" || url.hostname !== "auth") {
              return;
            }

            const next = url.searchParams.get("next");
            const accessToken = url.searchParams.get("at");
            const refreshToken = url.searchParams.get("rt");

            // Token varsa WebView'de session'ı kur
            if (accessToken && refreshToken) {
              const supabase = createClient();
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (error) {
                console.error("setSession error:", error.message);
                router.push("/login?error=session_error");
                return;
              }
            }

            // Hedef sayfaya yönlendir
            if (next) {
              router.push(next);
            } else {
              router.push("/dashboard");
            }
          } catch {
            // Geçersiz URL, sessizce devam et
          }
        });

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
