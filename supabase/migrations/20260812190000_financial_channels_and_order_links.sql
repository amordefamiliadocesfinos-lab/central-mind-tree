CREATE TABLE IF NOT EXISTS public.financial_order_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  financial_entry_id uuid NOT NULL REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  allocated_value numeric NOT NULL CHECK (allocated_value > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id),
  UNIQUE (order_id, financial_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_order_links_entry
  ON public.financial_order_links(financial_entry_id);

ALTER TABLE public.financial_order_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users manage financial_order_links" ON public.financial_order_links;
CREATE POLICY "Authenticated users manage financial_order_links"
  ON public.financial_order_links FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION public.link_order_to_existing_financial_entry(
  p_order_id uuid,
  p_entry_id uuid,
  p_allocated_value numeric,
  p_sales_channel text,
  p_marketplace_account text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_id uuid;
  v_entry public.financial_entries%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_allocated numeric;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  SELECT * INTO v_entry FROM public.financial_entries WHERE id = p_entry_id AND type = 'receber' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrada financeira não encontrada.'; END IF;
  IF EXISTS (SELECT 1 FROM public.financial_order_links WHERE order_id = p_order_id)
     OR EXISTS (SELECT 1 FROM public.financial_entries WHERE order_id = p_order_id AND type = 'receber') THEN
    RAISE EXCEPTION 'Este pedido já possui vínculo financeiro.';
  END IF;
  SELECT COALESCE(sum(allocated_value), 0) INTO v_allocated
    FROM public.financial_order_links WHERE financial_entry_id = p_entry_id;
  IF p_allocated_value <= 0 OR v_allocated + p_allocated_value > v_entry.value + 0.01 THEN
    RAISE EXCEPTION 'O valor vinculado ultrapassa o valor da entrada.';
  END IF;

  INSERT INTO public.financial_order_links(order_id, financial_entry_id, allocated_value)
  VALUES (p_order_id, p_entry_id, p_allocated_value) RETURNING id INTO v_link_id;

  UPDATE public.financial_entries SET
    sales_channel = NULLIF(p_sales_channel, ''),
    marketplace_account = NULLIF(p_marketplace_account, ''),
    contact_id = COALESCE(contact_id, v_order.contact_id),
    notes = concat_ws(E'\n', notes, 'Pedido vinculado: ' || COALESCE(v_order.order_number, v_order.id::text))
  WHERE id = p_entry_id;
  UPDATE public.orders SET
    channel = COALESCE(NULLIF(p_sales_channel, ''), channel),
    marketplace_account = COALESCE(NULLIF(p_marketplace_account, ''), marketplace_account)
  WHERE id = p_order_id;
  RETURN v_link_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_order_to_existing_financial_entry(uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_order_to_existing_financial_entry(uuid, uuid, numeric, text, text) TO authenticated;
