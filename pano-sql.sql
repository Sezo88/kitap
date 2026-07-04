-- Dijital Pano Sistemi Tablolari
-- Bu scripti Supabase SQL Editor'da calistirin
-- Tekrar calistirilabilir (DROP IF EXISTS kullanir)

-- 0. Mevcut tablolara eksik kolonlari ekle (ilk calistirmada hata almamak icin)
ALTER TABLE panel_announcements ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'duyuru';
ALTER TABLE panel_announcements ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE panel_announcements ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0;
ALTER TABLE panel_announcements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE panel_announcements ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- 1. Schools tablosuna pano PIN ve token ekle
ALTER TABLE schools ADD COLUMN IF NOT EXISTS pano_pin TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS pano_token TEXT;

-- 2. Pano duyurulari
CREATE TABLE IF NOT EXISTS panel_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  category TEXT DEFAULT 'duyuru',
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- 3. Pano galerisi (Cloudinary URL'leri)
CREATE TABLE IF NOT EXISTS panel_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  cloudinary_url TEXT NOT NULL,
  caption TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- 4. Pano temasi ve ayarlari
CREATE TABLE IF NOT EXISTS panel_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE UNIQUE,
  theme TEXT DEFAULT 'blue',
  school_logo_url TEXT,
  school_motto TEXT,
  slide_interval INT DEFAULT 10,
  show_weather BOOLEAN DEFAULT false,
  show_clock BOOLEAN DEFAULT true,
  show_top_readers BOOLEAN DEFAULT true,
  show_top_class BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

-- 5. RLS ve Politikalar (tekrar calistirilabilir)
ALTER TABLE panel_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel_config ENABLE ROW LEVEL SECURITY;

-- Eski politikalari temizle
DROP POLICY IF EXISTS "pa_select" ON panel_announcements;
DROP POLICY IF EXISTS "pa_insert" ON panel_announcements;
DROP POLICY IF EXISTS "pa_update" ON panel_announcements;
DROP POLICY IF EXISTS "pa_delete" ON panel_announcements;
DROP POLICY IF EXISTS "pa_anon_select" ON panel_announcements;

DROP POLICY IF EXISTS "pg_select" ON panel_gallery;
DROP POLICY IF EXISTS "pg_insert" ON panel_gallery;
DROP POLICY IF EXISTS "pg_delete" ON panel_gallery;
DROP POLICY IF EXISTS "pg_anon_select" ON panel_gallery;

DROP POLICY IF EXISTS "pc_select" ON panel_config;
DROP POLICY IF EXISTS "pc_insert" ON panel_config;
DROP POLICY IF EXISTS "pc_update" ON panel_config;
DROP POLICY IF EXISTS "pc_anon_select" ON panel_config;

DROP POLICY IF EXISTS "schools_anon_pin" ON schools;
DROP POLICY IF EXISTS "bell_anon_select" ON bell_schedule;
DROP POLICY IF EXISTS "lesson_anon_select" ON lesson_schedule;
DROP POLICY IF EXISTS "duty_anon_select" ON duty_schedule;
DROP POLICY IF EXISTS "students_anon_select" ON students;
DROP POLICY IF EXISTS "student_books_anon_select" ON student_books;

-- panel_announcements politikalari
CREATE POLICY "pa_select" ON panel_announcements FOR SELECT USING (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM schools WHERE id = panel_announcements.school_id))
);
CREATE POLICY "pa_insert" ON panel_announcements FOR INSERT WITH CHECK (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'idareci'))
);
CREATE POLICY "pa_update" ON panel_announcements FOR UPDATE USING (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'idareci'))
);
CREATE POLICY "pa_delete" ON panel_announcements FOR DELETE USING (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'idareci'))
);

-- panel_gallery politikalari
CREATE POLICY "pg_select" ON panel_gallery FOR SELECT USING (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM schools WHERE id = panel_gallery.school_id))
);
CREATE POLICY "pg_insert" ON panel_gallery FOR INSERT WITH CHECK (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'idareci'))
);
CREATE POLICY "pg_delete" ON panel_gallery FOR DELETE USING (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'idareci'))
);

-- panel_config politikalari
CREATE POLICY "pc_select" ON panel_config FOR SELECT USING (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM schools WHERE id = panel_config.school_id))
);
CREATE POLICY "pc_insert" ON panel_config FOR INSERT WITH CHECK (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'idareci'))
);
CREATE POLICY "pc_update" ON panel_config FOR UPDATE USING (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'idareci'))
);

-- 6. PANO ICIN ANON OKUMA POLITIKALARI (CRITICAL!)
-- Bunlar olmadan pano PIN girisi calismaz!

-- panel tablolari anon okuma
CREATE POLICY "pa_anon_select" ON panel_announcements FOR SELECT USING (true);
CREATE POLICY "pg_anon_select" ON panel_gallery FOR SELECT USING (true);
CREATE POLICY "pc_anon_select" ON panel_config FOR SELECT USING (true);

-- schools tablosu (PIN kontrolu)
CREATE POLICY "schools_anon_pin" ON schools FOR SELECT USING (true);

-- bell_schedule (saat-ders durumu)
CREATE POLICY "bell_anon_select" ON bell_schedule FOR SELECT USING (true);

-- lesson_schedule (ders programi)
CREATE POLICY "lesson_anon_select" ON lesson_schedule FOR SELECT USING (true);

-- duty_schedule (nobetciler)
CREATE POLICY "duty_anon_select" ON duty_schedule FOR SELECT USING (true);

-- students (dogum gunu, isimler)
CREATE POLICY "students_anon_select" ON students FOR SELECT USING (true);

-- student_books (en cok okuyan siralamasi)
CREATE POLICY "student_books_anon_select" ON student_books FOR SELECT USING (true);
