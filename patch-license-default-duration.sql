-- Okulların ilk kayıtta 1 ay ücretsiz lisans alması için default değer
-- Supabase SQL Editor'da çalıştırın
ALTER TABLE public.schools ALTER COLUMN license_expires_at SET DEFAULT (now() + interval '1 month');
