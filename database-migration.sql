-- ============================================================
-- Okuma Takip Uygulaması — Supabase Veritabanı Şeması
-- Bu dosyayı Supabase SQL Editor'da çalıştırın.
-- ============================================================

-- 1. Role Enum
CREATE TYPE public.user_role AS ENUM ('super_admin', 'idareci', 'ogretmen');

-- 2. Book Status Enum
CREATE TYPE public.book_status AS ENUM ('active', 'completed', 'abandoned');

-- 3. Schools (Okul Topluluğu)
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Benzersiz okul kodu üreten fonksiyon
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

-- 4. Profiles (Kullanıcı Profili)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'ogretmen',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- 5. Classes (Sınıflar)
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  grade_level int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 6. Teacher-Classes (Öğretmen-Sınıf İlişkisi)
CREATE TABLE public.teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  UNIQUE(teacher_id, class_id)
);

-- 7. Students (Öğrenciler)
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  e_okul_no text,
  full_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 8. Books (Kütüphane)
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

-- 9. Student Books (Öğrencinin Okuduğu Kitaplar)
CREATE TABLE public.student_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  status public.book_status NOT NULL DEFAULT 'active',
  started_at date DEFAULT CURRENT_DATE,
  finished_at date,
  created_at timestamptz DEFAULT now()
);

-- 10. Reading Logs (Günlük İşaretleme)
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

-- ============================================================
-- RLS Politikaları
-- ============================================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_logs ENABLE ROW LEVEL SECURITY;

-- Güvenli rol okuma fonksiyonu (RLS bypass - sonsuz döngüyü engeller)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- Güvenli school_id okuma fonksiyonu (RLS bypass)
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Yardımcı Fonksiyon: Öğretmenin sınıflarını getir
CREATE OR REPLACE FUNCTION public.get_teacher_class_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT class_id FROM public.teacher_classes WHERE teacher_id = auth.uid();
$$;

-- ============================================================
-- PROFILES RLS
-- ============================================================

CREATE POLICY "Kullanıcı kendi profilini görebilir" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Super admin tüm profilleri görebilir" ON public.profiles
  FOR SELECT USING (
    public.get_my_role() = 'super_admin'
  );

CREATE POLICY "İdareci kendi okulundaki profilleri görebilir" ON public.profiles
  FOR SELECT USING (
    public.get_my_role() = 'idareci'
    AND school_id = public.get_my_school_id()
  );

CREATE POLICY "Öğretmen kendi sınıfındaki profilleri görebilir" ON public.profiles
  FOR SELECT USING (
    public.get_my_role() = 'ogretmen'
  );

CREATE POLICY "Kullanıcı kendi profilini güncelleyebilir" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR (
      public.get_my_role() = 'idareci'
      AND school_id = public.get_my_school_id()
    )
  );

CREATE POLICY "Yeni kullanıcı profili oluşturabilir" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ============================================================
-- SCHOOLS RLS
-- ============================================================

CREATE POLICY "Herkes kendi okulunu görebilir" ON public.schools
  FOR SELECT USING (
    id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "Super admin okul oluşturabilir" ON public.schools
  FOR INSERT WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Super admin okul güncelleyebilir" ON public.schools
  FOR UPDATE USING (
    public.get_my_role() = 'super_admin'
  );

-- ============================================================
-- CLASSES RLS
-- ============================================================

CREATE POLICY "Okul üyeleri sınıfları görebilir" ON public.classes
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "İdareci ve super admin sınıf oluşturabilir" ON public.classes
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('super_admin', 'idareci')
  );

CREATE POLICY "İdareci ve super admin sınıf güncelleyebilir" ON public.classes
  FOR UPDATE USING (
    public.get_my_role() IN ('super_admin', 'idareci')
  );

CREATE POLICY "İdareci ve super admin sınıf silebilir" ON public.classes
  FOR DELETE USING (
    public.get_my_role() IN ('super_admin', 'idareci')
  );

-- ============================================================
-- TEACHER_CLASSES RLS
-- ============================================================

CREATE POLICY "Okul üyeleri atamaları görebilir" ON public.teacher_classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      JOIN public.profiles p ON p.school_id = c.school_id
      WHERE c.id = teacher_classes.class_id AND p.id = auth.uid()
    )
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "İdareci ve super admin atama yapabilir" ON public.teacher_classes
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('super_admin', 'idareci')
  );

CREATE POLICY "İdareci ve super admin atama silebilir" ON public.teacher_classes
  FOR DELETE USING (
    public.get_my_role() IN ('super_admin', 'idareci')
  );

-- ============================================================
-- STUDENTS RLS
-- ============================================================

CREATE POLICY "Okul üyeleri öğrencileri görebilir" ON public.students
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "Öğretmen, idareci ve super admin öğrenci ekleyebilir" ON public.students
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen')
  );

CREATE POLICY "İdareci, super admin ve öğretmen öğrenci güncelleyebilir" ON public.students
  FOR UPDATE USING (
    public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen')
  );

CREATE POLICY "İdareci ve super admin öğrenci silebilir" ON public.students
  FOR DELETE USING (
    public.get_my_role() IN ('super_admin', 'idareci')
  );

-- ============================================================
-- BOOKS RLS
-- ============================================================

CREATE POLICY "Okul üyeleri kitapları görebilir" ON public.books
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "Her rol kitap ekleyebilir" ON public.books
  FOR INSERT WITH CHECK (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "Her rol kitap güncelleyebilir" ON public.books
  FOR UPDATE USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "Her rol kitap silebilir" ON public.books
  FOR DELETE USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

-- ============================================================
-- STUDENT_BOOKS RLS
-- ============================================================

CREATE POLICY "Okul üyeleri öğrenci kitaplarını görebilir" ON public.student_books
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_books.student_id
      AND (s.school_id = public.get_my_school_id()
        OR public.get_my_role() = 'super_admin')
    )
  );

CREATE POLICY "Öğretmen ve üstü kitap atayabilir" ON public.student_books
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen')
  );

CREATE POLICY "Öğretmen ve üstü kitap durumunu güncelleyebilir" ON public.student_books
  FOR UPDATE USING (
    public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen')
  );

-- ============================================================
-- READING_LOGS RLS
-- ============================================================

CREATE POLICY "Okul üyeleri okuma loglarını görebilir" ON public.reading_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = reading_logs.student_id
      AND (s.school_id = public.get_my_school_id()
        OR public.get_my_role() = 'super_admin')
    )
  );

CREATE POLICY "Öğretmen kendi sınıfındaki logları ekleyebilir" ON public.reading_logs
  FOR INSERT WITH CHECK (
    marked_by = auth.uid()
    AND (
      public.get_my_role() IN ('super_admin', 'idareci', 'ogretmen')
    )
  );

CREATE POLICY "Öğretmen kendi sınıfındaki logları güncelleyebilir" ON public.reading_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.teacher_classes tc
      WHERE tc.teacher_id = auth.uid()
      AND tc.class_id = reading_logs.class_id
    )
    OR public.get_my_role() IN ('super_admin', 'idareci')
  );

-- ============================================================
-- İndeksler (Performans için)
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

-- ============================================================
-- Tetikleyici: Yeni auth.users kaydına otomatik profile oluştur
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
    -- Create new school with user-provided code
    IF v_school_code IS NULL THEN
      v_school_code := public.generate_school_code();
    END IF;

    -- Check if code already exists
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
