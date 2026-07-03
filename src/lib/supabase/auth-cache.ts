import { cache } from "react";
import { createClient } from "./server";

export const getCachedUserAndProfile = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, schools(name, code, feature_attendance, feature_library, feature_cleanliness, feature_lesson_schedule, feature_bell)")
    .eq("id", user.id)
    .single();

  return { user, profile };
});
