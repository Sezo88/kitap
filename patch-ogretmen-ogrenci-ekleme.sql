-- Öğretmenlere öğrenci ekleme yetkisi veren patch
-- Supabase SQL Editor'da çalıştırın

DROP POLICY IF EXISTS "İdareci ve super admin öğrenci ekleyebilir" ON public.students;

CREATE POLICY "Öğretmen, idareci ve super admin öğrenci ekleyebilir" ON public.students
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'idareci', 'ogretmen')
  );
