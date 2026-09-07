-- ==============================================================================
-- 1. CLASSES (SINIFLAR) TABLOSUNA is_active KOLONU EKLEME
-- ==============================================================================
ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_classes_is_active ON public.classes(school_id, is_active);

-- ==============================================================================
-- 2. TÜM ÖĞRENCİLERİ TEMİZLEME (Yeni Sezon Öncesi Sıfırlama)
-- ON DELETE CASCADE sayesinde bağlı reading_logs, attendance_logs, student_books silinir.
-- ==============================================================================
DELETE FROM public.students;

-- ==============================================================================
-- 3. HATALI VE MÜKERRER SINIFLARI TEMİZLEME
-- ==============================================================================
-- Hatalı açılmış olan 5-A sınıfını sil (Zaten 5/A sınıfı mevcuttur)
DELETE FROM public.classes WHERE name = '5-A';

-- İçi ve ders programı boş olan mükerrer sınıfları sil
DELETE FROM public.classes 
WHERE name = 'HAFİF ZİHİNSEL' 
  AND NOT EXISTS (SELECT 1 FROM public.lesson_schedule WHERE class_id = classes.id);

DELETE FROM public.classes 
WHERE name = 'ORTAAĞIR' 
  AND NOT EXISTS (SELECT 1 FROM public.lesson_schedule WHERE class_id = classes.id);

-- ==============================================================================
-- 4. BU YIL LİSTEDE OLMAYAN ESKİ SINIFLARI PASİFE ALMA (8/C, 8/D vb.)
-- Sınıflar sistemden silinmez (geçmiş kayıtlar korunur) ama hiçbir ekranda görünmez.
-- ==============================================================================
UPDATE public.classes 
SET is_active = false 
WHERE name IN ('8/C', '8/D', 'HAFİF ZİHİNSEL', 'ORTAAĞIR');

-- Güncel sınıfları aktif yap
UPDATE public.classes 
SET is_active = true 
WHERE name NOT IN ('8/C', '8/D', '5-A', 'HAFİF ZİHİNSEL', 'ORTAAĞIR');

-- ==============================================================================
-- 5. DERS YÖNETİMİNDEKİ MÜKERRER VE ATIL DERSLERİ TEMİZLEME
-- Herhangi bir ders programı veya proje kaydı bulunmayan fazlalık dersleri siler.
-- ==============================================================================
DELETE FROM public.subjects 
WHERE NOT EXISTS (SELECT 1 FROM public.student_projects WHERE subject_id = subjects.id)
  AND NOT EXISTS (SELECT 1 FROM public.lesson_schedule WHERE subject_id = subjects.id);

-- ==============================================================================
-- 6. KONTROL SORGUSU (Son Durumu Görmek İçin)
-- ==============================================================================
SELECT 
  name as sinif_adi, 
  grade_level as kademe, 
  is_active as aktif_mi,
  (SELECT count(*) FROM public.lesson_schedule WHERE class_id = classes.id) as ders_programi_sayisi
FROM public.classes 
ORDER BY is_active DESC, name;

SELECT name as ders_adi FROM public.subjects ORDER BY name;
