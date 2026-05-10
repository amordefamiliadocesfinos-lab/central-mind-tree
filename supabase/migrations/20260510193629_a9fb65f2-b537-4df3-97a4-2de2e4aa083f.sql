
-- ============ ETAPA 1: VÍNCULO CONVERSA ↔ CONTATO ============

ALTER TABLE public.service_conversations
  ADD COLUMN IF NOT EXISTS contact_id uuid;

ALTER TABLE public.service_messages
  ADD COLUMN IF NOT EXISTS logged_to_history boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_service_conversations_contact ON public.service_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_digits ON public.contacts (regexp_replace(coalesce(phone,''), '\D', '', 'g'));
CREATE INDEX IF NOT EXISTS idx_contacts_whatsapp_digits ON public.contacts (regexp_replace(coalesce(whatsapp,''), '\D', '', 'g'));
CREATE INDEX IF NOT EXISTS idx_contacts_mobile_digits ON public.contacts (regexp_replace(coalesce(mobile,''), '\D', '', 'g'));
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower ON public.contacts (lower(email));

-- ============ AUTO-VÍNCULO DE CONVERSA → CONTATO ============
CREATE OR REPLACE FUNCTION public.auto_link_conversation_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handle_digits text;
  v_handle_lower text;
  v_found uuid;
BEGIN
  -- Se já tem contact_id setado manualmente, respeita
  IF NEW.contact_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.contact_handle IS NULL OR length(trim(NEW.contact_handle)) = 0 THEN
    RETURN NEW;
  END IF;

  v_handle_lower := lower(trim(NEW.contact_handle));
  v_handle_digits := regexp_replace(NEW.contact_handle, '\D', '', 'g');

  -- 1) email exato
  IF position('@' in v_handle_lower) > 0 THEN
    SELECT id INTO v_found FROM public.contacts
     WHERE lower(email) = v_handle_lower AND is_active = true LIMIT 1;
  END IF;

  -- 2) telefone/whatsapp/mobile por dígitos (>= 8)
  IF v_found IS NULL AND length(v_handle_digits) >= 8 THEN
    SELECT id INTO v_found FROM public.contacts
     WHERE is_active = true AND (
       regexp_replace(coalesce(phone,''),    '\D','','g') = v_handle_digits OR
       regexp_replace(coalesce(whatsapp,''), '\D','','g') = v_handle_digits OR
       regexp_replace(coalesce(mobile,''),   '\D','','g') = v_handle_digits
     ) LIMIT 1;
  END IF;

  IF v_found IS NOT NULL THEN
    NEW.contact_id := v_found;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_conversation_contact ON public.service_conversations;
CREATE TRIGGER trg_auto_link_conversation_contact
  BEFORE INSERT OR UPDATE OF contact_handle, contact_id ON public.service_conversations
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_conversation_contact();

-- ============ MENSAGENS DO ATENDIMENTO → contact_history ============
CREATE OR REPLACE FUNCTION public.log_service_message_to_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact uuid;
  v_preview text;
BEGIN
  -- Sugestões de IA não entram no histórico
  IF NEW.sender = 'ai_suggestion' OR NEW.is_ai_suggested THEN
    RETURN NEW;
  END IF;

  SELECT contact_id INTO v_contact FROM public.service_conversations WHERE id = NEW.conversation_id;
  IF v_contact IS NULL THEN
    RETURN NEW;
  END IF;

  v_preview := CASE WHEN length(NEW.content) > 240 THEN substring(NEW.content, 1, 240) || '…' ELSE NEW.content END;

  INSERT INTO public.contact_history (contact_id, event_type, interaction_type, description, interaction_date)
  VALUES (
    v_contact,
    CASE WHEN NEW.sender = 'customer' THEN 'service_in' ELSE 'service_out' END,
    'mensagem',
    CASE WHEN NEW.sender = 'customer' THEN '📥 ' ELSE '📤 ' END || v_preview,
    NEW.created_at
  );

  UPDATE public.contacts
     SET ultimo_contato = (NEW.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
         updated_at = now()
   WHERE id = v_contact;

  UPDATE public.service_messages SET logged_to_history = true WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_service_message_to_history ON public.service_messages;
CREATE TRIGGER trg_log_service_message_to_history
  AFTER INSERT ON public.service_messages
  FOR EACH ROW EXECUTE FUNCTION public.log_service_message_to_history();

-- ============ FUNIL UNIFICADO (sync bidirecional) ============
-- Mapas:
--   conversation.funnel_stage: lead | interested | engaged | customer
--   contacts.funnel_status:    novo_lead | qualificado | proposta | negociacao | cliente_ativo | vip
CREATE OR REPLACE FUNCTION public.map_conv_to_contact_funnel(_stage text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _stage
    WHEN 'lead' THEN 'novo_lead'
    WHEN 'interested' THEN 'qualificado'
    WHEN 'engaged' THEN 'negociacao'
    WHEN 'customer' THEN 'cliente_ativo'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.map_contact_to_conv_funnel(_status text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _status
    WHEN 'novo_lead' THEN 'lead'
    WHEN 'qualificado' THEN 'interested'
    WHEN 'proposta' THEN 'engaged'
    WHEN 'negociacao' THEN 'engaged'
    WHEN 'cliente_ativo' THEN 'customer'
    WHEN 'vip' THEN 'customer'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_funnel_conversation_to_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  -- Não rebaixa cliente_ativo/vip
  IF v_current IN ('vip','cliente_ativo') AND v_target NOT IN ('cliente_ativo','vip') THEN
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
$$;

DROP TRIGGER IF EXISTS trg_sync_funnel_conv_to_contact ON public.service_conversations;
CREATE TRIGGER trg_sync_funnel_conv_to_contact
  AFTER INSERT OR UPDATE OF funnel_stage, contact_id ON public.service_conversations
  FOR EACH ROW EXECUTE FUNCTION public.sync_funnel_conversation_to_contact();

CREATE OR REPLACE FUNCTION public.sync_funnel_contact_to_conversations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.funnel_status IS NOT DISTINCT FROM OLD.funnel_status THEN
    RETURN NEW;
  END IF;
  v_target := public.map_contact_to_conv_funnel(NEW.funnel_status);
  IF v_target IS NULL THEN RETURN NEW; END IF;

  UPDATE public.service_conversations
     SET funnel_stage = v_target, updated_at = now()
   WHERE contact_id = NEW.id AND funnel_stage IS DISTINCT FROM v_target;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_funnel_contact_to_conv ON public.contacts;
CREATE TRIGGER trg_sync_funnel_contact_to_conv
  AFTER UPDATE OF funnel_status ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.sync_funnel_contact_to_conversations();

-- ============ BACKFILL: vincular conversas existentes ============
UPDATE public.service_conversations c
   SET contact_id = sub.cid
  FROM (
    SELECT sc.id AS conv_id, ct.id AS cid
      FROM public.service_conversations sc
      JOIN public.contacts ct ON ct.is_active = true AND (
            (position('@' in lower(coalesce(sc.contact_handle,''))) > 0
              AND lower(ct.email) = lower(sc.contact_handle))
         OR (length(regexp_replace(coalesce(sc.contact_handle,''),'\D','','g')) >= 8
              AND regexp_replace(coalesce(sc.contact_handle,''),'\D','','g') IN (
                regexp_replace(coalesce(ct.phone,''),'\D','','g'),
                regexp_replace(coalesce(ct.whatsapp,''),'\D','','g'),
                regexp_replace(coalesce(ct.mobile,''),'\D','','g')
              ))
      )
     WHERE sc.contact_id IS NULL
  ) sub
 WHERE c.id = sub.conv_id;
