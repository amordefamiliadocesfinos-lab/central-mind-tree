-- FASE 3E: referências canônicas opcionais para o Financeiro.
-- Textos legados permanecem íntegros; não há backfill de histórico.
ALTER TABLE public.financial_entries
  ADD COLUMN platform_id uuid REFERENCES public.digital_platforms(id) ON DELETE RESTRICT,
  ADD COLUMN channel_account_id uuid REFERENCES public.channel_accounts(id) ON DELETE RESTRICT;

CREATE INDEX financial_entries_platform_id_idx ON public.financial_entries (platform_id);
CREATE INDEX financial_entries_channel_account_id_idx ON public.financial_entries (channel_account_id);

ALTER TABLE public.marketplace_settlements
  ADD COLUMN platform_id uuid REFERENCES public.digital_platforms(id) ON DELETE RESTRICT,
  ADD COLUMN channel_account_id uuid REFERENCES public.channel_accounts(id) ON DELETE RESTRICT;

CREATE INDEX marketplace_settlements_platform_id_idx ON public.marketplace_settlements (platform_id);
CREATE INDEX marketplace_settlements_channel_account_id_idx ON public.marketplace_settlements (channel_account_id);

-- Um lançamento novo ligado a Pedido herda a identidade canônica quando ela já existe no Pedido.
CREATE OR REPLACE FUNCTION public.inherit_financial_channel_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_account_id uuid;
  v_platform_id uuid;
  v_channel text;
  v_marketplace_account text;
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.channel_account_id, o.channel, o.marketplace_account, ca.platform_id
    INTO v_channel_account_id, v_channel, v_marketplace_account, v_platform_id
  FROM public.orders o
  LEFT JOIN public.channel_accounts ca ON ca.id = o.channel_account_id
  WHERE o.id = NEW.order_id;

  IF v_channel_account_id IS NOT NULL THEN
    NEW.channel_account_id := COALESCE(NEW.channel_account_id, v_channel_account_id);
    NEW.platform_id := COALESCE(NEW.platform_id, v_platform_id);
  END IF;
  NEW.sales_channel := COALESCE(NEW.sales_channel, v_channel);
  NEW.marketplace_account := COALESCE(NEW.marketplace_account, v_marketplace_account);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_financial_channel_references ON public.financial_entries;
CREATE TRIGGER trg_inherit_financial_channel_references
  BEFORE INSERT OR UPDATE OF order_id ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.inherit_financial_channel_references();
