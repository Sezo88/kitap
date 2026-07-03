-- bell_commands tablosuna tören komutu (play_ceremony) ekleme
-- Supabase SQL Editor'da çalıştırın

ALTER TABLE public.bell_commands DROP CONSTRAINT IF EXISTS bell_commands_command_type_check;
ALTER TABLE public.bell_commands ADD CONSTRAINT bell_commands_command_type_check 
  CHECK (command_type IN ('play_bell', 'play_anthem', 'custom_announcement', 'stop_sound', 'play_ceremony'));
