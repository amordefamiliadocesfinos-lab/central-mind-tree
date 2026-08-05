-- Registra no histÃ³rico somente mensagens efetivamente confirmadas.
CREATE OR REPLACE FUNCTION public.log_service_message_to_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact uuid;
  v_preview text;
  v_is_inbound boolean;
BEGIN
  IF NEW.sender = 'ai_suggestion' OR NEW.is_ai_suggested THEN RETURN NEW; END IF;
  IF coalesce(NEW.logged_to_history, false) THEN RETURN NEW; END IF;

  v_is_inbound := NEW.direction = 'inbound' OR NEW.sender = 'customer';
  IF v_is_inbound AND NEW.delivery_status NOT IN ('received', 'delivered', 'read') THEN RETURN NEW; END IF;
  IF NOT v_is_inbound AND NEW.delivery_status NOT IN ('sent', 'delivered', 'read') THEN RETURN NEW; END IF;

  SELECT contact_id INTO v_contact FROM public.service_conversations WHERE id = NEW.conversation_id;
  IF v_contact IS NULL THEN RETURN NEW; END IF;
  v_preview := CASE WHEN length(NEW.content) > 240 THEN substring(NEW.content, 1, 240) || 'â€¦' ELSE NEW.content END;

  INSERT INTO public.contact_history
    (contact_id, event_type, interaction_type, description, interaction_date, event_code)
  VALUES (
    v_contact,
    CASE WHEN v_is_inbound THEN 'service_in' ELSE 'service_out' END,
    'mensagem',
    CASE WHEN v_is_inbound THEN 'ðŸ“¥ ' ELSE 'ðŸ“¤ ' END || v_preview,
    coalesce(NEW.provider_timestamp, NEW.created_at),
    CASE WHEN v_is_inbound THEN 'customer_replied' ELSE 'message_sent' END
  );

  UPDATE public.contacts
     SET ultimo_contato = (coalesce(NEW.provider_timestamp, NEW.created_at) AT TIME ZONE 'America/Sao_Paulo')::date,
         updated_at = now()
   WHERE id = v_contact;
  UPDATE public.service_messages SET logged_to_history = true WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_service_message_to_history ON public.service_messages;
CREATE TRIGGER trg_log_service_message_to_history
  AFTER INSERT OR UPDATE OF delivery_status ON public.service_messages
  FOR EACH ROW EXECUTE FUNCTION public.log_service_message_to_history();
