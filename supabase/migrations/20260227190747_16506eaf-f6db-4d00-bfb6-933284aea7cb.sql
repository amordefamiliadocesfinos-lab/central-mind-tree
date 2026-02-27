
-- Tags customizáveis para contatos
CREATE TABLE public.contact_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contact_tags" ON public.contact_tags FOR ALL USING (true) WITH CHECK (true);

-- Associação contato <-> tag (N:N)
CREATE TABLE public.contact_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.contact_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, tag_id)
);

ALTER TABLE public.contact_tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contact_tag_assignments" ON public.contact_tag_assignments FOR ALL USING (true) WITH CHECK (true);

-- Atividades/tarefas por contato (follow-ups, ligações, reuniões)
CREATE TABLE public.contact_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL DEFAULT 'follow_up',
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contact_activities" ON public.contact_activities FOR ALL USING (true) WITH CHECK (true);
