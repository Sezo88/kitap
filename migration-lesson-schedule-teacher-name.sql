-- Migration: Ders ve Nöbet Programında İsimle Kayıt (Kayıtlı Olmayan Öğretmen Desteği)
-- Tarih: 2026-09-05

-- 1. lesson_schedule tablosunda teacher_id zorunluluğunu esnetme ve teacher_name ekleme
ALTER TABLE public.lesson_schedule 
ALTER COLUMN teacher_id DROP NOT NULL;

ALTER TABLE public.lesson_schedule 
ADD COLUMN IF NOT EXISTS teacher_name text;

-- Çift öğretmenli (özel eğitim) veya grup seçmeli derslerin girilebilmesi için tekil kısıtlamasını esnet
ALTER TABLE public.lesson_schedule 
DROP CONSTRAINT IF EXISTS lesson_schedule_school_id_class_id_day_of_week_period_no_key;

-- 2. duty_schedule tablosunda teacher_id zorunluluğunu esnetme ve teacher_name ekleme
ALTER TABLE public.duty_schedule 
ALTER COLUMN teacher_id DROP NOT NULL;

ALTER TABLE public.duty_schedule 
ADD COLUMN IF NOT EXISTS teacher_name text;

-- 3. Öğretmen sisteme sonradan kayıt olduğunda derslerini ve nöbetlerini otomatik bağlayan tetikleyici (Trigger)
CREATE OR REPLACE FUNCTION public.sync_teacher_schedule_on_profile()
RETURNS trigger AS $$
BEGIN
  IF NEW.full_name IS NOT NULL AND NEW.school_id IS NOT NULL THEN
    -- Ders programındaki boş teacher_id'leri eşle
    UPDATE public.lesson_schedule
    SET teacher_id = NEW.id
    WHERE school_id = NEW.school_id
      AND teacher_id IS NULL
      AND lower(replace(replace(trim(teacher_name), ' ', ''), 'İ', 'i')) = 
          lower(replace(replace(trim(NEW.full_name), ' ', ''), 'İ', 'i'));

    -- Nöbet programındaki boş teacher_id'leri eşle
    UPDATE public.duty_schedule
    SET teacher_id = NEW.id
    WHERE school_id = NEW.school_id
      AND teacher_id IS NULL
      AND lower(replace(replace(trim(teacher_name), ' ', ''), 'İ', 'i')) = 
          lower(replace(replace(trim(NEW.full_name), ' ', ''), 'İ', 'i'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_teacher_schedule ON public.profiles;
CREATE TRIGGER trg_sync_teacher_schedule
AFTER INSERT OR UPDATE OF full_name, school_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_teacher_schedule_on_profile();
