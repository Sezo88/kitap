-- ============================================================
-- Okul Asistanı — Konsolide Veritabanı Şeması (v2)
-- Tüm tabloları, RLS politikalarını ve fonksiyonları içerir.
-- 
-- Bu dosya sıfırdan kurulum içindir.
-- Mevcut veritabanına uygulamak için patch-*.sql dosyalarını kullanın.
-- ============================================================

-- ============================================================
-- ENUM TİPLERİ
-- ============================================================

CREATE TYPE public.user_role AS ENUM ('super_admin', 'idareci', 'ogretmen');
CREATE TYPE public.book_status AS ENUM ('active', 'completed', 'abandoned');

-- ============================================================
-- TABLOLAR
-- ============================================================

-- 1. Schools (Okullar)
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  total_lessons int NOT NULL DEFAULT 8,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Profiles (Kullanıcı Profilleri — auth.users ile 1:1)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'ogretmen',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- 3. Classes (Sınıflar)
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  grade_level int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 4. Teacher-Classes (Öğretmen-Sınıf İlişkisi)
CREATE TABLE public.teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  UNIQUE(teacher_id, class_id)
);

-- 5. Students (Öğrenciler)
CREATE TABLE public.students (
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
CREATE TABLE public.books (
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
CREATE TABLE public.student_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  status public.book_status NOT NULL DEFAULT 'active',
  started_at date DEFAULT CURRENT_DATE,
  finished_at date,
  created_at timestamptz DEFAULT now()
);

-- 8. Reading Logs (Günlük Okuma Takip)
CREATE TABLE public.reading_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  brought_book boolean NOT NULL DEFAULT false,
  did_read boolean NOT NULL DEFAULT false,
  active_book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  marked_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, log_date)
);

-- 9. Attendance Logs (Yoklama Kayıtları)
CREATE TABLE public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  lesson_no int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'absent' CHECK (status IN ('absent', 'present', 'corrected_present')),
  reason text CHECK (reason IN ('bilinmiyor', 'veli_bilgi_verdi', 'raporlu_izinli')),
  marked_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  corrected_at timestamptz,
  corrected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, log_date, lesson_no)
);

-- 10. SMS Provider Settings (SMS Sağlayıcı Ayarları)
CREATE TABLE public.sms_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider_name text NOT NULL DEFAULT 'netgsm' CHECK (provider_name IN ('netgsm', 'iletim_merkezi', 'vatan_sms', 'custom')),
  api_base_url text,
  api_key text NOT NULL,
  api_secret text,
  sender_id text NOT NULL DEFAULT '',
  http_method text NOT NULL DEFAULT 'POST' CHECK (http_method IN ('GET', 'POST')),
  header_template jsonb,
  body_template text,
  is_active boolean DEFAULT false,
  sms_unit_cost numeric,
  last_tested_at timestamptz,
  last_test_result text,
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id)
);

-- 11. SMS Logs (SMS Gönderim Kayıtları)
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id uuid REFERENCES public.attendance_logs(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('absence_alert', 'correction_alert', 'test')),
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_response jsonb,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 12. Cleanliness Criterias (Temiz Sınıf Kriterleri)
CREATE TABLE public.cleanliness_criterias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 13. Cleanliness Scores (Temiz Sınıf Puanları)
CREATE TABLE public.cleanliness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  criteria_id uuid NOT NULL REFERENCES public.cleanliness_criterias(id) ON DELETE CASCADE,
  score_date date NOT NULL DEFAULT CURRENT_DATE,
  score int NOT NULL CHECK (score BETWEEN 1 AND 5),
  marked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, criteria_id, score_date)
);

-- 14. Subjects (Dersler)
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 15. Student Projects (Öğrenci Projeleri)
CREATE TABLE public.student_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, subject_id)
);

-- ============================================================
-- GÜVENLİK FONKSİYONLARI (RLS Bypass)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_class_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT class_id FROM public.teacher_classes WHERE teacher_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.generate_school_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  new_code text;
BEGIN
  LOOP
    new_code := upper(substring(md5(random()::text), 1, 6));
    IF NOT EXISTS (SELECT 1 FROM public.schools WHERE code = new_code) THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY — Tüm Tablolar
-- ============================================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanliness_criterias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanliness_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_projects ENABLE ROW LEVEL SECURITY;

-- ── PROFILES RLS ──────────────────────────────────────────────

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_super_admin" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'super_admin');

CREATE POLICY "profiles_select_idareci" ON public.profiles
  FOR SELECT USING (
    public.get_my_role() = 'idareci'
    AND school_id = public.get_my_school_id()
  );

CREATE POLICY "profiles_select_ogretmen" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'ogretmen');

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR (
      public.get_my_role() IN ('idareci', 'super_admin')
      AND school_id = public.get_my_school_id()
    )
  );

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ── SCHOOLS RLS ───────────────────────────────────────────────

CREATE POLICY "schools_select" ON public.schools
  FOR SELECT USING (
    id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "schools_insert" ON public.schools
  FOR INSERT WITH CHECK (true);

CREATE POLICY "schools_update" ON public.schools
  FOR UPDATE USING (
    public.get_my_role() IN ('super_admin', 'idareci')
    AND (id = public.get_my_school_id() OR public.get_my_role() = 'super_admin')
  );

-- ── CLASSES RLS ───────────────────────────────────────────────

CREATE POLICY "classes_select" ON public.classes
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "classes_insert" ON public.classes
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "classes_update" ON public.classes
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "classes_delete" ON public.classes
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

-- ── TEACHER_CLASSES RLS ───────────────────────────────────────

CREATE POLICY "teacher_classes_select" ON public.teacher_classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = teacher_classes.class_id
      AND c.school_id = public.get_my_school_id()
    )
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "teacher_classes_insert" ON public.teacher_classes
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "teacher_classes_delete" ON public.teacher_classes
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

-- ── STUDENTS RLS ──────────────────────────────────────────────

CREATE POLICY "students_select" ON public.students
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "students_insert" ON public.students
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

CREATE POLICY "students_update" ON public.students
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

CREATE POLICY "students_delete" ON public.students
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

-- ── BOOKS RLS ─────────────────────────────────────────────────

CREATE POLICY "books_select" ON public.books
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "books_insert" ON public.books
  FOR INSERT WITH CHECK (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "books_update" ON public.books
  FOR UPDATE USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "books_delete" ON public.books
  FOR DELETE USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

-- ── STUDENT_BOOKS RLS ─────────────────────────────────────────

CREATE POLICY "student_books_select" ON public.student_books
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_books.student_id
      AND (s.school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin')
    )
  );

CREATE POLICY "student_books_insert" ON public.student_books
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

CREATE POLICY "student_books_update" ON public.student_books
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

-- ── READING_LOGS RLS ──────────────────────────────────────────

CREATE POLICY "reading_logs_select" ON public.reading_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = reading_logs.student_id
      AND (s.school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin')
    )
  );

CREATE POLICY "reading_logs_insert" ON public.reading_logs
  FOR INSERT WITH CHECK (
    marked_by = auth.uid()
    AND public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen')
  );

CREATE POLICY "reading_logs_update" ON public.reading_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.teacher_classes tc
      WHERE tc.teacher_id = auth.uid() AND tc.class_id = reading_logs.class_id
    )
    OR public.get_my_role() IN ('super_admin', 'idareci')
  );

-- ── ATTENDANCE_LOGS RLS ───────────────────────────────────────

CREATE POLICY "attendance_logs_select" ON public.attendance_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = attendance_logs.student_id
      AND (s.school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin')
    )
  );

CREATE POLICY "attendance_logs_insert" ON public.attendance_logs
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

CREATE POLICY "attendance_logs_update" ON public.attendance_logs
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

-- ── SMS_PROVIDER_SETTINGS RLS ─────────────────────────────────

CREATE POLICY "sms_settings_select" ON public.sms_provider_settings
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "sms_settings_insert" ON public.sms_provider_settings
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "sms_settings_update" ON public.sms_provider_settings
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

-- ── SMS_LOGS RLS ──────────────────────────────────────────────

CREATE POLICY "sms_logs_select" ON public.sms_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = sms_logs.student_id
      AND (s.school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin')
    )
  );

CREATE POLICY "sms_logs_insert" ON public.sms_logs
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

-- ── CLEANLINESS RLS ───────────────────────────────────────────

CREATE POLICY "cleanliness_criterias_select" ON public.cleanliness_criterias
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "cleanliness_criterias_insert" ON public.cleanliness_criterias
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "cleanliness_criterias_update" ON public.cleanliness_criterias
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "cleanliness_scores_select" ON public.cleanliness_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = cleanliness_scores.class_id
      AND (c.school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin')
    )
  );

CREATE POLICY "cleanliness_scores_insert" ON public.cleanliness_scores
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

CREATE POLICY "cleanliness_scores_update" ON public.cleanliness_scores
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

-- ── SUBJECTS RLS ──────────────────────────────────────────────

CREATE POLICY "subjects_select" ON public.subjects
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "subjects_insert" ON public.subjects
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "subjects_update" ON public.subjects
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "subjects_delete" ON public.subjects
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

-- ── STUDENT_PROJECTS RLS ──────────────────────────────────────

CREATE POLICY "student_projects_select" ON public.student_projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_projects.student_id
      AND (s.school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin')
    )
  );

CREATE POLICY "student_projects_insert" ON public.student_projects
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

CREATE POLICY "student_projects_delete" ON public.student_projects
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen'));

-- ============================================================
-- İNDEKSLER (Performans)
-- ============================================================

CREATE INDEX idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_classes_school_id ON public.classes(school_id);
CREATE INDEX idx_students_school_id ON public.students(school_id);
CREATE INDEX idx_students_class_id ON public.students(class_id);
CREATE INDEX idx_books_school_id ON public.books(school_id);
CREATE INDEX idx_reading_logs_log_date ON public.reading_logs(log_date);
CREATE INDEX idx_reading_logs_class_id ON public.reading_logs(class_id);
CREATE INDEX idx_reading_logs_student_id ON public.reading_logs(student_id);
CREATE INDEX idx_student_books_student_id ON public.student_books(student_id);
CREATE INDEX idx_teacher_classes_teacher_id ON public.teacher_classes(teacher_id);
CREATE INDEX idx_attendance_logs_student_date ON public.attendance_logs(student_id, log_date);
CREATE INDEX idx_attendance_logs_class_id ON public.attendance_logs(class_id);
CREATE INDEX idx_sms_logs_student_id ON public.sms_logs(student_id);
CREATE INDEX idx_cleanliness_scores_class_date ON public.cleanliness_scores(class_id, score_date);
CREATE INDEX idx_student_projects_student_id ON public.student_projects(student_id);

-- ============================================================
-- TETİKLEYİCİ: Yeni auth.users kaydına otomatik profil oluştur
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_school_action text;
  v_school_code text;
  v_school_name text;
  v_school_id uuid;
  v_status text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'ogretmen');
  v_school_action := NEW.raw_user_meta_data ->> 'school_action';
  v_school_code := NEW.raw_user_meta_data ->> 'school_code';
  v_school_name := NEW.raw_user_meta_data ->> 'school_name';

  IF v_school_action = 'create' AND v_school_name IS NOT NULL THEN
    IF v_school_code IS NULL THEN
      v_school_code := public.generate_school_code();
    END IF;

    IF EXISTS (SELECT 1 FROM public.schools WHERE upper(code) = upper(v_school_code)) THEN
      RAISE EXCEPTION 'Bu okul kodu zaten kullanılıyor: %', v_school_code;
    END IF;

    INSERT INTO public.schools (name, code, created_by)
    VALUES (v_school_name, upper(v_school_code), NEW.id)
    RETURNING id INTO v_school_id;
    v_status := 'active';
  ELSIF v_school_code IS NOT NULL THEN
    SELECT id INTO v_school_id FROM public.schools WHERE upper(code) = upper(v_school_code);
    IF v_school_id IS NULL THEN
      RAISE EXCEPTION 'Geçersiz okul kodu: %', v_school_code;
    END IF;
    v_status := 'pending';
  ELSE
    v_status := 'active';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, school_id, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    v_role,
    v_school_id,
    v_status
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
