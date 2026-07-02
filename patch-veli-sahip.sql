-- Veli Telefon Sahiplik Bilgisi Ekleme
-- Supabase SQL Editor'da çalıştırın

-- 1. students tablosuna veli sahip alanları ekle
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS veli_telefon_sahip text DEFAULT NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS veli_telefon_2_sahip text DEFAULT NULL;
-- Değerler: 'Anne', 'Baba', 'Diğer' veya NULL
