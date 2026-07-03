-- Zil Uzaktan Açma / Kapatma Alanları
-- Supabase SQL Editor'da çalıştırın

-- schools tablosuna zil aktiflik durum sütunu ekle
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS bell_active boolean NOT NULL DEFAULT true;

-- bell_commands tablosuna mute_bell ve unmute_bell komut türlerini ekle
ALTER TABLE public.bell_commands DROP CONSTRAINT IF EXISTS bell_commands_command_type_check;
ALTER TABLE public.bell_commands ADD CONSTRAINT bell_commands_command_type_check 
  CHECK (command_type IN ('play_bell', 'play_anthem', 'custom_announcement', 'stop_sound', 'play_ceremony', 'mute_bell', 'unmute_bell'));

-- Heartbeat fonksiyonunu bell_active parametresiyle güncelle
CREATE OR REPLACE FUNCTION public.bell_heartbeat(p_school_id uuid, p_bell_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.schools
  SET last_bell_heartbeat = now(),
      bell_active = p_bell_active
  WHERE id = p_school_id;
END;
$$;
