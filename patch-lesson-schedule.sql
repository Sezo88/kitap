-- Ders Programı (Lesson Schedule) Tablosu
-- Supabase SQL Editor'da çalıştırın

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

-- Okul üyeleri okuyabilir
CREATE POLICY "lesson_schedule_select" ON public.lesson_schedule
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

-- Sadece idareci/super_admin yazabilir
CREATE POLICY "lesson_schedule_insert" ON public.lesson_schedule
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "lesson_schedule_update" ON public.lesson_schedule
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE POLICY "lesson_schedule_delete" ON public.lesson_schedule
  FOR DELETE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE INDEX idx_lesson_schedule_school ON public.lesson_schedule(school_id);
CREATE INDEX idx_lesson_schedule_teacher ON public.lesson_schedule(teacher_id);
CREATE INDEX idx_lesson_schedule_class_day ON public.lesson_schedule(class_id, day_of_week);
