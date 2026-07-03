-- Doğum Tarihi Alanı Ekleme
-- Supabase SQL Editor'da çalıştırın

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS dogum_tarihi date DEFAULT NULL;
