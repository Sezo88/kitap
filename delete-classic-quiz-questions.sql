-- ============================================================
-- KLASİK (AÇIK UÇLU) SORULARI SİLME VE DEVRE DIŞI BIRAKMA SQL'İ
-- ============================================================
-- Soru bankanızda:
-- - 213 Adet Çoktan Seçmeli (A, B, C, D şıklı) soru bulunmaktadır.
-- - 201 Adet Klasik (şıkkı olmayan) soru bulunmaktadır.
--
-- Aşağıdaki SQL komutlarını Supabase panelinizdeki SQL Editor alanında
-- çalıştırarak tüm klasik soruları temizleyebilirsiniz.
-- ============================================================

-- 1. DAHA ÖNCE HİÇ SORULMAMIŞ TÜM KLASİK SORULARI TAMAMEN SİL
DELETE FROM public.quiz_questions
WHERE (
    option_a IS NULL OR trim(option_a) = ''
    OR option_b IS NULL OR trim(option_b) = ''
  )
  AND id NOT IN (
    SELECT question_id FROM public.quiz_daily WHERE question_id IS NOT NULL
  );

-- 2. GEÇMİŞTE SORULMUŞ OLANLARI DA BİR DAHA ASLA SEÇİLMEYECEK ŞEKİLDE KAPAT (is_active = false)
-- (Geçmiş sınıf puanları ve karne kayıtları bozulmasın diye)
UPDATE public.quiz_questions
SET is_active = false
WHERE (
  option_a IS NULL OR trim(option_a) = ''
  OR option_b IS NULL OR trim(option_b) = ''
);

-- 3. GÜNLÜK SORU SEÇME FONKSİYONUNU GÜNCELLE
-- (Bundan sonra her zaman sadece şıklı / çoktan seçmeli sorular seçilsin)
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
  -- Hafta sonu kontrolü (Cumartesi = 6, Pazar = 7)
  IF EXTRACT(isodow FROM CURRENT_DATE) IN (6, 7) THEN
    RETURN NULL;
  END IF;

  -- 1. Bugün için halihazırda seçilmiş soru var mı?
  SELECT id INTO v_daily_id FROM public.quiz_daily
  WHERE school_id = p_school_id AND question_date = CURRENT_DATE;

  IF v_daily_id IS NOT NULL THEN
    RETURN v_daily_id;
  END IF;

  -- 2. Daha önce hiç sorulmamış ve ŞIKLI (Çoktan seçmeli) aktif bir soru seç
  SELECT id INTO v_question_id FROM public.quiz_questions
  WHERE school_id = p_school_id 
    AND is_active = true 
    AND option_a IS NOT NULL AND trim(option_a) != ''
    AND option_b IS NOT NULL AND trim(option_b) != ''
    AND id NOT IN (
      SELECT DISTINCT question_id 
      FROM public.quiz_daily 
      WHERE school_id = p_school_id AND question_id IS NOT NULL
    )
  ORDER BY random() 
  LIMIT 1;

  -- 3. Sorulmamış kalmadıysa, tüm şıklı sorular arasından rastgele seç
  IF v_question_id IS NULL THEN
    SELECT id INTO v_question_id FROM public.quiz_questions
    WHERE school_id = p_school_id 
      AND is_active = true
      AND option_a IS NOT NULL AND trim(option_a) != ''
      AND option_b IS NOT NULL AND trim(option_b) != ''
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
