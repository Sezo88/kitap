-- Nöbet Programı (Duty Schedule) Tablosu
-- Supabase SQL Editor'da çalıştırın

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

-- Okul üyeleri okuyabilir
CREATE POLICY "duty_schedule_select" ON public.duty_schedule
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

-- Sadece idareci/super_admin yazabilir
CREATE POLICY "duty_schedule_insert" ON public.duty_schedule
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "duty_schedule_update" ON public.duty_schedule
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "duty_schedule_delete" ON public.duty_schedule
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE INDEX idx_duty_schedule_school ON public.duty_schedule(school_id);
CREATE INDEX idx_duty_schedule_teacher ON public.duty_schedule(teacher_id, day_of_week);
