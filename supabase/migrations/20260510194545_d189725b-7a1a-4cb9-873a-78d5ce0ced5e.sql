CREATE OR REPLACE FUNCTION public.merge_contacts(_primary_id uuid, _duplicate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p record;
  v_d record;
  v_moved jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  IF _primary_id = _duplicate_id THEN
    RAISE EXCEPTION 'IDs iguais';
  END IF;

  SELECT * INTO v_p FROM public.contacts WHERE id = _primary_id;
  SELECT * INTO v_d FROM public.contacts WHERE id = _duplicate_id;
  IF v_p.id IS NULL OR v_d.id IS NULL THEN
    RAISE EXCEPTION 'Contato não encontrado';
  END IF;

  -- Reaponta FKs (todas tabelas que referenciam contact_id)
  UPDATE public.orders SET contact_id = _primary_id WHERE contact_id = _duplicate_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('orders', v_count);

  UPDATE public.financial_entries SET contact_id = _primary_id WHERE contact_id = _duplicate_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('financial_entries', v_count);

  UPDATE public.contact_history SET contact_id = _primary_id WHERE contact_id = _duplicate_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('contact_history', v_count);

  UPDATE public.contact_activities SET contact_id = _primary_id WHERE contact_id = _duplicate_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('contact_activities', v_count);

  UPDATE public.service_conversations SET contact_id = _primary_id WHERE contact_id = _duplicate_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('service_conversations', v_count);

  UPDATE public.delivery_stops SET contact_id = _primary_id WHERE contact_id = _duplicate_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('delivery_stops', v_count);

  UPDATE public.invoices SET contact_id = _primary_id WHERE contact_id = _duplicate_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('invoices', v_count);

  -- Tags: ignora duplicatas (par único contact_id+tag_id)
  INSERT INTO public.contact_tag_assignments (contact_id, tag_id)
  SELECT _primary_id, tag_id FROM public.contact_tag_assignments
   WHERE contact_id = _duplicate_id
     AND tag_id NOT IN (SELECT tag_id FROM public.contact_tag_assignments WHERE contact_id = _primary_id);
  DELETE FROM public.contact_tag_assignments WHERE contact_id = _duplicate_id;

  -- Mescla campos quantitativos e datas
  UPDATE public.contacts SET
    lifetime_value     = COALESCE(v_p.lifetime_value,0) + COALESCE(v_d.lifetime_value,0),
    paid_orders_count  = COALESCE(v_p.paid_orders_count,0) + COALESCE(v_d.paid_orders_count,0),
    last_purchase_date = GREATEST(v_p.last_purchase_date, v_d.last_purchase_date),
    last_payment_date  = GREATEST(v_p.last_payment_date, v_d.last_payment_date),
    ultimo_contato     = GREATEST(v_p.ultimo_contato, v_d.ultimo_contato),
    -- preenche campos vazios do principal com dados do duplicado
    email     = COALESCE(NULLIF(v_p.email,''), v_d.email),
    phone     = COALESCE(NULLIF(v_p.phone,''), v_d.phone),
    whatsapp  = COALESCE(NULLIF(v_p.whatsapp,''), v_d.whatsapp),
    mobile    = COALESCE(NULLIF(v_p.mobile,''), v_d.mobile),
    document  = COALESCE(NULLIF(v_p.document,''), v_d.document),
    address   = COALESCE(NULLIF(v_p.address,''), v_d.address),
    city      = COALESCE(NULLIF(v_p.city,''), v_d.city),
    state     = COALESCE(NULLIF(v_p.state,''), v_d.state),
    zip_code  = COALESCE(NULLIF(v_p.zip_code,''), v_d.zip_code),
    photo_url = COALESCE(NULLIF(v_p.photo_url,''), v_d.photo_url),
    notes     = trim(both E'\n' from concat_ws(E'\n---\n', NULLIF(v_p.notes,''), NULLIF(v_d.notes,''))),
    updated_at = now()
  WHERE id = _primary_id;

  -- Log da mesclagem
  INSERT INTO public.contact_history (contact_id, event_type, interaction_type, description)
  VALUES (_primary_id, 'merge', 'observacao',
          'Contato mesclado: "' || v_d.name || '" (id ' || _duplicate_id::text || ') foi unido a este. Movidos: ' || v_moved::text);

  -- Remove duplicado
  DELETE FROM public.contacts WHERE id = _duplicate_id;

  RETURN jsonb_build_object('ok', true, 'primary_id', _primary_id, 'moved', v_moved);
END;
$$;