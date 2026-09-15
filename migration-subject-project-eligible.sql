-- ============================================================
-- DERS YÖNETİMİ: PROJE ALINABİLİR DERS SEÇENEĞİ
-- ============================================================
-- Proje kısmındaki ders kalabalığını önlemek ve her dersten proje
-- alınmasını engellemek için subjects tablosuna is_project_eligible eklenir.
-- Varsayılan değer true'dur. İdareci istediği dersleri Ders Yönetimi
-- sayfasından kapatabilir.

ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS is_project_eligible boolean DEFAULT true;

-- Mevcut tüm derslerin başlangıçta proje alınabilir olmasını sağla
UPDATE public.subjects
SET is_project_eligible = true
WHERE is_project_eligible IS NULL;
