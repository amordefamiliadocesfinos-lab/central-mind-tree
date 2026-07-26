ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid NULL
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_auth_user_id_unique
  ON public.app_users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

DO $$
DECLARE
  v_app_id uuid;
  v_app_count int;
  v_auth_id uuid;
  v_auth_count int;
BEGIN
  SELECT count(*) INTO v_app_count FROM public.app_users WHERE name = 'Eu';
  IF v_app_count <> 1 THEN
    RAISE EXCEPTION 'app_users com name = "Eu" deve ser único; encontrados: %', v_app_count;
  END IF;
  SELECT id INTO v_app_id FROM public.app_users WHERE name = 'Eu';

  SELECT count(*) INTO v_auth_count FROM auth.users WHERE email = 'deividijacobus@gmail.com';
  IF v_auth_count <> 1 THEN
    RAISE EXCEPTION 'auth.users com email = "deividijacobus@gmail.com" deve ser único; encontrados: %', v_auth_count;
  END IF;
  SELECT id INTO v_auth_id FROM auth.users WHERE email = 'deividijacobus@gmail.com';

  UPDATE public.app_users SET auth_user_id = v_auth_id WHERE id = v_app_id;
END $$;