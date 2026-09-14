-- Migration: Nöbet İstatistikleri Tablosu (Fazla Nöbet Takibi)
-- Tarih: 2026-09-14

CREATE TABLE IF NOT EXISTS public.duty_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_name text NOT NULL,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_duties integer NOT NULL DEFAULT 0,
  extra_duties integer NOT NULL DEFAULT 0,
  last_duty_date timestamptz DEFAULT now(),
  notes text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT duty_stats_school_teacher_unique UNIQUE(school_id, teacher_name)
);

-- duty_schedule tablosunda çift/ek nöbet bayrağı
ALTER TABLE public.duty_schedule 
ADD COLUMN IF NOT EXISTS is_extra boolean DEFAULT false;

ALTER TABLE public.duty_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_stats_select" ON public.duty_stats;
CREATE POLICY "duty_stats_select" ON public.duty_stats
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "duty_stats_insert" ON public.duty_stats;
CREATE POLICY "duty_stats_insert" ON public.duty_stats
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

DROP POLICY IF EXISTS "duty_stats_update" ON public.duty_stats;
CREATE POLICY "duty_stats_update" ON public.duty_stats
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

DROP POLICY IF EXISTS "duty_stats_delete" ON public.duty_stats;
CREATE POLICY "duty_stats_delete" ON public.duty_stats
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));
