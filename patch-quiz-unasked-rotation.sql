-- Günlük Soru Seçme Fonksiyonu (Döngülü & Çakışmasız & Hafta Sonu Korumalı)
-- Supabase SQL Editor'da çalıştırın

CREATE OR REPLACE FUNCTION public.pick_daily_question(p_school_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_question_id uuid;
  v_daily_id uuid;
BEGIN
  -- Hafta sonu kontrolü (Cumartesi = 6, Pazar = 7) -> Hafta sonları soru seçilmez
  IF EXTRACT(isodow FROM CURRENT_DATE) IN (6, 7) THEN
    RETURN NULL;
  END IF;

  -- 1. Bugün için halihazırda seçilmiş soru var mı kontrol et
  SELECT id INTO v_daily_id FROM public.quiz_daily
  WHERE school_id = p_school_id AND question_date = CURRENT_DATE;

  IF v_daily_id IS NOT NULL THEN
    RETURN v_daily_id;
  END IF;

  -- 2. Daha önce hiç sorulmamış (quiz_daily'de yer almayan) aktif bir soru seçmeyi dene
  SELECT id INTO v_question_id FROM public.quiz_questions
  WHERE school_id = p_school_id 
    AND is_active = true 
    AND id NOT IN (
      SELECT DISTINCT question_id 
      FROM public.quiz_daily 
      WHERE school_id = p_school_id AND question_id IS NOT NULL
    )
  ORDER BY random() 
  LIMIT 1;

  -- 3. Eğer sorulmamış soru kalmadıysa, havuzu sıfırla (tüm aktif sorular arasından rastgele seç)
  IF v_question_id IS NULL THEN
    SELECT id INTO v_question_id FROM public.quiz_questions
    WHERE school_id = p_school_id AND is_active = true
    ORDER BY random() 
    LIMIT 1;
  END IF;

  IF v_question_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 4. Seçilen soruyu bugünün tarihiyle kaydet
  INSERT INTO public.quiz_daily (school_id, question_id, question_date)
  VALUES (p_school_id, v_question_id, CURRENT_DATE)
  RETURNING id INTO v_daily_id;

  RETURN v_daily_id;
END;
$$;
