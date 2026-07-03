-- Komut Durumunu Güncelleyen RPC Fonksiyonu
-- Supabase SQL Editor'da çalıştırın

CREATE OR REPLACE FUNCTION public.acknowledge_bell_commands(p_cmd_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.bell_commands
  SET status = 'acknowledged'
  WHERE id = ANY(p_cmd_ids);
END;
$$;
