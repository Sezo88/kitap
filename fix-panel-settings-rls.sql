-- ============================================================
-- PANEL_SETTINGS ANONİM OKUMA POLİTİKASI (RLS)
-- ============================================================
-- Akıllı tahtalar ve panolar oturum açmadan (anonim) çalıştığı için
-- panel_settings tablosundaki saat ve ayarları doğrudan okuyabilmeleri
-- için aşağıdaki politikayı Supabase SQL Editor'de çalıştırabilirsiniz.

DROP POLICY IF EXISTS "panel_settings_select" ON public.panel_settings;
DROP POLICY IF EXISTS "panel_settings_anon_select" ON public.panel_settings;

CREATE POLICY "panel_settings_select" ON public.panel_settings
  FOR SELECT
  TO public
  USING (true);
