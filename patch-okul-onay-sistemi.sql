-- Okul Kodu + Onay Sistemi (Trigger + Tablo Güncellemeleri)
-- Supabase SQL Editor'da çalıştırın

-- 1. profiles tablosuna status ekle
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 2. schools tablosuna benzersiz kod ekle
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.schools ADD CONSTRAINT schools_code_unique UNIQUE (code);

-- Mevcut okullara kod üret
UPDATE public.schools SET code = upper(substring(md5(random()::text), 1, 6)) WHERE code IS NULL;
ALTER TABLE public.schools ALTER COLUMN code SET NOT NULL;

-- 3. Benzersiz okul kodu üreten fonksiyon
CREATE OR REPLACE FUNCTION public.generate_school_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  new_code text;
BEGIN
  LOOP
    new_code := upper(substring(md5(random()::text), 1, 6));
    IF NOT EXISTS (SELECT 1 FROM public.schools WHERE code = new_code) THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- 4. YENİ TRIGGER: handle_new_user (okul oluşturma + onay sistemi)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_school_action text;
  v_school_code text;
  v_school_name text;
  v_school_id uuid;
  v_status text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'ogretmen');
  v_school_action := NEW.raw_user_meta_data ->> 'school_action';
  v_school_code := NEW.raw_user_meta_data ->> 'school_code';
  v_school_name := NEW.raw_user_meta_data ->> 'school_name';

  -- Determine school and status
  IF v_school_action = 'create' AND v_school_name IS NOT NULL THEN
    -- Create new school with user-provided code
    IF v_school_code IS NULL THEN
      v_school_code := public.generate_school_code();
    END IF;

    -- Check if code already exists
    IF EXISTS (SELECT 1 FROM public.schools WHERE upper(code) = upper(v_school_code)) THEN
      RAISE EXCEPTION 'Bu okul kodu zaten kullanılıyor: %', v_school_code;
    END IF;

    INSERT INTO public.schools (name, code, created_by)
    VALUES (v_school_name, upper(v_school_code), NEW.id)
    RETURNING id INTO v_school_id;
    v_status := 'active';
  ELSIF v_school_code IS NOT NULL THEN
    -- Join existing school by code
    SELECT id INTO v_school_id FROM public.schools WHERE upper(code) = upper(v_school_code);
    IF v_school_id IS NULL THEN
      RAISE EXCEPTION 'Geçersiz okul kodu: %', v_school_code;
    END IF;
    -- Öğretmenler ve mevcut okula katılan idareciler onay bekler
    v_status := 'pending';
  ELSE
    -- Süper admin veya direkt kayıt
    v_status := 'active';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, school_id, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    v_role,
    v_school_id,
    v_status
  );

  RETURN NEW;
END;
$$;

-- 5. RLS: İdareci kendi okulundaki pending profilleri onaylayabilsin
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR (
      public.get_my_role() = 'idareci'
      AND school_id = public.get_my_school_id()
      AND status = 'pending'
    )
  );
