-- Okul Kodu ve Onay Sistemi Patch
-- Supabase SQL Editor'da çalıştırın

-- 1. profiles tablosuna status ekle
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
-- 'active' = onaylı, 'pending' = bekleyen

-- 2. schools tablosuna benzersiz kod ekle
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS code text UNIQUE;

-- Mevcut okullara kod üret (eğer varsa)
UPDATE public.schools SET code = upper(substring(md5(random()::text), 1, 6)) WHERE code IS NULL;

-- 3. Benzersiz okul kodu üreten fonksiyon
CREATE OR REPLACE FUNCTION public.generate_school_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_code text;
BEGIN
  LOOP
    new_code := upper(substring(md5(random()::text), 1, 6));
    IF NOT EXISTS (SELECT 1 FROM public.schools WHERE code = new_code) THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- 4. Pending profiller için RLS politikası
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- 5. İdareci kendi okulundaki pending profilleri görebilsin
DROP POLICY IF EXISTS "profiles_select_idareci" ON public.profiles;
CREATE POLICY "profiles_select_idareci" ON public.profiles
  FOR SELECT USING (
    public.get_my_role() = 'idareci'
    AND school_id = public.get_my_school_id()
  );

-- 6. İdareci kendi okulundaki pending profilleri onaylayabilsin
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR (
      public.get_my_role() = 'idareci'
      AND school_id = public.get_my_school_id()
    )
  );
