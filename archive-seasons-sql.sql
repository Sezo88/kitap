-- Arşiv Sezonları Sistemi
-- Bu scripti Supabase SQL Editor'da çalıştırın

-- 1. Sezon metadata tablosu
CREATE TABLE IF NOT EXISTS archive_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(school_id, name)
);

-- 2. Aktivite tablolarina season_name kolonu ekle
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS season_name TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS season_name TEXT;
ALTER TABLE student_projects ADD COLUMN IF NOT EXISTS season_name TEXT;
ALTER TABLE cleanliness_scores ADD COLUMN IF NOT EXISTS season_name TEXT;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS season_name TEXT;

-- 3. Indexler (hizli filtreleme icin)
CREATE INDEX IF NOT EXISTS idx_reading_logs_season ON reading_logs(season_name);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_season ON attendance_logs(season_name);
CREATE INDEX IF NOT EXISTS idx_student_projects_season ON student_projects(season_name);
CREATE INDEX IF NOT EXISTS idx_cleanliness_scores_season ON cleanliness_scores(season_name);
CREATE INDEX IF NOT EXISTS idx_sms_logs_season ON sms_logs(season_name);

-- 4. RLS: archive_seasons
ALTER TABLE archive_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "archive_seasons_select" ON archive_seasons FOR SELECT USING (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "archive_seasons_insert" ON archive_seasons FOR INSERT WITH CHECK (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'idareci'))
);
CREATE POLICY "archive_seasons_delete" ON archive_seasons FOR DELETE USING (
  school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'idareci'))
);
