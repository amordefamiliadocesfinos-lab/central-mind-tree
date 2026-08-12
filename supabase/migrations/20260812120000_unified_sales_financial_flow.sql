-- Fluxo único e transacional: CRM/Operações -> Pedido -> Estoque/Produção -> Financeiro
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS financial_due_date date,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS financial_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketplace_account text;

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS sales_channel text,
  ADD COLUMN IF NOT EXISTS marketplace_account text;

-- A migração anterior tratava FITID como globalmente único, mas bancos podem reutilizá-lo.
DROP INDEX IF EXISTS public.uq_financial_entries_import_external_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_entries_import_external_id
  ON public.financial_entries (account_id, import_source, import_external_id)
  WHERE import_external_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
      CHECK (payment_status IN ('pendente', 'pago', 'parcial')) NOT VALID;
  END IF;
END $$;

-- Um pedido pode ter apenas uma conta principal a receber.
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_receivable_per_order
  ON public.financial_entries (order_id)
  WHERE order_id IS NOT NULL AND type = 'receber' AND parent_entry_id IS NULL;

CREATE TABLE IF NOT EXISTS public.marketplace_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace text NOT NULL,
  marketplace_account text,
  financial_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  settlement_date date NOT NULL,
  gross_value numeric NOT NULL DEFAULT 0,
  fee_value numeric NOT NULL DEFAULT 0,
  net_value numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'conciliado')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_settlement_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.marketplace_settlements(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  gross_value numeric NOT NULL DEFAULT 0,
  fee_value numeric NOT NULL DEFAULT 0,
  net_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_id, order_id)
);

ALTER TABLE public.marketplace_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_settlement_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users manage marketplace_settlements" ON public.marketplace_settlements;
CREATE POLICY "Authenticated users manage marketplace_settlements"
  ON public.marketplace_settlements FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users manage marketplace_settlement_orders" ON public.marketplace_settlement_orders;
CREATE POLICY "Authenticated users manage marketplace_settlement_orders"
  ON public.marketplace_settlement_orders FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION public.create_unified_sale(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_item jsonb;
  v_total numeric := 0;
  v_subtotal numeric := 0;
  v_discount numeric := GREATEST(COALESCE((p_order->>'discount_amount')::numeric, 0), 0);
  v_shipping numeric := GREATEST(COALESCE((p_order->>'shipping_amount')::numeric, 0), 0);
  v_financial_id uuid;
  v_category_id uuid;
  v_prev numeric;
  v_inventory_id uuid;
  v_prod_id uuid;
  v_payment_status text := COALESCE(NULLIF(p_order->>'payment_status', ''), 'pendente');
  v_financial_due date := COALESCE(NULLIF(p_order->>'financial_due_date', '')::date, current_date);
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um produto à venda.';
  END IF;
  IF v_payment_status NOT IN ('pendente', 'pago', 'parcial') THEN
    RAISE EXCEPTION 'Situação financeira inválida.';
  END IF;

  SELECT COALESCE(sum(
    GREATEST(COALESCE((x->>'quantity')::numeric, 0), 0) *
    GREATEST(COALESCE((x->>'unit_price')::numeric, 0), 0)
  ), 0) INTO v_subtotal FROM jsonb_array_elements(p_items) x;
  v_total := GREATEST(v_subtotal - v_discount + v_shipping, 0);
  IF v_total <= 0 THEN RAISE EXCEPTION 'O total da venda deve ser maior que zero.'; END IF;
  IF v_payment_status = 'pago' AND NULLIF(p_order->>'financial_account_id', '') IS NULL THEN
    RAISE EXCEPTION 'Selecione a conta que recebeu o pagamento.';
  END IF;

  INSERT INTO orders (
    order_number, customer_name, customer_contact, contact_id, channel, status,
    total_value, order_date, due_date, delivery_date, financial_due_date, notes,
    order_type, payment_status, payment_method, financial_account_id,
    discount_amount, shipping_amount, marketplace_account
  ) VALUES (
    COALESCE(NULLIF(p_order->>'order_number', ''), 'PED-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint),
    NULLIF(p_order->>'customer_name', ''), NULLIF(p_order->>'customer_contact', ''),
    NULLIF(p_order->>'contact_id', '')::uuid, COALESCE(NULLIF(p_order->>'channel', ''), 'direto'), 'pendente',
    v_total, COALESCE(NULLIF(p_order->>'order_date', '')::date, current_date),
    NULLIF(p_order->>'delivery_date', '')::date, NULLIF(p_order->>'delivery_date', '')::date,
    v_financial_due, NULLIF(p_order->>'notes', ''), COALESCE(NULLIF(p_order->>'order_type', ''), 'production'),
    v_payment_status, NULLIF(p_order->>'payment_method', ''), NULLIF(p_order->>'financial_account_id', '')::uuid,
    v_discount, v_shipping, NULLIF(p_order->>'marketplace_account', '')
  ) RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(v_item->>'product_id', '') IS NULL OR COALESCE((v_item->>'quantity')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Produto ou quantidade inválida.';
    END IF;
    INSERT INTO order_items(order_id, product_id, quantity, unit_price, notes)
    VALUES (v_order.id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::numeric,
      COALESCE((v_item->>'unit_price')::numeric, 0), NULLIF(v_item->>'notes', ''));

    IF v_order.order_type = 'stock' THEN
      SELECT id, quantity INTO v_inventory_id, v_prev FROM inventory
      WHERE product_id = (v_item->>'product_id')::uuid ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
      v_prev := COALESCE(v_prev, 0);
      IF v_inventory_id IS NULL THEN
        INSERT INTO inventory(product_id, quantity) VALUES ((v_item->>'product_id')::uuid, 0) RETURNING id INTO v_inventory_id;
      END IF;
      UPDATE inventory SET quantity = GREATEST(0, v_prev - (v_item->>'quantity')::numeric), updated_at = now()
      WHERE id = v_inventory_id;
      INSERT INTO inventory_movements(product_id, quantity, previous_balance, new_balance, movement_type, reference_type, reference_id, notes)
      VALUES ((v_item->>'product_id')::uuid, -(v_item->>'quantity')::numeric, v_prev,
        GREATEST(0, v_prev - (v_item->>'quantity')::numeric), 'out', 'order', v_order.id, 'Venda ' || v_order.order_number);
    ELSE
      INSERT INTO production_orders(order_number, product_id, target_quantity, status, notes, source_order_id)
      VALUES ('OP-' || v_order.order_number, (v_item->>'product_id')::uuid, (v_item->>'quantity')::numeric,
        'aberto', 'Gerado automaticamente do pedido ' || v_order.order_number, v_order.id)
      RETURNING id INTO v_prod_id;
      INSERT INTO production_order_processes(production_order_id, process_id, is_required)
      SELECT v_prod_id, process_id, true FROM product_processes WHERE product_id = (v_item->>'product_id')::uuid;
    END IF;
  END LOOP;

  SELECT id INTO v_category_id FROM financial_categories
  WHERE is_active = true AND type IN ('receber', 'ambos') AND lower(name) IN ('venda de produtos', 'vendas')
  ORDER BY CASE WHEN lower(name) = 'venda de produtos' THEN 0 ELSE 1 END LIMIT 1;

  INSERT INTO financial_entries (
    type, description, value, due_date, original_due_date, competence_date,
    order_id, contact_id, category_id, account_id, payment_method, sales_channel,
    marketplace_account, notes
  ) VALUES (
    'receber', 'Pedido ' || v_order.order_number || ' - ' || COALESCE(v_order.customer_name, 'Cliente'),
    v_total, v_financial_due, v_financial_due, v_order.order_date,
    v_order.id, v_order.contact_id, v_category_id, v_order.financial_account_id,
    v_order.payment_method, v_order.channel, v_order.marketplace_account,
    'Gerado automaticamente pelo fluxo unificado de venda'
  ) RETURNING id INTO v_financial_id;

  IF v_payment_status = 'pago' THEN
    INSERT INTO financial_movements(entry_id, account_id, value, movement_date, notes)
    VALUES (v_financial_id, v_order.financial_account_id, v_total,
      COALESCE(NULLIF(p_order->>'payment_date', '')::date, current_date), 'Recebimento registrado na venda');
  END IF;

  RETURN jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number,
    'financial_entry_id', v_financial_id, 'total_value', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.create_unified_sale(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_unified_sale(jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_marketplace_settlement(p_payload jsonb, p_entry_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settlement_id uuid;
  v_account_id uuid := NULLIF(p_payload->>'financial_account_id', '')::uuid;
  v_date date := COALESCE(NULLIF(p_payload->>'settlement_date', '')::date, current_date);
  v_fee numeric := GREATEST(COALESCE((p_payload->>'fee_value')::numeric, 0), 0);
  v_gross numeric;
  v_entry record;
  v_fee_entry uuid;
  v_fee_category uuid;
BEGIN
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'Selecione a conta que recebeu o repasse.'; END IF;
  IF COALESCE(array_length(p_entry_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'Selecione ao menos um pedido.'; END IF;

  SELECT sum(GREATEST(value - value_paid, 0)) INTO v_gross FROM financial_entries
  WHERE id = ANY(p_entry_ids) AND type = 'receber' AND order_id IS NOT NULL;
  IF COALESCE(v_gross, 0) <= 0 THEN RAISE EXCEPTION 'Os recebíveis selecionados não possuem saldo.'; END IF;
  IF v_fee > v_gross THEN RAISE EXCEPTION 'A taxa não pode superar o valor bruto.'; END IF;

  INSERT INTO marketplace_settlements(marketplace, marketplace_account, financial_account_id,
    settlement_date, gross_value, fee_value, net_value, status, notes)
  VALUES (COALESCE(NULLIF(p_payload->>'marketplace', ''), 'Shopee'), NULLIF(p_payload->>'marketplace_account', ''),
    v_account_id, v_date, v_gross, v_fee, v_gross - v_fee, 'conciliado', NULLIF(p_payload->>'notes', ''))
  RETURNING id INTO v_settlement_id;

  FOR v_entry IN SELECT * FROM financial_entries WHERE id = ANY(p_entry_ids) FOR UPDATE LOOP
    INSERT INTO marketplace_settlement_orders(settlement_id, order_id, gross_value, fee_value, net_value)
    VALUES (v_settlement_id, v_entry.order_id, v_entry.value - v_entry.value_paid, 0, v_entry.value - v_entry.value_paid);
    INSERT INTO financial_movements(entry_id, account_id, value, movement_date, notes)
    VALUES (v_entry.id, v_account_id, v_entry.value - v_entry.value_paid, v_date,
      'Recebido no repasse ' || COALESCE(p_payload->>'marketplace', 'Shopee'));
  END LOOP;

  IF v_fee > 0 THEN
    SELECT id INTO v_fee_category FROM financial_categories
    WHERE is_active = true AND type IN ('pagar', 'ambos')
      AND lower(name) IN ('taxas de marketplace', 'outros pagamentos')
    ORDER BY CASE WHEN lower(name) = 'taxas de marketplace' THEN 0 ELSE 1 END LIMIT 1;
    INSERT INTO financial_entries(type, description, value, due_date, original_due_date, payment_date,
      category_id, account_id, notes)
    VALUES ('pagar', 'Taxas do repasse ' || COALESCE(p_payload->>'marketplace', 'Shopee'), v_fee,
      v_date, v_date, NULL, v_fee_category, v_account_id, 'Gerado pela conciliação de marketplace')
    RETURNING id INTO v_fee_entry;
    INSERT INTO financial_movements(entry_id, account_id, value, movement_date, notes)
    VALUES (v_fee_entry, v_account_id, v_fee, v_date, 'Taxa descontada do repasse');
  END IF;
  RETURN v_settlement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_marketplace_settlement(jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_marketplace_settlement(jsonb, uuid[]) TO authenticated;
