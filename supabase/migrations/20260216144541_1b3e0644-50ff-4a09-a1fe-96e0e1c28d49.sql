
-- Contact history / timeline table
CREATE TABLE public.contact_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'note', -- 'note', 'stage_change', 'conversion', 'call', 'email', 'meeting'
  description TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on contact_history" ON public.contact_history FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_contact_history_contact ON public.contact_history(contact_id, created_at DESC);

-- Add converted_at to contacts for conversion tracking
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;
