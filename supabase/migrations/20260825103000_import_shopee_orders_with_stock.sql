-- OP-04: cria cada pedido Shopee enviado e aplica a saída física pela OP-01
-- na mesma transação. Reprocessamentos retornam "already_imported" sem nova baixa.
CREATE OR REPLACE FUNCTION public.import_shopee_order_with_stock(
  p_order jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_item jsonb;
  v_external_order_id text := NULLIF(trim(p_order->>'external_order_id'), '');
  v_account text := NULLIF(trim(p_order->>'marketplace_account'), '');
  v_total numeric := 0;
  v_stock_result jsonb;
  v_existing_id uuid;
BEGIN
  IF v_external_order_id IS NULL OR v_account IS NULL THEN
    RAISE EXCEPTION 'ID externo e conta Shopee são obrigatórios.';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O pedido Shopee precisa ter ao menos um item.';
  END IF;

  -- Evita corrida entre dois cliques/importações do mesmo pedido, mesmo sem
  -- exigir nova restrição estrutural em orders nesta etapa.
  PERFORM pg_advisory_xact_lock(hashtext('shopee:' || v_account || ':' || v_external_order_id));
  SELECT id INTO v_existing_id
  FROM public.orders
  WHERE order_number = v_external_order_id
    AND channel = 'shopee'
    AND marketplace_account = v_account
    AND deleted_at IS NULL
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('order_id', v_existing_id, 'already_imported', true, 'movement_count', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(v_item->>'product_id', '') IS NULL
      OR COALESCE((v_item->>'quantity')::numeric, 0) <= 0
      OR COALESCE((v_item->>'physical_multiplier')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Item Shopee sem produto mestre, quantidade ou multiplicador válidos.';
    END IF;
    v_total := v_total + GREATEST(COALESCE((v_item->>'commercial_quantity')::numeric, 0), 0)
      * GREATEST(COALESCE((v_item->>'unit_price')::numeric, 0), 0);
  END LOOP;

  INSERT INTO public.orders (
    order_number, customer_name, channel, marketplace_account, status,
    total_value, order_date, due_date, notes, order_type
  ) VALUES (
    v_external_order_id,
    NULLIF(p_order->>'customer_name', ''),
    'shopee', v_account, 'enviado',
    v_total,
    COALESCE(NULLIF(left(p_order->>'order_date', 10), '')::date, current_date),
    COALESCE(NULLIF(left(p_order->>'order_date', 10), '')::date, current_date),
    concat_ws(E'\n',
      'Importado via XLSX Shopee.',
      NULLIF('Status externo: ' || NULLIF(p_order->>'external_status', ''), 'Status externo: '),
      NULLIF('Rastreio: ' || NULLIF(p_order->>'tracking_number', ''), 'Rastreio: '),
      NULLIF('Endereço: ' || NULLIF(p_order->>'address', ''), 'Endereço: ')
    ),
    'stock'
  ) RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, notes)
    VALUES (
      v_order.id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      COALESCE((v_item->>'unit_price')::numeric, 0),
      concat_ws(' | ',
        'Shopee comercial: ' || COALESCE(v_item->>'commercial_quantity', '0'),
        'Multiplicador físico: ' || COALESCE(v_item->>'physical_multiplier', '0'),
        NULLIF(v_item->>'external_item_key', ''),
        NULLIF(v_item->>'variation', ''),
        NULLIF(v_item->>'product_title', '')
      )
    );
  END LOOP;

  -- A OP-01 pré-valida o saldo, cria inventory_movements rastreáveis e
  -- mantém idempotência. Qualquer falha faz rollback do pedido inteiro.
  v_stock_result := public.apply_order_stock_event(v_order.id, 'external_shipped');
  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'already_imported', false,
    'movement_count', COALESCE((v_stock_result->>'movement_count')::integer, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_shopee_order_with_stock(jsonb, jsonb) TO authenticated;
