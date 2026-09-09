-- ==============================================================================
-- OKUL ÖĞRETMEN MENÜ VE SAYFA YETKİLERİ SÜTUNU
-- ==============================================================================

-- 1. schools tablosuna teacher_permissions jsonb kolonunu ekle
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS teacher_permissions jsonb DEFAULT '{}'::jsonb;

-- 2. Kontrol sorgusu (başarıyla eklendiğini doğrulamak için):
SELECT id, name, code, teacher_permissions 
FROM public.schools 
LIMIT 5;
