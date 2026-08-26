-- FASE 3D: novas conversas mantêm o canal textual e recebem a Plataforma canônica quando a resolução é inequívoca.
CREATE OR REPLACE FUNCTION public.assign_service_conversation_platform()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel text := lower(btrim(COALESCE(NEW.channel, '')));
  v_group_type text;
  v_platform_ids uuid[];
BEGIN
  -- Nunca sobrescreve uma referência explícita e nunca tenta inferir conversas históricas.
  IF NEW.platform_id IS NOT NULL OR v_channel = '' THEN
    RETURN NEW;
  END IF;

  v_group_type := CASE v_channel
    WHEN 'whatsapp' THEN 'ecommerce'
    WHEN 'instagram' THEN 'social'
    WHEN 'facebook' THEN 'social'
    ELSE NULL
  END;
  IF v_group_type IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(id) INTO v_platform_ids
  FROM (
    SELECT id
    FROM public.digital_platforms
    WHERE is_active
      AND parent_id IS NULL
      AND group_type = v_group_type
      AND lower(name) LIKE v_channel || '%'
    ORDER BY id
    LIMIT 2
  ) candidates;

  -- Sem plataforma, ou com mais de uma candidata, preserva somente o texto legado.
  IF COALESCE(array_length(v_platform_ids, 1), 0) = 1 THEN
    NEW.platform_id := v_platform_ids[1];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_service_conversation_platform ON public.service_conversations;
CREATE TRIGGER trg_assign_service_conversation_platform
  BEFORE INSERT OR UPDATE OF channel ON public.service_conversations
  FOR EACH ROW EXECUTE FUNCTION public.assign_service_conversation_platform();
