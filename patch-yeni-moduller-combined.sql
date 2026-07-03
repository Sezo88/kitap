-- Okul Asistanı — Yeni Modüller Kombine SQL Yaması (Faz 1 - Faz 4)
-- Mevcut veritabanınıza uygulamak için sadece BU DOSYAYI Supabase SQL Editor'da çalıştırın.

-- ============================================================
-- FAZ 1: Doğum Günü & Zil Saatleri & Ders Programı & Nöbet Programı
-- ============================================================

-- 1.1 Doğum Günü Alanı
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS dogum_tarihi date DEFAULT NULL;

-- 1.2 Zil Saatleri (Bell Schedule)
CREATE TABLE IF NOT EXISTS public.bell_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period_no int NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  label text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, period_no)
);

ALTER TABLE public.bell_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bell_schedule_select" ON public.bell_schedule;
CREATE POLICY "bell_schedule_select" ON public.bell_schedule
  FOR SELECT USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "bell_schedule_insert" ON public.bell_schedule;
CREATE POLICY "bell_schedule_insert" ON public.bell_schedule
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

DROP POLICY IF EXISTS "bell_schedule_update" ON public.bell_schedule;
CREATE POLICY "bell_schedule_update" ON public.bell_schedule
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

DROP POLICY IF EXISTS "bell_schedule_delete" ON public.bell_schedule;
CREATE POLICY "bell_schedule_delete" ON public.bell_schedule
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE INDEX IF NOT EXISTS idx_bell_schedule_school ON public.bell_schedule(school_id);


-- 1.3 Ders Programı (Lesson Schedule)
CREATE TABLE IF NOT EXISTS public.lesson_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  period_no int NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, class_id, day_of_week, period_no)
);

ALTER TABLE public.lesson_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_schedule_select" ON public.lesson_schedule;
CREATE POLICY "lesson_schedule_select" ON public.lesson_schedule
  FOR SELECT USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "lesson_schedule_insert" ON public.lesson_schedule;
CREATE POLICY "lesson_schedule_insert" ON public.lesson_schedule
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

DROP POLICY IF EXISTS "lesson_schedule_update" ON public.lesson_schedule;
CREATE POLICY "lesson_schedule_update" ON public.lesson_schedule
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

DROP POLICY IF EXISTS "lesson_schedule_delete" ON public.lesson_schedule;
CREATE POLICY "lesson_schedule_delete" ON public.lesson_schedule
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE INDEX IF NOT EXISTS idx_lesson_schedule_school ON public.lesson_schedule(school_id);
CREATE INDEX IF NOT EXISTS idx_lesson_schedule_teacher ON public.lesson_schedule(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_schedule_class_day ON public.lesson_schedule(class_id, day_of_week);


-- 1.4 Nöbet Programı (Duty Schedule)
CREATE TABLE IF NOT EXISTS public.duty_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  time_slot text NOT NULL,
  location text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, teacher_id, day_of_week, time_slot)
);

ALTER TABLE public.duty_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_schedule_select" ON public.duty_schedule;
CREATE POLICY "duty_schedule_select" ON public.duty_schedule
  FOR SELECT USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "duty_schedule_insert" ON public.duty_schedule;
CREATE POLICY "duty_schedule_insert" ON public.duty_schedule
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

DROP POLICY IF EXISTS "duty_schedule_update" ON public.duty_schedule;
CREATE POLICY "duty_schedule_update" ON public.duty_schedule
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

DROP POLICY IF EXISTS "duty_schedule_delete" ON public.duty_schedule;
CREATE POLICY "duty_schedule_delete" ON public.duty_schedule
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE INDEX IF NOT EXISTS idx_duty_schedule_school ON public.duty_schedule(school_id);
CREATE INDEX IF NOT EXISTS idx_duty_schedule_teacher ON public.duty_schedule(teacher_id, day_of_week);


-- ============================================================
-- FAZ 3: Zil Programı Entegrasyonu (Zil Kontrol Komutları)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bell_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  command_type text NOT NULL CHECK (command_type IN ('play_bell', 'play_anthem', 'custom_announcement', 'stop_sound', 'play_ceremony', 'mute_bell', 'unmute_bell')),
  triggered_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  triggered_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bell_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bell_commands_select" ON public.bell_commands;
CREATE POLICY "bell_commands_select" ON public.bell_commands
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "bell_commands_insert" ON public.bell_commands;
CREATE POLICY "bell_commands_insert" ON public.bell_commands
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

DROP POLICY IF EXISTS "bell_commands_update" ON public.bell_commands;
CREATE POLICY "bell_commands_update" ON public.bell_commands
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE INDEX IF NOT EXISTS idx_bell_commands_school ON public.bell_commands(school_id, created_at DESC);

-- Realtime yayınına ekle (Eğer daha önce eklenmemişse hata vermez)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bell_commands'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bell_commands;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Yayın yoksa veya yetki hatası varsa yoksay
END $$;


-- ============================================================
-- FAZ 4: Dijital Pano (Raspberry Pi)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.panel_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  active_slides text[] DEFAULT ARRAY['announcements', 'lessons', 'top_readers', 'birthdays', 'duties'],
  slide_duration int DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id)
);

CREATE TABLE IF NOT EXISTS public.panel_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  expires_at date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.panel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "panel_settings_select" ON public.panel_settings;
CREATE POLICY "panel_settings_select" ON public.panel_settings
  FOR SELECT USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "panel_announcements_select" ON public.panel_announcements;
CREATE POLICY "panel_announcements_select" ON public.panel_announcements
  FOR SELECT USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "panel_settings_all" ON public.panel_settings;
CREATE POLICY "panel_settings_all" ON public.panel_settings
  FOR ALL USING (public.get_my_role() IN ('super_admin', 'idareci'));

DROP POLICY IF EXISTS "panel_announcements_all" ON public.panel_announcements;
CREATE POLICY "panel_announcements_all" ON public.panel_announcements
  FOR ALL USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE INDEX IF NOT EXISTS idx_panel_announcements_school ON public.panel_announcements(school_id);

-- ============================================================
-- YENİ: ZİL PROGRAMI HEARTBEAT & UZAKTAN KONTROL İLAVELERİ
-- ============================================================

-- schools tablosuna son görülme alanı ekle
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS bell_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS last_bell_heartbeat timestamptz DEFAULT NULL;

-- Heartbeat tetikleyen RPC fonksiyonu (RLS bypass eder, güvenlidir)
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


-- Okul Kodu Çözümleme RPC Fonksiyonu (RLS bypass eder, zil uygulaması için güvenlidir)
CREATE OR REPLACE FUNCTION public.resolve_school_code(p_code text)
RETURNS TABLE (id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name
  FROM public.schools s
  WHERE upper(s.code) = upper(p_code);
END;
$$;


-- Komut Durumunu Güncelleyen RPC Fonksiyonu (RLS bypass eder, zil uygulaması için güvenlidir)
CREATE OR REPLACE FUNCTION public.acknowledge_bell_commands(p_cmd_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.bell_commands
  SET status = 'acknowledged'
  WHERE id = ANY(p_cmd_ids);
END;
$$;


-- ============================================================
-- YENİ: OKUL LİSANS ÖZELLİKLERİ VE RLS İYİLEŞTİRMELERİ
-- ============================================================

-- schools tablosuna lisans kontrol sütunları ekle
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_attendance boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_library boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_cleanliness boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_lesson_schedule boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_bell boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS license_expires_at timestamptz DEFAULT (now() + interval '1 month');
ALTER TABLE public.schools ALTER COLUMN license_expires_at SET DEFAULT (now() + interval '1 month');

-- Süper adminler için tüm okulları görme ve güncelleme RLS politikası
DROP POLICY IF EXISTS "schools_select_super_admin" ON public.schools;
CREATE POLICY "schools_select_super_admin" ON public.schools
  FOR SELECT USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "schools_update_super_admin" ON public.schools;
CREATE POLICY "schools_update_super_admin" ON public.schools
  FOR UPDATE USING (public.get_my_role() = 'super_admin');

