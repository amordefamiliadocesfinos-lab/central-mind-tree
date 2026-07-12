
CREATE TABLE public.inbox_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('texto','audio','foto','video')),
  media_url TEXT,
  media_path TEXT,
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  user_name TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando_selecao',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_entries TO anon;
GRANT ALL ON public.inbox_entries TO service_role;

ALTER TABLE public.inbox_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view inbox entries" ON public.inbox_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert inbox entries" ON public.inbox_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update inbox entries" ON public.inbox_entries FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete inbox entries" ON public.inbox_entries FOR DELETE USING (true);

CREATE INDEX idx_inbox_entries_created_at ON public.inbox_entries(created_at DESC);
CREATE INDEX idx_inbox_entries_status ON public.inbox_entries(status);

CREATE TRIGGER update_inbox_entries_updated_at
  BEFORE UPDATE ON public.inbox_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
