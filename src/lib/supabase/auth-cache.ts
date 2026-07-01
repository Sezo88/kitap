import { cache } from "react";
import { createClient } from "./server";

export const getCachedUserAndProfile = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, schools(name, code)")
    .eq("id", user.id)
    .single();

  return { user, profile };
});
