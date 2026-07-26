-- ============================================================================
-- FAZ 0 & FAZ 1 MİGRASYON SCRIPT'İ
-- Proje: kitapokuma (Supabase SQL Editor Üzerinde Çalıştırılacak)
-- ============================================================================

-- 0. pgcrypto Eklentisi Güvencesi
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- FAZ 0.1 — schools Tablosu RLS Sıkılaştırma & verify_pano_pin RPC
-- ----------------------------------------------------------------------------

-- Mevcut genel okuma politikasını kaldır
DROP POLICY IF EXISTS "schools_select" ON public.schools;
DROP POLICY IF EXISTS "schools_select_own" ON public.schools;

-- Sadece idarecinin kendi okulunu ve super_admin'i okumasına izin ver
CREATE POLICY "schools_select_own" ON public.schools
  FOR SELECT USING (
    id = public.get_my_school_id() OR public.get_my_role() = 'super_admin'
  );

-- /pano ekranı için anon PIN doğrulama RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.verify_pano_pin(p_pin text)
RETURNS TABLE (school_id uuid, school_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name
  FROM public.schools s
  WHERE s.pano_pin = p_pin AND p_pin IS NOT NULL AND p_pin != '';
END;
$$;


-- ----------------------------------------------------------------------------
-- FAZ 0.2 — bell_commands Cross-School RLS Sıkılaştırması
-- ----------------------------------------------------------------------------

-- INSERT politikası
DROP POLICY IF EXISTS "bell_commands_insert" ON public.bell_commands;
CREATE POLICY "bell_commands_insert" ON public.bell_commands
  FOR INSERT WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_role() = 'idareci' AND school_id = public.get_my_school_id())
  );

-- SELECT politikası
DROP POLICY IF EXISTS "bell_commands_select" ON public.bell_commands;
CREATE POLICY "bell_commands_select" ON public.bell_commands
  FOR SELECT USING (
    public.get_my_role() = 'super_admin'
    OR school_id = public.get_my_school_id()
  );

-- UPDATE politikası
DROP POLICY IF EXISTS "bell_commands_update" ON public.bell_commands;
CREATE POLICY "bell_commands_update" ON public.bell_commands
  FOR UPDATE USING (
    public.get_my_role() = 'super_admin'
    OR school_id = public.get_my_school_id()
  );


-- ----------------------------------------------------------------------------
-- FAZ 1 — Zil Uygulamasına PIN Ekleme & Güvenli RPC'ler
-- ----------------------------------------------------------------------------

-- 1.1 PIN Hash Sütunu
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS bell_api_pin_hash text;

-- 1.2 Güvenli Okul Kodu + PIN Eşleştirme RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.resolve_school_code_secure(p_code text, p_pin text DEFAULT NULL)
RETURNS TABLE (school_id uuid, school_name text, license_expires_at timestamptz, feature_bell boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.license_expires_at, s.feature_bell
  FROM public.schools s
  WHERE s.code = UPPER(TRIM(p_code))
    AND (
      -- Geçiş dönemi: PIN henüz belirlenmemişse (NULL veya boş), sadece okul koduyla geçişe izin ver
      s.bell_api_pin_hash IS NULL
      OR s.bell_api_pin_hash = ''
      -- PIN belirlenmişse pgcrypto crypt ile doğrula
      OR (p_pin IS NOT NULL AND s.bell_api_pin_hash = extensions.crypt(TRIM(p_pin), s.bell_api_pin_hash))
    );
END;
$$;

-- 1.3 İdareci / Super Admin Tarafından Zil API PIN Belirleme RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.set_bell_pin(p_school_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF public.get_my_role() = 'super_admin' OR (public.get_my_role() = 'idareci' AND p_school_id = public.get_my_school_id()) THEN
    IF p_pin IS NULL OR LENGTH(TRIM(p_pin)) < 4 THEN
      RAISE EXCEPTION 'PIN en az 4 karakter olmalıdır.';
    END IF;

    UPDATE public.schools
    SET bell_api_pin_hash = extensions.crypt(TRIM(p_pin), extensions.gen_salt('bf'))
    WHERE id = p_school_id;

    RETURN true;
  ELSE
    RAISE EXCEPTION 'Yetkisiz erişim';
  END IF;
END;
$$;
