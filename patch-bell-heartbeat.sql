-- Zil Programı Heartbeat & RLS İyileştirmesi
-- Supabase SQL Editor'da çalıştırın

-- 1. schools tablosuna son görülme alanı ekle
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS last_bell_heartbeat timestamptz DEFAULT NULL;

-- 2. bell_commands anonim select RLS politikası (Electron realtime dinlemesi için)
DROP POLICY IF EXISTS "bell_commands_select" ON public.bell_commands;
CREATE POLICY "bell_commands_select" ON public.bell_commands
  FOR SELECT USING (true);

-- 3. Heartbeat tetikleyen RPC fonksiyonu (RLS bypass eder, güvenlidir)
CREATE OR REPLACE FUNCTION public.bell_heartbeat(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.schools
  SET last_bell_heartbeat = now()
  WHERE id = p_school_id;
END;
$$;
