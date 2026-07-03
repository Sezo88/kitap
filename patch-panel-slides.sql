-- Dijital Pano Tabloları
-- Supabase SQL Editor'da çalıştırın

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

-- Select
CREATE POLICY "panel_settings_select" ON public.panel_settings
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

CREATE POLICY "panel_announcements_select" ON public.panel_announcements
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

-- Insert/Update/Delete (idareci/super_admin)
CREATE POLICY "panel_settings_all" ON public.panel_settings
  FOR ALL USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "panel_announcements_all" ON public.panel_announcements
  FOR ALL USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE INDEX idx_panel_announcements_school ON public.panel_announcements(school_id);
