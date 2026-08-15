CREATE OR REPLACE FUNCTION public.sync_contact_on_order_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact_id uuid;
BEGIN
  v_contact_id := NEW.contact_id;
  IF v_contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('entregue', 'concluido') THEN
    UPDATE public.contacts
       SET funnel_status = CASE
             WHEN funnel_status IN ('fechado','pos_venda','cadencia') THEN funnel_status
             ELSE 'fechado'
           END,
           last_purchase_date = COALESCE(NEW.delivery_date, NEW.order_date, CURRENT_DATE),
           updated_at = now()
     WHERE id = v_contact_id;

    INSERT INTO public.contact_history (contact_id, event_type, interaction_type, description, interaction_date)
    VALUES (v_contact_id, 'order_delivered', 'venda',
            'Pedido ' || COALESCE(NEW.order_number, NEW.id::text) || ' entregue', now());
  ELSIF NEW.status = 'cancelado' THEN
    INSERT INTO public.contact_history (contact_id, event_type, interaction_type, description, interaction_date)
    VALUES (v_contact_id, 'order_cancelled', 'observacao',
            'Pedido ' || COALESCE(NEW.order_number, NEW.id::text) || ' cancelado', now());
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.map_contact_to_conv_funnel(_status text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE _status
    WHEN 'novo_lead' THEN 'lead'
    WHEN 'contato_realizado' THEN 'interested'
    WHEN 'proposta_enviada' THEN 'engaged'
    WHEN 'negociacao' THEN 'engaged'
    WHEN 'fechado' THEN 'customer'
    WHEN 'pos_venda' THEN 'customer'
    ELSE NULL
  END;
$function$;

CREATE OR REPLACE FUNCTION public.map_conv_to_contact_funnel(_stage text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE _stage
    WHEN 'lead' THEN 'novo_lead'
    WHEN 'interested' THEN 'contato_realizado'
    WHEN 'engaged' THEN 'negociacao'
    WHEN 'customer' THEN 'fechado'
    ELSE NULL
  END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_funnel_conversation_to_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target text;
  v_current text;
BEGIN
  IF NEW.contact_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.funnel_stage IS NOT DISTINCT FROM OLD.funnel_stage
     AND NEW.contact_id IS NOT DISTINCT FROM OLD.contact_id THEN
    RETURN NEW;
  END IF;

  v_target := public.map_conv_to_contact_funnel(NEW.funnel_stage);
  IF v_target IS NULL THEN RETURN NEW; END IF;

  SELECT funnel_status INTO v_current FROM public.contacts WHERE id = NEW.contact_id;
  IF v_current IN ('fechado','pos_venda') AND v_target NOT IN ('fechado','pos_venda') THEN
    RETURN NEW;
  END IF;

  IF v_current IS DISTINCT FROM v_target THEN
    UPDATE public.contacts SET funnel_status = v_target, updated_at = now() WHERE id = NEW.contact_id;
    INSERT INTO public.contact_history (contact_id, event_type, interaction_type, description, interaction_date, old_value, new_value)
    VALUES (NEW.contact_id, 'funnel_change', 'observacao',
            'Funil atualizado pelo Atendimento: ' || coalesce(v_current,'?') || ' → ' || v_target,
            now(), v_current, v_target);
  END IF;

  RETURN NEW;
END;
$function$;