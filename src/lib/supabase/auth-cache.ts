import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "./server";

/**
 * Layout tarafindan her sayfa gecisinde cagrilan, kullanici + profil bilgisini
 * getiren cache'li fonksiyon.
 *
 * Optimizasyon: Middleware JWT'nin gecerli oldugunu dogrulayip `x-user-id`
 * header'ina user ID'yi yazmissa, `auth.getUser()` ag cagrisini atlariz.
 * Bu sayede sayfa gecislerinde 1 round-trip kazanilir.
 *
 * Guvenlik notu: `headers()` Next.js server component'ten gelir, disaridan
 * enjekte edilemez. Header sadece middleware'in JWT dogrulamasindan gecer.
 */
export const getCachedUserAndProfile = cache(async () => {
  const supabase = await createClient();

  // Middleware'in fast-path'ten gectigini ve user ID'yi header'a yazdigini kontrol et
  let userIdFromHeader: string | null = null;
  try {
    const h = await headers();
    userIdFromHeader = h.get("x-user-id");
  } catch {
    // headers() sadece server component'te calisir, fallback'e dusecek
  }

  if (userIdFromHeader) {
    // Middleware zaten JWT'yi dogruladi — auth.getUser() cagrisini ATLA
    // Sadece profil sorgusu yap (tek round-trip)
    const { data: profile } = await supabase
      .from("profiles")
      .select("*, schools(name, code, feature_attendance, feature_library, feature_cleanliness, feature_lesson_schedule, feature_bell, license_expires_at)")
      .eq("id", userIdFromHeader)
      .single();

    if (profile) {
      return {
        user: { id: userIdFromHeader, email: undefined } as any,
        profile,
      };
    }
    // Profil bulunamazsa fallback'e devam et (belki silinmis)
  }

  // Fallback: tam auth akisi (session suresi dolmus, yenileme gerekli, vs.)
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, schools(name, code, feature_attendance, feature_library, feature_cleanliness, feature_lesson_schedule, feature_bell, license_expires_at)")
    .eq("id", authUser.id)
    .single();

  return { user: authUser, profile };
});
