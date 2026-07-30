-- 1) contacts.phone_normalized
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone_normalized text;

CREATE OR REPLACE FUNCTION public.normalize_br_phone(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(_raw, '\D', '', 'g');
  IF d = '' THEN RETURN NULL; END IF;
  -- remove zeros de operadora/prefixo internacional
  d := regexp_replace(d, '^0+', '');
  IF length(d) IN (10, 11) THEN
    d := '55' || d;
  END IF;
  IF left(d, 2) = '55' AND length(d) IN (12, 13) THEN
    RETURN d;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_contact_phone_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.phone_normalized := COALESCE(
    public.normalize_br_phone(NEW.whatsapp),
    public.normalize_br_phone(NEW.mobile),
    public.normalize_br_phone(NEW.phone)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_phone_normalized ON public.contacts;
CREATE TRIGGER trg_contacts_phone_normalized
BEFORE INSERT OR UPDATE OF whatsapp, mobile, phone ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.set_contact_phone_normalized();

UPDATE public.contacts
   SET phone_normalized = COALESCE(
     public.normalize_br_phone(whatsapp),
     public.normalize_br_phone(mobile),
     public.normalize_br_phone(phone)
   )
 WHERE phone_normalized IS DISTINCT FROM COALESCE(
     public.normalize_br_phone(whatsapp),
     public.normalize_br_phone(mobile),
     public.normalize_br_phone(phone)
   );

CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized ON public.contacts (phone_normalized) WHERE phone_normalized IS NOT NULL;

-- 2) service_conversations
ALTER TABLE public.service_conversations
  ADD COLUMN IF NOT EXISTS attendance_state text,
  ADD COLUMN IF NOT EXISTS needs_reply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp';

DO $$ BEGIN
  ALTER TABLE public.service_conversations
    ADD CONSTRAINT service_conversations_attendance_state_check
    CHECK (attendance_state IS NULL OR attendance_state IN ('resolvido','aguardando_cliente','retornar_em'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) service_messages
ALTER TABLE public.service_messages
  ADD COLUMN IF NOT EXISTS external_message_id text,
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS provider_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS provider_name text,
  ADD COLUMN IF NOT EXISTS provider_instance_ref text,
  ADD COLUMN IF NOT EXISTS error_code text;

DO $$ BEGIN
  ALTER TABLE public.service_messages
    ADD CONSTRAINT service_messages_direction_check
    CHECK (direction IS NULL OR direction IN ('inbound','outbound'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.service_messages
    ADD CONSTRAINT service_messages_source_check
    CHECK (source IS NULL OR source IN ('mobile','crm','provider','legacy'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_messages_provider_external
  ON public.service_messages (provider_name, provider_instance_ref, external_message_id)
  WHERE provider_name IS NOT NULL AND provider_instance_ref IS NOT NULL AND external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_messages_conversation_created
  ON public.service_messages (conversation_id, created_at);

-- 4) integration_webhook_receipts
CREATE TABLE IF NOT EXISTS public.integration_webhook_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL,
  provider_instance_ref text,
  event_type text,
  deduplication_key text NOT NULL UNIQUE,
  processing_status text NOT NULL DEFAULT 'received',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.integration_webhook_receipts TO service_role;
ALTER TABLE public.integration_webhook_receipts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_webhook_receipts_updated_at ON public.integration_webhook_receipts;
CREATE TRIGGER trg_webhook_receipts_updated_at
BEFORE UPDATE ON public.integration_webhook_receipts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) whatsapp_integrations (sem tokens)
CREATE TABLE IF NOT EXISTS public.whatsapp_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  instance_reference text NOT NULL UNIQUE,
  connection_status text NOT NULL DEFAULT 'unknown'
    CHECK (connection_status IN ('connected','degraded','disconnected','not_configured','unknown')),
  last_checked_at timestamptz,
  last_webhook_at timestamptz,
  last_error text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.whatsapp_integrations TO authenticated;
GRANT ALL ON public.whatsapp_integrations TO service_role;
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read whatsapp integrations"
ON public.whatsapp_integrations FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_whatsapp_integrations_updated_at ON public.whatsapp_integrations;
CREATE TRIGGER trg_whatsapp_integrations_updated_at
BEFORE UPDATE ON public.whatsapp_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) RLS: remover políticas legadas abertas
DROP POLICY IF EXISTS "Allow all on service_conversations" ON public.service_conversations;
DROP POLICY IF EXISTS "Allow all on service_messages" ON public.service_messages;

REVOKE ALL ON public.service_conversations FROM anon;
REVOKE ALL ON public.service_messages FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.service_conversations TO authenticated;
GRANT ALL ON public.service_conversations TO service_role;
GRANT SELECT ON public.service_messages TO authenticated;
GRANT ALL ON public.service_messages TO service_role;

CREATE POLICY "Authenticated can read conversations"
ON public.service_conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create conversations"
ON public.service_conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update conversations"
ON public.service_conversations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read messages"
ON public.service_messages FOR SELECT TO authenticated USING (true);
