-- A canonical contact outside CRM must not receive an Inbox conversation.
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
  IF NEW.is_active = false OR NEW.funnel_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.service_conversations WHERE contact_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_stage := public.map_contact_to_conv_funnel(NEW.funnel_status);
  IF v_stage IS NULL THEN
    RETURN NEW;
  END IF;

  v_handle := COALESCE(
    NULLIF(regexp_replace(coalesce(NEW.whatsapp,''), '\D','','g'), ''),
    NULLIF(regexp_replace(coalesce(NEW.phone,''), '\D','','g'), ''),
    NULLIF(regexp_replace(coalesce(NEW.mobile,''), '\D','','g'), ''),
    NULLIF(NEW.email, ''),
    NEW.name
  );

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
