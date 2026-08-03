-- Etapa 1 do CRM: vocabulário único, eventos estruturados e tarefa oficial.

UPDATE public.contacts SET funnel_status = 'novo_lead' WHERE funnel_status IN ('novo', 'lead');
UPDATE public.contacts SET funnel_status = 'contato_realizado' WHERE funnel_status IN ('em_contato', 'contato_feito', 'qualificado');
UPDATE public.contacts SET funnel_status = 'proposta_enviada' WHERE funnel_status IN ('proposta', 'orcamento');
UPDATE public.contacts SET funnel_status = 'fechado' WHERE funnel_status = 'convertido';
UPDATE public.contacts SET funnel_status = 'pos_venda' WHERE funnel_status IN ('cliente_ativo', 'vip');
UPDATE public.contacts SET funnel_status = 'cadencia' WHERE funnel_status = 'inativo';

UPDATE public.service_conversations SET funnel_stage = 'novo_lead' WHERE funnel_stage IN ('novo', 'lead');
UPDATE public.service_conversations SET funnel_stage = 'contato_realizado' WHERE funnel_stage IN ('em_contato', 'contato_feito', 'qualificado');
UPDATE public.service_conversations SET funnel_stage = 'proposta_enviada' WHERE funnel_stage IN ('proposta', 'orcamento');
UPDATE public.service_conversations SET funnel_stage = 'fechado' WHERE funnel_stage = 'convertido';

ALTER TABLE public.contact_history
  ADD COLUMN IF NOT EXISTS event_code text,
  ADD COLUMN IF NOT EXISTS event_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.service_conversations
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.app_users(id) ON DELETE SET NULL;

UPDATE public.contact_history
SET event_code = CASE
  WHEN interaction_type = 'whatsapp' THEN 'message_sent'
  WHEN event_type = 'conversion' THEN 'sale_won'
  WHEN event_type = 'stage_change' THEN 'stage_changed'
  WHEN event_type = 'lead_criado' THEN 'lead_created'
  WHEN interaction_type = 'follow_up' THEN 'follow_up_scheduled'
  ELSE event_code
END
WHERE event_code IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_funnel_status_canonical'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_funnel_status_canonical
      CHECK (funnel_status IN ('novo_lead', 'contato_realizado', 'proposta_enviada', 'negociacao', 'fechado', 'pos_venda', 'cadencia', 'perdido'))
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_crm_stage ON public.contacts (funnel_status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_contacts_crm_next_action ON public.contacts (next_action_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_contact_history_event_code ON public.contact_history (event_code, interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_crm_next_action ON public.tasks (contact_id, source, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_conversations_inbox ON public.service_conversations (needs_reply, attendance_state, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_conversations_assigned_to ON public.service_conversations (assigned_to, last_message_at DESC);
