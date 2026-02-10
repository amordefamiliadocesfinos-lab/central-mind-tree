
-- Conversations table
CREATE TABLE public.service_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES public.digital_platforms(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_handle TEXT,
  contact_avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  funnel_stage TEXT NOT NULL DEFAULT 'lead',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages table
CREATE TABLE public.service_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.service_conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL DEFAULT 'customer',
  content TEXT NOT NULL,
  is_ai_suggested BOOLEAN NOT NULL DEFAULT false,
  ai_approved BOOLEAN,
  intent_detected TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI learning logs (invisible to user)
CREATE TABLE public.service_ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.service_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.service_messages(id) ON DELETE CASCADE,
  platform_id UUID REFERENCES public.digital_platforms(id) ON DELETE SET NULL,
  interaction_type TEXT,
  ai_suggested_response TEXT,
  approved_response TEXT,
  intent_detected TEXT,
  conversation_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_ai_logs ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth in this app)
CREATE POLICY "Allow all on service_conversations" ON public.service_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on service_messages" ON public.service_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on service_ai_logs" ON public.service_ai_logs FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_service_messages_conversation ON public.service_messages(conversation_id);
CREATE INDEX idx_service_conversations_platform ON public.service_conversations(platform_id);
CREATE INDEX idx_service_conversations_status ON public.service_conversations(status);
CREATE INDEX idx_service_ai_logs_conversation ON public.service_ai_logs(conversation_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_messages;

-- Updated_at trigger
CREATE TRIGGER update_service_conversations_updated_at
BEFORE UPDATE ON public.service_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
