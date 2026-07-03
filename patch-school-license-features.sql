-- Okul Lisans Özellikleri Tablo Güncellemesi
-- Supabase SQL Editor'da çalıştırın

-- schools tablosuna lisans kontrol sütunları ekle
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_attendance boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_library boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_cleanliness boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_lesson_schedule boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_bell boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS license_expires_at timestamptz DEFAULT NULL;

-- Süper adminler için tüm okulları görme ve güncelleme RLS politikası
DROP POLICY IF EXISTS "schools_select_super_admin" ON public.schools;
CREATE POLICY "schools_select_super_admin" ON public.schools
  FOR SELECT USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "schools_update_super_admin" ON public.schools;
CREATE POLICY "schools_update_super_admin" ON public.schools
  FOR UPDATE USING (public.get_my_role() = 'super_admin');
