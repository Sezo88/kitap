-- Okul Kodu Çözümleme RPC Fonksiyonu
-- Supabase SQL Editor'da çalıştırın

CREATE OR REPLACE FUNCTION public.resolve_school_code(p_code text)
RETURNS TABLE (id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name
  FROM public.schools s
  WHERE upper(s.code) = upper(p_code);
END;
$$;
