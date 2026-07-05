-- Süper Admin için okul silme (DELETE) RLS politikasını ekleme yaması
-- Supabase SQL Editor'da çalıştırın

DROP POLICY IF EXISTS "schools_delete_super_admin" ON public.schools;
CREATE POLICY "schools_delete_super_admin" ON public.schools 
  FOR DELETE USING (public.get_my_role() = 'super_admin');
