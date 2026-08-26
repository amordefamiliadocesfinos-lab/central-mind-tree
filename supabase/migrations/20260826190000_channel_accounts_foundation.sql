-- FASE 3A + 3B: identidade canônica de Conta/Loja.
-- digital_platforms continua sendo a fonte de Plataforma; nenhum consumidor legado é migrado aqui.
CREATE TABLE public.channel_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.digital_platforms(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name) <> ''),
  external_identifier text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A mesma conta não pode ser repetida dentro da mesma plataforma, inclusive por caixa/espaços.
CREATE UNIQUE INDEX channel_accounts_platform_name_unique_idx
  ON public.channel_accounts (platform_id, lower(btrim(name)));

CREATE INDEX channel_accounts_platform_id_idx
  ON public.channel_accounts (platform_id);

ALTER TABLE public.channel_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on channel_accounts"
  ON public.channel_accounts FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_channel_accounts_updated_at
  BEFORE UPDATE ON public.channel_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
