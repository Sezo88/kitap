-- ==============================================================================
-- AKILLI TAHTA GÜNÜN SORUSU & YARIŞMA SİSTEMİ AYARLARI
-- ==============================================================================

-- 1. panel_settings tablosuna tahta quiz ayarları kolonlarını ekle
ALTER TABLE public.panel_settings
ADD COLUMN IF NOT EXISTS tahta_quiz_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS tahta_quiz_start_time text NOT NULL DEFAULT '08:30',
ADD COLUMN IF NOT EXISTS tahta_quiz_end_time text NOT NULL DEFAULT '08:55',
ADD COLUMN IF NOT EXISTS tahta_quiz_duration int NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS tahta_quiz_speed_bonus boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS tahta_quiz_auto_close_seconds int NOT NULL DEFAULT 15;

-- 2. quiz_answers tablosuna hız puanı ve kalan saniye kolonlarını ekle
ALTER TABLE public.quiz_answers
ADD COLUMN IF NOT EXISTS seconds_left int DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_awarded int DEFAULT 0;

-- 3. quiz_scores tablosunda skor puan bazlı tutulabilsin diye kontrol
-- (Zaten score kolonu mevcuttur)

-- 4. Okul koduna göre ayarları okumak için genel RPC fonksiyonu
CREATE OR REPLACE FUNCTION public.get_tahta_quiz_config(p_school_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_school_id uuid;
  v_school_name text;
  v_settings record;
BEGIN
  SELECT id, name INTO v_school_id, v_school_name
  FROM public.schools
  WHERE code = p_school_code;

  IF v_school_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Okul bulunamadı');
  END IF;

  SELECT 
    coalesce(tahta_quiz_enabled, true) as enabled,
    coalesce(tahta_quiz_start_time, '08:30') as start_time,
    coalesce(tahta_quiz_end_time, '08:55') as end_time,
    coalesce(tahta_quiz_duration, 30) as duration,
    coalesce(tahta_quiz_speed_bonus, true) as speed_bonus,
    coalesce(tahta_quiz_auto_close_seconds, 15) as auto_close_seconds
  INTO v_settings
  FROM public.panel_settings
  WHERE school_id = v_school_id;

  RETURN json_build_object(
    'success', true,
    'school_id', v_school_id,
    'school_name', v_school_name,
    'school_code', p_school_code,
    'enabled', coalesce(v_settings.enabled, true),
    'start_time', coalesce(v_settings.start_time, '08:30'),
    'end_time', coalesce(v_settings.end_time, '08:55'),
    'duration', coalesce(v_settings.duration, 30),
    'speed_bonus', coalesce(v_settings.speed_bonus, true),
    'auto_close_seconds', coalesce(v_settings.auto_close_seconds, 15)
  );
END;
$$;
