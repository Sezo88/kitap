import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service role key ile admin Supabase client oluşturur.
 * RLS'yi bypass eder — SADECE server tarafında kullanılmalı!
 * API anahtarlarını okumak, SMS logları yazmak vb. için kullanılır.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY env değişkenleri tanımlı olmalı"
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
