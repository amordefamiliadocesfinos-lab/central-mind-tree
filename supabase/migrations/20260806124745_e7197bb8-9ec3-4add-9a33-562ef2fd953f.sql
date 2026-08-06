ALTER TABLE public.service_messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime_type text,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS media_caption text;

ALTER TABLE public.service_conversations
  DROP CONSTRAINT IF EXISTS service_conversations_attendance_state_check;

ALTER TABLE public.service_conversations
  ADD CONSTRAINT service_conversations_attendance_state_check
  CHECK (attendance_state IS NULL OR attendance_state IN (
    'resolvido', 'aguardando_cliente', 'retornar_em',
    'responder', 'em_atendimento', 'concluido'
  ));