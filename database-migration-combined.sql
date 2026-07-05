-- ============================================================
-- Okul Asistanı — Konsolide Veritabanı Şeması (v3 Combined)
-- Tüm tabloları, RLS politikalarını, triggerları ve fonksiyonları içerir.
-- Bu dosya sıfırdan kurulum içindir.
-- ============================================================

-- ============================================================
-- ENUM TİPLERİ VE EXTENSIONLAR
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('super_admin', 'idareci', 'ogretmen');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.book_status AS ENUM ('active', 'completed', 'abandoned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- TABLOLAR
-- ============================================================

-- 1. Schools (Okullar)
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  total_lessons int NOT NULL DEFAULT 8,
  pano_pin text,
  is_approved boolean DEFAULT false,
  -- Lisans Özellikleri
  feature_attendance boolean NOT NULL DEFAULT true,
  feature_library boolean NOT NULL DEFAULT true,
  feature_cleanliness boolean NOT NULL DEFAULT true,
  feature_lesson_schedule boolean NOT NULL DEFAULT true,
  feature_bell boolean NOT NULL DEFAULT true,
  license_expires_at timestamptz DEFAULT (now() + interval '1 month'),
  -- Zil Uygulaması Durumu
  bell_active boolean NOT NULL DEFAULT true,
  last_bell_heartbeat timestamptz DEFAULT NULL,
  -- SMS Ayarları
  sms_provider text DEFAULT NULL,
  sms_username text DEFAULT NULL,
  sms_password text DEFAULT NULL,
  sms_title text DEFAULT NULL,
  sms_balance int NOT NULL DEFAULT 0,
  
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Profiles (Kullanıcı Profilleri — auth.users ile 1:1)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'ogretmen',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- 3. Classes (Sınıflar)
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  grade_level int NOT NULL DEFAULT 1,
  quiz_pin text,
  created_at timestamptz DEFAULT now()
);

-- 4. Teacher-Classes (Öğretmen-Sınıf İlişkisi)
CREATE TABLE IF NOT EXISTS public.teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  UNIQUE(teacher_id, class_id)
);

-- 5. Students (Öğrenciler)
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  e_okul_no text,
  full_name text NOT NULL,
  is_active boolean DEFAULT true,
  veli_telefon text,
  veli_telefon_2 text,
  veli_telefon_sahip text,
  veli_telefon_2_sahip text,
  dogum_tarihi date,
  created_at timestamptz DEFAULT now()
);

-- 6. Books (Kütüphane)
CREATE TABLE IF NOT EXISTS public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text NOT NULL DEFAULT '',
  page_count int,
  category text,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 7. Student Books (Öğrencinin Okuduğu Kitaplar)
CREATE TABLE IF NOT EXISTS public.student_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  status public.book_status NOT NULL DEFAULT 'active',
  started_at date DEFAULT CURRENT_DATE,
  finished_at date,
  created_at timestamptz DEFAULT now()
);

-- 8. Reading Logs (Günlük Okuma Takip)
CREATE TABLE IF NOT EXISTS public.reading_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  brought_book boolean NOT NULL DEFAULT false,
  did_read boolean NOT NULL DEFAULT false,
  marked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, log_date)
);

-- 9. Cleanliness Scores (Temiz Sınıf Puanları)
CREATE TABLE IF NOT EXISTS public.cleanliness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  score_date date NOT NULL DEFAULT CURRENT_DATE,
  score int NOT NULL CHECK (score >= 0 AND score <= 100),
  rated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  season_name text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, score_date)
);

-- 10. Bell Schedule (Ders & Teneffüs Saatleri)
CREATE TABLE IF NOT EXISTS public.bell_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period_no int NOT NULL,
  label text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, period_no)
);

-- 11. Lesson Schedule (Ders Programı)
CREATE TABLE IF NOT EXISTS public.lesson_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  period_no int NOT NULL,
  subject_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, day_of_week, period_no)
);

-- 12. Duty Schedule (Nöbetçi Öğretmen Programı)
CREATE TABLE IF NOT EXISTS public.duty_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location text NOT NULL,
  time_slot text,
  created_at timestamptz DEFAULT now()
);

-- 13. Bell Commands (Uzaktan Zil Komutları)
CREATE TABLE IF NOT EXISTS public.bell_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  command_type text NOT NULL CHECK (command_type IN ('play_bell', 'play_anthem', 'custom_announcement', 'stop_sound', 'play_ceremony', 'mute_bell', 'unmute_bell')),
  triggered_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  triggered_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged')),
  created_at timestamptz DEFAULT now()
);

-- 14. Panel Settings (Pano Ayarları)
CREATE TABLE IF NOT EXISTS public.panel_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'blue',
  school_logo_url text,
  school_motto text,
  slide_interval int NOT NULL DEFAULT 10,
  show_top_readers boolean NOT NULL DEFAULT true,
  show_top_class boolean NOT NULL DEFAULT true,
  show_birthdays boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id)
);

-- 15. Panel Announcements (Pano Duyuruları)
CREATE TABLE IF NOT EXISTS public.panel_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  image_url text,
  category text NOT NULL DEFAULT 'duyuru' CHECK (category IN ('duyuru', 'etkinlik', 'ayin_ogrencisi', 'ayin_sinifi', 'deneme_liderleri')),
  priority int NOT NULL DEFAULT 0,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 16. Panel Gallery (Pano Resim Galerisi)
CREATE TABLE IF NOT EXISTS public.panel_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  cloudinary_url text NOT NULL,
  caption text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 17. Quiz Questions (Günün Sorusu Bankası)
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  difficulty text DEFAULT 'orta',
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 18. Quiz Daily (Günün Sorusu)
CREATE TABLE IF NOT EXISTS public.quiz_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.quiz_questions(id),
  question_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, question_date)
);

-- 19. Quiz Answers (Sınıf Cevapları)
CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_id uuid REFERENCES public.quiz_daily(id),
  class_id uuid REFERENCES public.classes(id),
  answer text NOT NULL,
  is_correct boolean,
  answered_at timestamptz DEFAULT now(),
  UNIQUE(daily_id, class_id)
);

-- 20. Quiz Scores (Sınıf Quiz Puanları)
CREATE TABLE IF NOT EXISTS public.quiz_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id),
  class_name text,
  score int DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, class_id)
);

-- 21. SMS Logs (Gönderilen SMS Günlükleri)
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  recipient_name text NOT NULL,
  message_content text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  cost_credits int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- HELPER FUNCTIONS & RPCs
-- ============================================================

-- Rol Okuma Fonksiyonu
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- Okul ID Okuma Fonksiyonu
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Günlük Soru Seçme Fonksiyonu
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
  SELECT id INTO v_daily_id FROM public.quiz_daily
  WHERE school_id = p_school_id AND question_date = CURRENT_DATE;

  IF v_daily_id IS NOT NULL THEN
    RETURN v_daily_id;
  END IF;

  SELECT id INTO v_question_id FROM public.quiz_questions
  WHERE school_id = p_school_id AND is_active = true
  ORDER BY random() LIMIT 1;

  IF v_question_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.quiz_daily (school_id, question_id, question_date)
  VALUES (p_school_id, v_question_id, CURRENT_DATE)
  RETURNING id INTO v_daily_id;

  RETURN v_daily_id;
END;
$$;

-- Zil Kalp Atışı Bildirimi
CREATE OR REPLACE FUNCTION public.bell_heartbeat(p_school_id uuid, p_bell_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.schools
  SET last_bell_heartbeat = now(),
      bell_active = p_bell_active
  WHERE id = p_school_id;
END;
$$;

-- Okul Kodu Çözümleme
CREATE OR REPLACE FUNCTION public.resolve_school_code(p_code text)
RETURNS TABLE (
  school_id uuid,
  school_name text,
  license_expires_at timestamptz,
  feature_bell boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.license_expires_at, s.feature_bell
  FROM public.schools s
  WHERE s.code = p_code;
END;
$$;

-- ============================================================
-- TRIGGERS & PROCEDURES
-- ============================================================

-- Auth kullanıcısı oluşunca profil oluşturan tetikleyici fonksiyonu
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  school_id_val uuid;
  role_val public.user_role;
  full_name_val text;
BEGIN
  school_id_val := (new.raw_user_meta_data->>'school_id')::uuid;
  full_name_val := coalesce(new.raw_user_meta_data->>'full_name', 'Yeni Kullanıcı');
  role_val := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'ogretmen'::public.user_role);

  INSERT INTO public.profiles (id, school_id, full_name, role, status)
  VALUES (new.id, school_id_val, full_name_val, role_val, 'active');
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Quiz cevap tetikleyici fonksiyonu
CREATE OR REPLACE FUNCTION public.check_quiz_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  correct_answer text;
BEGIN
  SELECT lower(trim(qq.answer)) INTO correct_answer
  FROM public.quiz_daily qd
  JOIN public.quiz_questions qq ON qd.question_id = qq.id
  WHERE qd.id = new.daily_id;

  IF lower(trim(new.answer)) = correct_answer THEN
    new.is_correct := true;

    INSERT INTO public.quiz_scores (school_id, class_id, class_name, score)
    SELECT qd.school_id, new.class_id, c.name, 1
    FROM public.quiz_daily qd
    JOIN public.classes c ON c.id = new.class_id
    WHERE qd.id = new.daily_id
    ON CONFLICT (school_id, class_id)
    DO UPDATE SET score = quiz_scores.score + 1, class_name = EXCLUDED.class_name, updated_at = now();
  ELSE
    new.is_correct := false;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_answer ON public.quiz_answers;
CREATE TRIGGER trg_check_answer
  BEFORE INSERT ON public.quiz_answers
  FOR EACH ROW EXECUTE FUNCTION public.check_quiz_answer();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanliness_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bell_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bell_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- 1. Schools Policies
CREATE POLICY "schools_select" ON public.schools FOR SELECT USING (true);
CREATE POLICY "schools_insert" ON public.schools FOR INSERT WITH CHECK (true);
CREATE POLICY "schools_update" ON public.schools FOR UPDATE USING (id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');
CREATE POLICY "schools_select_super_admin" ON public.schools FOR SELECT USING (public.get_my_role() = 'super_admin');
CREATE POLICY "schools_update_super_admin" ON public.schools FOR UPDATE USING (public.get_my_role() = 'super_admin');
CREATE POLICY "schools_delete_super_admin" ON public.schools FOR DELETE USING (public.get_my_role() = 'super_admin');

-- 2. Profiles Policies
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_select_super_admin" ON public.profiles FOR SELECT USING (public.get_my_role() = 'super_admin');
CREATE POLICY "profiles_select_idareci" ON public.profiles FOR SELECT USING (public.get_my_role() = 'idareci' AND school_id = public.get_my_school_id());
CREATE POLICY "profiles_select_ogretmen" ON public.profiles FOR SELECT USING (public.get_my_role() = 'ogretmen' AND school_id = public.get_my_school_id());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- 3. Classes Policies
CREATE POLICY "classes_select" ON public.classes FOR SELECT USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');
CREATE POLICY "classes_insert" ON public.classes FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "classes_update" ON public.classes FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "classes_delete" ON public.classes FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "classes_anon_select" ON public.classes FOR SELECT USING (true); -- Pano için

-- 4. Teacher Classes Policies
CREATE POLICY "tc_select" ON public.teacher_classes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND school_id = (SELECT school_id FROM public.classes WHERE id = teacher_classes.class_id))
);
CREATE POLICY "tc_all_admin" ON public.teacher_classes FOR ALL USING (public.get_my_role() IN ('super_admin', 'idareci'));

-- 5. Students Policies
CREATE POLICY "students_select" ON public.students FOR SELECT USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');
CREATE POLICY "students_insert" ON public.students FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));
CREATE POLICY "students_update" ON public.students FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));
CREATE POLICY "students_delete" ON public.students FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "students_anon_select" ON public.students FOR SELECT USING (true); -- Pano için

-- 6. Books Policies
CREATE POLICY "books_select" ON public.books FOR SELECT USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');
CREATE POLICY "books_insert" ON public.books FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));
CREATE POLICY "books_update" ON public.books FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));
CREATE POLICY "books_delete" ON public.books FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

-- 7. Student Books Policies
CREATE POLICY "sb_select" ON public.student_books FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_books.student_id AND s.school_id = public.get_my_school_id())
);
CREATE POLICY "sb_insert" ON public.student_books FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));
CREATE POLICY "sb_update" ON public.student_books FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));
CREATE POLICY "sb_delete" ON public.student_books FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "student_books_anon_select" ON public.student_books FOR SELECT USING (true); -- Pano için

-- 8. Reading Logs Policies
CREATE POLICY "rl_select" ON public.reading_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = reading_logs.class_id AND c.school_id = public.get_my_school_id())
);
CREATE POLICY "rl_insert" ON public.reading_logs FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));
CREATE POLICY "rl_update" ON public.reading_logs FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

-- 9. Cleanliness Scores Policies
CREATE POLICY "cleanliness_scores_select" ON public.cleanliness_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = cleanliness_scores.class_id AND (c.school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin'))
);
CREATE POLICY "cleanliness_scores_insert" ON public.cleanliness_scores FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));
CREATE POLICY "cleanliness_scores_update" ON public.cleanliness_scores FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));
CREATE POLICY "clean_scores_anon_select" ON public.cleanliness_scores FOR SELECT USING (true); -- Pano için

-- 10. Bell Schedule Policies
CREATE POLICY "bell_schedule_select" ON public.bell_schedule FOR SELECT USING (true);
CREATE POLICY "bell_schedule_insert" ON public.bell_schedule FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "bell_schedule_update" ON public.bell_schedule FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "bell_schedule_delete" ON public.bell_schedule FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

-- 11. Lesson Schedule Policies
CREATE POLICY "lesson_schedule_select" ON public.lesson_schedule FOR SELECT USING (true);
CREATE POLICY "lesson_schedule_insert" ON public.lesson_schedule FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "lesson_schedule_update" ON public.lesson_schedule FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "lesson_schedule_delete" ON public.lesson_schedule FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

-- 12. Duty Schedule Policies
CREATE POLICY "duty_schedule_select" ON public.duty_schedule FOR SELECT USING (true);
CREATE POLICY "duty_schedule_insert" ON public.duty_schedule FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "duty_schedule_update" ON public.duty_schedule FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "duty_schedule_delete" ON public.duty_schedule FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

-- 13. Bell Commands Policies
CREATE POLICY "bell_commands_select" ON public.bell_commands FOR SELECT USING (true);
CREATE POLICY "bell_commands_insert" ON public.bell_commands FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));
CREATE POLICY "bell_commands_update" ON public.bell_commands FOR UPDATE USING (true);

-- 14. Panel Settings Policies
CREATE POLICY "panel_settings_select" ON public.panel_settings FOR SELECT USING (true);
CREATE POLICY "panel_settings_all" ON public.panel_settings FOR ALL USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');

-- 15. Panel Announcements Policies
CREATE POLICY "panel_announcements_select" ON public.panel_announcements FOR SELECT USING (true);
CREATE POLICY "panel_announcements_all" ON public.panel_announcements FOR ALL USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');

-- 16. Panel Gallery Policies
CREATE POLICY "panel_gallery_select" ON public.panel_gallery FOR SELECT USING (true);
CREATE POLICY "panel_gallery_all" ON public.panel_gallery FOR ALL USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');

-- 17. Quiz Questions Policies
CREATE POLICY "qq_admin" ON public.quiz_questions FOR ALL USING (
  school_id = public.get_my_school_id()
  AND public.get_my_role() IN ('super_admin', 'idareci')
);
CREATE POLICY "qq_anon" ON public.quiz_questions FOR SELECT USING (true);

-- 18. Quiz Daily Policies
CREATE POLICY "qd_admin" ON public.quiz_daily FOR ALL USING (
  school_id = public.get_my_school_id()
  AND public.get_my_role() IN ('super_admin', 'idareci')
);
CREATE POLICY "qd_anon" ON public.quiz_daily FOR SELECT USING (true);

-- 19. Quiz Answers Policies
CREATE POLICY "qa_anon_insert" ON public.quiz_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "qa_anon_select" ON public.quiz_answers FOR SELECT USING (true);

-- 20. Quiz Scores Policies
CREATE POLICY "qs_anon" ON public.quiz_scores FOR SELECT USING (true);

-- 21. SMS Logs Policies
CREATE POLICY "sms_logs_select" ON public.sms_logs FOR SELECT USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');
CREATE POLICY "sms_logs_insert" ON public.sms_logs FOR INSERT WITH CHECK (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');

-- ============================================================
-- İNDEKSLER (PERFORMANS İÇİN)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_students_school_class ON public.students(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_reading_logs_student_date ON public.reading_logs(student_id, log_date);
CREATE INDEX IF NOT EXISTS idx_cleanliness_scores_class_date ON public.cleanliness_scores(class_id, score_date);
CREATE INDEX IF NOT EXISTS idx_cleanliness_scores_season ON public.cleanliness_scores(season_name);
CREATE INDEX IF NOT EXISTS idx_student_books_status ON public.student_books(status);
CREATE INDEX IF NOT EXISTS idx_lessons_class_day ON public.lesson_schedule(class_id, day_of_week);
