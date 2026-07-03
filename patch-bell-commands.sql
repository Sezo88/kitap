-- Zil Kontrol Komutları (Bell Commands) Tablosu
-- Supabase SQL Editor'da çalıştırın

CREATE TABLE IF NOT EXISTS public.bell_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  command_type text NOT NULL CHECK (command_type IN ('play_bell', 'play_anthem', 'custom_announcement')),
  triggered_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  triggered_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bell_commands ENABLE ROW LEVEL SECURITY;

-- Okul üyeleri görebilir
CREATE POLICY "bell_commands_select" ON public.bell_commands
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    OR public.get_my_role() = 'super_admin'
  );

-- Sadece idareci/super_admin ekleyebilir
CREATE POLICY "bell_commands_insert" ON public.bell_commands
  FOR INSERT WITH CHECK (public.get_my_role() IN ('super_admin', 'idareci'));

-- Status güncelleme (Electron ack için — service role kullanılacak)
CREATE POLICY "bell_commands_update" ON public.bell_commands
  FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'idareci'));

CREATE INDEX idx_bell_commands_school ON public.bell_commands(school_id, created_at DESC);

-- Realtime için bu tabloyu yayınla
ALTER PUBLICATION supabase_realtime ADD TABLE public.bell_commands;
