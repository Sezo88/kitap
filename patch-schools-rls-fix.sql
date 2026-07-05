-- Okul oluşturma RLS hatasını düzeltme yaması
-- Supabase SQL Editor'da çalıştırın

DROP POLICY IF EXISTS "schools_insert" ON public.schools;
CREATE POLICY "schools_insert" ON public.schools FOR INSERT WITH CHECK (true);
