-- 1) Trigger: criar conversa de Atendimento ao inserir contato
CREATE OR REPLACE FUNCTION public.auto_create_service_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handle text;
  v_stage text;
BEGIN
  IF NEW.is_active = false THEN RETURN NEW; END IF;

  -- Já existe conversa para este contato? Não duplica.
  IF EXISTS (SELECT 1 FROM public.service_conversations WHERE contact_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_handle := COALESCE(
    NULLIF(regexp_replace(coalesce(NEW.whatsapp,''), '\D','','g'), ''),
    NULLIF(regexp_replace(coalesce(NEW.phone,''),    '\D','','g'), ''),
    NULLIF(regexp_replace(coalesce(NEW.mobile,''),   '\D','','g'), ''),
    NULLIF(NEW.email, ''),
    NEW.name
  );

  v_stage := COALESCE(public.map_contact_to_conv_funnel(NEW.funnel_status), 'lead');

  INSERT INTO public.service_conversations (
    platform_id, contact_id, contact_name, contact_handle, contact_avatar_url,
    status, funnel_stage, last_message_preview, last_message_at, unread_count, auto_reply_enabled
  ) VALUES (
    NULL, NEW.id, NEW.name, v_handle, NEW.photo_url,
    'open', v_stage, NULL, now(), 0, false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_service_conversation ON public.contacts;
CREATE TRIGGER trg_auto_create_service_conversation
AFTER INSERT ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.auto_create_service_conversation();

-- 2) Trigger: atualizar conversa quando dados-chave do contato mudam
CREATE OR REPLACE FUNCTION public.sync_contact_to_service_conversations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handle text;
BEGIN
  IF (NEW.name IS NOT DISTINCT FROM OLD.name)
     AND (NEW.photo_url IS NOT DISTINCT FROM OLD.photo_url)
     AND (NEW.whatsapp IS NOT DISTINCT FROM OLD.whatsapp)
     AND (NEW.phone IS NOT DISTINCT FROM OLD.phone)
     AND (NEW.mobile IS NOT DISTINCT FROM OLD.mobile)
     AND (NEW.email IS NOT DISTINCT FROM OLD.email) THEN
    RETURN NEW;
  END IF;

  v_handle := COALESCE(
    NULLIF(regexp_replace(coalesce(NEW.whatsapp,''), '\D','','g'), ''),
    NULLIF(regexp_replace(coalesce(NEW.phone,''),    '\D','','g'), ''),
    NULLIF(regexp_replace(coalesce(NEW.mobile,''),   '\D','','g'), ''),
    NULLIF(NEW.email, ''),
    NEW.name
  );

  UPDATE public.service_conversations
     SET contact_name = NEW.name,
         contact_avatar_url = NEW.photo_url,
         contact_handle = COALESCE(v_handle, contact_handle),
         updated_at = now()
   WHERE contact_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contact_to_service_conversations ON public.contacts;
CREATE TRIGGER trg_sync_contact_to_service_conversations
AFTER UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_contact_to_service_conversations();