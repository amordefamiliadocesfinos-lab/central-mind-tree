-- Tasks: maioria das queries filtra deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_tasks_active ON public.tasks (scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_contact_active ON public.tasks (contact_id) WHERE deleted_at IS NULL;

-- Digital: join lateral idea_id -> variations (query #2 mais lenta do sistema)
CREATE INDEX IF NOT EXISTS idx_digital_variations_idea ON public.digital_variations (idea_id);
CREATE INDEX IF NOT EXISTS idx_digital_ideas_status_order ON public.digital_ideas (status, order_index);

-- Contact history (timelines)
CREATE INDEX IF NOT EXISTS idx_contact_history_contact_date ON public.contact_history (contact_id, interaction_date DESC);

-- Service conversations / messages
CREATE INDEX IF NOT EXISTS idx_service_conversations_contact ON public.service_conversations (contact_id);
CREATE INDEX IF NOT EXISTS idx_service_messages_conv_created ON public.service_messages (conversation_id, created_at DESC);

-- Contact activities
CREATE INDEX IF NOT EXISTS idx_contact_activities_contact ON public.contact_activities (contact_id);