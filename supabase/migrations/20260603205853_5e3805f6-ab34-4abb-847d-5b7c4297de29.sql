
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scheduled_time time;
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON public.tasks(contact_id) WHERE contact_id IS NOT NULL;
