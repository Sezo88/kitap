import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function parseJwt(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

function getSessionFromCookies(request: NextRequest) {
  const cookies = request.cookies.getAll();
  const supabaseCookies = cookies.filter(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );
  if (supabaseCookies.length === 0) return null;

  const baseNames = Array.from(
    new Set(supabaseCookies.map((c) => c.name.replace(/\.\d+$/, "")))
  );

  for (const baseName of baseNames) {
    const chunks = supabaseCookies
      .filter((c) => c.name.startsWith(baseName))
      .sort((a, b) => {
        const aNum = parseInt(a.name.split(".").pop() || "0", 10);
        const bNum = parseInt(b.name.split(".").pop() || "0", 10);
        return aNum - bNum;
      });

    const rawValue = chunks.map((c) => c.value).join("");
    try {
      const decodedValue = rawValue.startsWith("%")
        ? decodeURIComponent(rawValue)
        : rawValue;
      return JSON.parse(decodedValue);
    } catch (e) {
      // ignore and try next
    }
  }
  return null;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const publicPaths = ["/login", "/register", "/callback"];
  const isPublicPath = publicPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  // 1. Session check from cookies first
  const session = getSessionFromCookies(request);
  if (session && session.access_token) {
    const payload = parseJwt(session.access_token);
    if (payload && payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      // If session is valid for more than 5 minutes, proceed without calling Supabase API
      if (payload.exp - now > 300) {
        if (session.user) {
          return supabaseResponse;
        }
      }
    }
  }

  // 2. Fallback to full Supabase flow if session is missing or near expiry
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

