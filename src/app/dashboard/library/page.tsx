import { createClient } from "@/lib/supabase/server";
import { BookList } from "@/components/library/book-list";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  const schoolFilter = profile?.role === "super_admin" ? {} : { school_id: profile?.school_id };
  const { data: books } = await supabase.from("books").select("*").match(schoolFilter).order("title");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Kütüphane</h2>
      <BookList books={books || []} schoolId={profile?.school_id || ""} userId={user!.id} />
    </div>
  );
}
