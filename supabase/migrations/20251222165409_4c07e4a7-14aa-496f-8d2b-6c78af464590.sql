-- Create table for mock users (no auth for now)
CREATE TABLE public.app_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT, -- função/área
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for meetings
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  objective TEXT,
  meeting_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location TEXT, -- local ou link
  status TEXT NOT NULL DEFAULT 'agendada', -- agendada, em_andamento, concluida, cancelada
  owner_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  notes TEXT, -- observações gerais
  decisions TEXT, -- decisões tomadas
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for meeting participants
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'participante', -- responsavel, participante
  confirmed BOOLEAN DEFAULT false,
  UNIQUE(meeting_id, user_id)
);

-- Create table for meeting agenda items (pauta)
CREATE TABLE public.meeting_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL DEFAULT 'pauta', -- estrutura, pauta, decisao, acao
  owner_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  duration_minutes INTEGER DEFAULT 5,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, em_andamento, concluido
  notes TEXT, -- observações do item
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL, -- link para tarefa gerada
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_meetings_date ON public.meetings(meeting_date);
CREATE INDEX idx_meetings_status ON public.meetings(status);
CREATE INDEX idx_meeting_items_meeting ON public.meeting_items(meeting_id);
CREATE INDEX idx_meeting_participants_user ON public.meeting_participants(user_id);

-- Enable RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_items ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth yet)
CREATE POLICY "Allow all on app_users" ON public.app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on meeting_participants" ON public.meeting_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on meeting_items" ON public.meeting_items FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for updating meetings updated_at
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default mock users
INSERT INTO public.app_users (name, role, email) VALUES
('Eu', 'Gestão', 'eu@empresa.com'),
('Ana Silva', 'Marketing', 'ana@empresa.com'),
('Carlos Santos', 'Produção', 'carlos@empresa.com'),
('Maria Oliveira', 'Financeiro', 'maria@empresa.com');