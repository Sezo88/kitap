-- ============================================================
-- Ortak Sınav Takvimi (Ortak Sınav Tarihleri) Modülü
-- ============================================================

-- 1. Sınav Dönemleri Tablosu
CREATE TABLE IF NOT EXISTS public.exam_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL, -- örn: '1. Dönem 1. Ortak Sınavlar'
  academic_year text NOT NULL DEFAULT '2024-2025',
  start_date date NOT NULL,
  end_date date NOT NULL,
  allowed_dates jsonb DEFAULT '[]'::jsonb, -- Özel seçilebilir tarihler listesi (boşsa aralıktaki tüm hafta içi günler)
  max_exams_per_day int NOT NULL DEFAULT 2, -- Aynı gün bir sınıf düzeyinde (kademede) yapılabilecek maksimum sınav sayısı
  is_active boolean NOT NULL DEFAULT true, -- Öğretmenler tarih belirleyebilir mi (Aktif / Pasif)
  is_published boolean NOT NULL DEFAULT true, -- Veli & öğretmen ekranında yayında mı
  notes text DEFAULT 'Sınavlar ilan edilen ders saatinde sınıflarda uygulanacaktır. Tüm öğrencilerimize başarılar dileriz.',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Sınav Takvimi Kayıtları (Ders & Kademe & Tarih Eşleşmesi)
CREATE TABLE IF NOT EXISTS public.exam_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.exam_periods(id) ON DELETE CASCADE,
  grade_level int NOT NULL, -- 5, 6, 7, 8 vb.
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  lesson_period int NOT NULL DEFAULT 2, -- Kaçıncı ders saatinde yapılacağı (1. Ders, 2. Ders vb.)
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_period_grade_subject UNIQUE(period_id, grade_level, subject_id),
  CONSTRAINT uq_period_grade_date_lesson UNIQUE(period_id, grade_level, exam_date, lesson_period)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_exam_periods_school ON public.exam_periods(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_period ON public.exam_schedules(period_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_school ON public.exam_schedules(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_date ON public.exam_schedules(exam_date);

-- RLS Etkinleştirme
ALTER TABLE public.exam_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_schedules ENABLE ROW LEVEL SECURITY;

-- exam_periods RLS
DROP POLICY IF EXISTS "exam_periods_select" ON public.exam_periods;
CREATE POLICY "exam_periods_select" ON public.exam_periods
  FOR SELECT USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "exam_periods_all_admin" ON public.exam_periods;
CREATE POLICY "exam_periods_all_admin" ON public.exam_periods
  FOR ALL USING (
    (public.get_my_role() IN ('super_admin', 'idareci') AND school_id = public.get_my_school_id())
    OR public.get_my_role() = 'super_admin'
  );

-- exam_schedules RLS
DROP POLICY IF EXISTS "exam_schedules_select" ON public.exam_schedules;
CREATE POLICY "exam_schedules_select" ON public.exam_schedules
  FOR SELECT USING (school_id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "exam_schedules_all_admin" ON public.exam_schedules;
CREATE POLICY "exam_schedules_all_admin" ON public.exam_schedules
  FOR ALL USING (
    (public.get_my_role() IN ('super_admin', 'idareci') AND school_id = public.get_my_school_id())
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "exam_schedules_teacher_insert" ON public.exam_schedules;
CREATE POLICY "exam_schedules_teacher_insert" ON public.exam_schedules
  FOR INSERT WITH CHECK (
    school_id = public.get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM public.exam_periods
      WHERE id = period_id AND is_active = true
    )
  );

DROP POLICY IF EXISTS "exam_schedules_teacher_update" ON public.exam_schedules;
CREATE POLICY "exam_schedules_teacher_update" ON public.exam_schedules
  FOR UPDATE USING (
    school_id = public.get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM public.exam_periods
      WHERE id = period_id AND is_active = true
    )
  );

DROP POLICY IF EXISTS "exam_schedules_teacher_delete" ON public.exam_schedules;
CREATE POLICY "exam_schedules_teacher_delete" ON public.exam_schedules
  FOR DELETE USING (
    school_id = public.get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM public.exam_periods
      WHERE id = period_id AND is_active = true
    )
  );
