-- Rol atama sorununu düzelten patch
-- Supabase SQL Editor'da çalıştırın

-- 1. Trigger'ı güncelle: role'ü user_metadata'dan okusun
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'ogretmen')
  );
  RETURN NEW;
END;
$$;

-- 2. Mevcut idareci kullanıcısının rolünü düzelt (email'i değiştirin)
-- UPDATE public.profiles SET role = 'idareci'
-- WHERE id IN (SELECT id FROM auth.users WHERE email = 'idareci@ornek.com');

-- 3. Öğretmene öğrenci ekleme yetkisi
DROP POLICY IF EXISTS "İdareci ve super admin öğrenci ekleyebilir" ON public.students;

CREATE POLICY "Öğretmen, idareci ve super admin öğrenci ekleyebilir" ON public.students
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'idareci', 'ogretmen')
  );
