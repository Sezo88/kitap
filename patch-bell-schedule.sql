-- Zil Saatleri (Bell Schedule) Tablosu
-- Supabase SQL Editor'da çalıştırın

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

-- Okul üyeleri okuyabilir
CREATE POLICY "bell_schedule_select" ON public.bell_schedule
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

-- Sadece idareci/super_admin yazabilir
CREATE POLICY "bell_schedule_insert" ON public.bell_schedule
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "bell_schedule_update" ON public.bell_schedule
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "bell_schedule_delete" ON public.bell_schedule
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE INDEX idx_bell_schedule_school ON public.bell_schedule(school_id);
