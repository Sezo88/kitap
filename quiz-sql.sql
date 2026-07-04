-- Quiz / Gunun Sorusu Sistemi
-- Supabase SQL Editor'da calistirin

-- 1. Siniflara quiz PIN ekle
ALTER TABLE classes ADD COLUMN IF NOT EXISTS quiz_pin TEXT;

-- 2. Soru bankasi
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  difficulty TEXT DEFAULT 'orta', -- kolay, orta, zor
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Gunluk soru (her gun bir soru)
CREATE TABLE IF NOT EXISTS quiz_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  question_id UUID REFERENCES quiz_questions(id),
  question_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, question_date)
);

-- 4. Sinif cevaplari
CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_id UUID REFERENCES quiz_daily(id),
  class_id UUID REFERENCES classes(id),
  answer TEXT NOT NULL,
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(daily_id, class_id)
);

-- 5. Puan durumu
CREATE TABLE IF NOT EXISTS quiz_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id),
  score INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, class_id)
);

-- 6. RLS
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_scores ENABLE ROW LEVEL SECURITY;

-- Admin erisimi
CREATE POLICY "qq_admin" ON quiz_questions FOR ALL USING (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','idareci'))
);
CREATE POLICY "qd_admin" ON quiz_daily FOR ALL USING (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','idareci'))
);

-- Anon erisim (ogrenci cevap sayfasi + pano)
CREATE POLICY "qq_anon" ON quiz_questions FOR SELECT USING (true);
CREATE POLICY "qd_anon" ON quiz_daily FOR SELECT USING (true);
CREATE POLICY "qa_anon_insert" ON quiz_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "qa_anon_select" ON quiz_answers FOR SELECT USING (true);
CREATE POLICY "qs_anon" ON quiz_scores FOR SELECT USING (true);

-- 7. Gunluk soru otomatik secme fonksiyonu
CREATE OR REPLACE FUNCTION pick_daily_question(p_school_id UUID)
RETURNS UUID AS $$
DECLARE
  v_question_id UUID;
  v_daily_id UUID;
BEGIN
  -- Zaten bugunun sorusu var mi?
  SELECT id INTO v_daily_id FROM quiz_daily
  WHERE school_id = p_school_id AND question_date = CURRENT_DATE;

  IF v_daily_id IS NOT NULL THEN
    RETURN v_daily_id;
  END IF;

  -- Rastgele bir soru sec
  SELECT id INTO v_question_id FROM quiz_questions
  WHERE school_id = p_school_id AND is_active = true
  ORDER BY random() LIMIT 1;

  IF v_question_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Gunluk soruyu olustur
  INSERT INTO quiz_daily (school_id, question_id, question_date)
  VALUES (p_school_id, v_question_id, CURRENT_DATE)
  RETURNING id INTO v_daily_id;

  RETURN v_daily_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Otomatik puanlama fonksiyonu (trigger)
CREATE OR REPLACE FUNCTION check_quiz_answer()
RETURNS TRIGGER AS $$
DECLARE
  correct_answer TEXT;
BEGIN
  -- Dogru cevabi bul
  SELECT LOWER(TRIM(qq.answer)) INTO correct_answer
  FROM quiz_daily qd
  JOIN quiz_questions qq ON qd.question_id = qq.id
  WHERE qd.id = NEW.daily_id;

  -- Karsilastir (buyuk/kucuk harf duyarsiz, bosluklari temizle)
  IF LOWER(TRIM(NEW.answer)) = correct_answer THEN
    NEW.is_correct := true;

    -- Puan ekle
    INSERT INTO quiz_scores (school_id, class_id, score)
    SELECT qd.school_id, NEW.class_id, 1
    FROM quiz_daily qd
    WHERE qd.id = NEW.daily_id
    ON CONFLICT (school_id, class_id)
    DO UPDATE SET score = quiz_scores.score + 1, updated_at = now();
  ELSE
    NEW.is_correct := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: cevap eklenince otomatik kontrol et
DROP TRIGGER IF EXISTS trg_check_answer ON quiz_answers;
CREATE TRIGGER trg_check_answer
  BEFORE INSERT ON quiz_answers
  FOR EACH ROW
  EXECUTE FUNCTION check_quiz_answer();
