-- OP-01: contrato único Pedido ↔ Estoque.
-- A chave persiste a consequência operacional por item/localização e evita
-- baixa duplicada em reprocessamentos de qualquer origem de pedido.
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS event_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_movements_event_key
  ON public.inventory_movements (event_key)
  WHERE event_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_order_stock_event(
  p_order_id uuid,
  p_event text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_inventory record;
  v_available numeric;
  v_remaining numeric;
  v_take numeric;
  v_event text;
  v_key text;
  v_movement_count integer := 0;
  v_already_applied boolean := false;
BEGIN
  IF p_event NOT IN ('confirmed', 'cancelled', 'shipped', 'external_shipped') THEN
    RAISE EXCEPTION 'Evento de estoque de pedido inválido: %', p_event;
  END IF;

  PERFORM 1 FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  -- Reserva e déficit são evoluções posteriores. Nesta fundação, somente a
  -- expedição é uma consequência física; os demais eventos são no-op explícito.
  IF p_event IN ('confirmed', 'cancelled') THEN
    RETURN jsonb_build_object('event', p_event, 'applied', false, 'already_applied', false, 'movement_count', 0);
  END IF;

  v_event := 'physical_out';
  IF EXISTS (
    SELECT 1 FROM public.inventory_movements
    WHERE reference_id = p_order_id
      AND movement_type = 'out'
      AND (
        reference_type = 'order'
        OR (reference_type = 'order_stock_event' AND event_key LIKE 'order:' || p_order_id::text || ':' || v_event || ':%')
      )
  ) THEN
    RETURN jsonb_build_object('event', p_event, 'applied', false, 'already_applied', true, 'movement_count', 0);
  END IF;

  -- Pré-validação: a saída é atômica e nunca mascara déficit reduzindo saldo
  -- abaixo de zero. A futura frente de déficit poderá decidir o que produzir.
  FOR v_item IN
    SELECT product_id, sum(quantity) AS quantity
    FROM public.order_items
    WHERE order_id = p_order_id
    GROUP BY product_id
  LOOP
    v_available := 0;
    FOR v_inventory IN
      SELECT quantity FROM public.inventory
      WHERE product_id = v_item.product_id
      FOR UPDATE
    LOOP
      v_available := v_available + v_inventory.quantity;
    END LOOP;

    IF v_available < v_item.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para expedir produto % do pedido', v_item.product_id;
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT id, product_id, quantity FROM public.order_items WHERE order_id = p_order_id
  LOOP
    v_remaining := v_item.quantity;
    FOR v_inventory IN
      SELECT id, location, quantity
      FROM public.inventory
      WHERE product_id = v_item.product_id AND quantity > 0
      ORDER BY quantity DESC, id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_inventory.quantity);
      v_key := 'order:' || p_order_id::text || ':' || v_event || ':' || v_item.id::text || ':' || COALESCE(v_inventory.location, 'sem-localizacao');

      UPDATE public.inventory
      SET quantity = quantity - v_take, updated_at = now()
      WHERE id = v_inventory.id;

      INSERT INTO public.inventory_movements (
        product_id, movement_type, quantity, previous_balance, new_balance,
        location, reference_type, reference_id, event_key, notes
      ) VALUES (
        v_item.product_id, 'out', v_take, v_inventory.quantity, v_inventory.quantity - v_take,
        v_inventory.location, 'order_stock_event', p_order_id, v_key,
        'Saída física por expedição de pedido'
      );

      v_remaining := v_remaining - v_take;
      v_movement_count := v_movement_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('event', p_event, 'applied', true, 'already_applied', v_already_applied, 'movement_count', v_movement_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_order_status_with_stock(
  p_order_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text := CASE
    WHEN p_status IN ('enviado', 'entregue') THEN 'shipped'
    WHEN p_status = 'confirmado' THEN 'confirmed'
    WHEN p_status = 'cancelado' THEN 'cancelled'
    ELSE NULL
  END;
  v_stock_result jsonb := jsonb_build_object('movement_count', 0);
BEGIN
  IF v_event IS NOT NULL THEN
    v_stock_result := public.apply_order_stock_event(p_order_id, v_event);
  END IF;

  UPDATE public.orders SET status = p_status, updated_at = now() WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  RETURN jsonb_build_object(
    'stock_event', v_event,
    'movement_count', COALESCE((v_stock_result->>'movement_count')::integer, 0)
  );
END;
$$;

-- Vendas criam pedido + financeiro. Estoque somente é baixado na expedição,
-- e pedido não gera OP automaticamente.
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
  v_payment_status text := COALESCE(NULLIF(p_order->>'payment_status', ''), 'pendente');
  v_financial_due date := COALESCE(NULLIF(p_order->>'financial_due_date', '')::date, current_date);
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Adicione ao menos um produto à venda.'; END IF;
  IF v_payment_status NOT IN ('pendente', 'pago', 'parcial') THEN RAISE EXCEPTION 'Situação financeira inválida.'; END IF;

  SELECT COALESCE(sum(GREATEST(COALESCE((x->>'quantity')::numeric, 0), 0) * GREATEST(COALESCE((x->>'unit_price')::numeric, 0), 0)), 0)
  INTO v_subtotal FROM jsonb_array_elements(p_items) x;
  v_total := GREATEST(v_subtotal - v_discount + v_shipping, 0);
  IF v_total <= 0 THEN RAISE EXCEPTION 'O total da venda deve ser maior que zero.'; END IF;
  IF v_payment_status = 'pago' AND NULLIF(p_order->>'financial_account_id', '') IS NULL THEN RAISE EXCEPTION 'Selecione a conta que recebeu o pagamento.'; END IF;

  INSERT INTO orders (order_number, customer_name, customer_contact, contact_id, channel, status, total_value, order_date, due_date, delivery_date, financial_due_date, notes, order_type, payment_status, payment_method, financial_account_id, discount_amount, shipping_amount, marketplace_account)
  VALUES (COALESCE(NULLIF(p_order->>'order_number', ''), 'PED-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint), NULLIF(p_order->>'customer_name', ''), NULLIF(p_order->>'customer_contact', ''), NULLIF(p_order->>'contact_id', '')::uuid, COALESCE(NULLIF(p_order->>'channel', ''), 'direto'), 'pendente', v_total, COALESCE(NULLIF(p_order->>'order_date', '')::date, current_date), NULLIF(p_order->>'delivery_date', '')::date, NULLIF(p_order->>'delivery_date', '')::date, v_financial_due, NULLIF(p_order->>'notes', ''), COALESCE(NULLIF(p_order->>'order_type', ''), 'production'), v_payment_status, NULLIF(p_order->>'payment_method', ''), NULLIF(p_order->>'financial_account_id', '')::uuid, v_discount, v_shipping, NULLIF(p_order->>'marketplace_account', ''))
  RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(v_item->>'product_id', '') IS NULL OR COALESCE((v_item->>'quantity')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'Produto ou quantidade inválida.'; END IF;
    INSERT INTO order_items(order_id, product_id, quantity, unit_price, notes)
    VALUES (v_order.id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::numeric, COALESCE((v_item->>'unit_price')::numeric, 0), NULLIF(v_item->>'notes', ''));
  END LOOP;

  SELECT id INTO v_category_id FROM financial_categories WHERE is_active = true AND type IN ('receber', 'ambos') AND lower(name) IN ('venda de produtos', 'vendas') ORDER BY CASE WHEN lower(name) = 'venda de produtos' THEN 0 ELSE 1 END LIMIT 1;
  INSERT INTO financial_entries (type, description, value, due_date, original_due_date, competence_date, order_id, contact_id, category_id, account_id, payment_method, sales_channel, marketplace_account, notes)
  VALUES ('receber', 'Pedido ' || v_order.order_number || ' - ' || COALESCE(v_order.customer_name, 'Cliente'), v_total, v_financial_due, v_financial_due, v_order.order_date, v_order.id, v_order.contact_id, v_category_id, v_order.financial_account_id, v_order.payment_method, v_order.channel, v_order.marketplace_account, 'Gerado automaticamente pelo fluxo unificado de venda') RETURNING id INTO v_financial_id;
  IF v_payment_status = 'pago' THEN INSERT INTO financial_movements(entry_id, account_id, value, movement_date, notes) VALUES (v_financial_id, v_order.financial_account_id, v_total, COALESCE(NULLIF(p_order->>'payment_date', '')::date, current_date), 'Recebimento registrado na venda'); END IF;

  RETURN jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'financial_entry_id', v_financial_id, 'total_value', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_order_stock_event(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_order_status_with_stock(uuid, text) TO authenticated;
