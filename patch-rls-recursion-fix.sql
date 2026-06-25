-- RLS Sonsuz Döngü Düzeltmesi
-- Supabase SQL Editor'da çalıştırın

-- 1. Güvenli rol okuma fonksiyonu (RLS bypass)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Güvenli school_id okuma fonksiyonu (RLS bypass)
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- PROFILES politikalarını yeniden oluştur
-- ============================================================

-- Önce tüm profile politikalarını sil
DROP POLICY IF EXISTS "Kullanıcı kendi profilini görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Super admin tüm profilleri görebilir" ON public.profiles;
DROP POLICY IF EXISTS "İdareci kendi okulundaki profilleri görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Öğretmen kendi sınıfındaki profilleri görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcı kendi profilini güncelleyebilir" ON public.profiles;
DROP POLICY IF EXISTS "Yeni kullanıcı profili oluşturabilir" ON public.profiles;

-- Yeni politikalar (get_my_role() ile)
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_super_admin" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'super_admin');

CREATE POLICY "profiles_select_idareci" ON public.profiles
  FOR SELECT USING (
    public.get_my_role() = 'idareci'
    AND school_id = public.get_my_school_id()
  );

CREATE POLICY "profiles_select_ogretmen" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'ogretmen');

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ============================================================
-- SCHOOLS politikalarını yeniden oluştur
-- ============================================================

DROP POLICY IF EXISTS "Herkes kendi okulunu görebilir" ON public.schools;
DROP POLICY IF EXISTS "Super admin okul oluşturabilir" ON public.schools;
DROP POLICY IF EXISTS "Super admin okul güncelleyebilir" ON public.schools;

CREATE POLICY "schools_select" ON public.schools
  FOR SELECT USING (
    id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "schools_insert" ON public.schools
  FOR INSERT WITH CHECK (
    public.get_my_role() = 'super_admin'
  );

CREATE POLICY "schools_update" ON public.schools
  FOR UPDATE USING (public.get_my_role() = 'super_admin');

-- ============================================================
-- CLASSES politikalarını yeniden oluştur
-- ============================================================

DROP POLICY IF EXISTS "Okul üyeleri sınıfları görebilir" ON public.classes;
DROP POLICY IF EXISTS "İdareci ve super admin sınıf oluşturabilir" ON public.classes;
DROP POLICY IF EXISTS "İdareci ve super admin sınıf güncelleyebilir" ON public.classes;
DROP POLICY IF EXISTS "İdareci ve super admin sınıf silebilir" ON public.classes;

CREATE POLICY "classes_select" ON public.classes
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "classes_insert" ON public.classes
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('super_admin', 'idareci')
  );

CREATE POLICY "classes_update" ON public.classes
  FOR UPDATE USING (
    public.get_my_role() IN ('super_admin', 'idareci')
  );

CREATE POLICY "classes_delete" ON public.classes
  FOR DELETE USING (
    public.get_my_role() IN ('super_admin', 'idareci')
  );

-- ============================================================
-- ÖĞRENCİ INSERT politikası (öğretmen dahil)
-- ============================================================

DROP POLICY IF EXISTS "İdareci ve super admin öğrenci ekleyebilir" ON public.students;
DROP POLICY IF EXISTS "Öğretmen, idareci ve super admin öğrenci ekleyebilir" ON public.students;

CREATE POLICY "students_insert" ON public.students
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen')
  );

-- ============================================================
-- READING_LOGS INSERT politikası
-- ============================================================

DROP POLICY IF EXISTS "Öğretmen kendi sınıfındaki logları ekleyebilir" ON public.reading_logs;

CREATE POLICY "reading_logs_insert" ON public.reading_logs
  FOR INSERT WITH CHECK (
    marked_by = auth.uid()
    AND public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen')
  );
