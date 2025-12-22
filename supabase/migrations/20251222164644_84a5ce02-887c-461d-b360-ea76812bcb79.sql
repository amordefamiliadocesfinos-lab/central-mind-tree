-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create table for time entries (automatic time tracking)
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  entry_type TEXT NOT NULL DEFAULT 'work',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_time_entries_task_id ON public.time_entries(task_id);
CREATE INDEX idx_time_entries_node_id ON public.time_entries(node_id);
CREATE INDEX idx_time_entries_started_at ON public.time_entries(started_at);

-- Create table for automation rules
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for automation logs
CREATE TABLE public.automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trigger_data JSONB,
  action_result JSONB,
  status TEXT NOT NULL DEFAULT 'success'
);

-- Create index for automation logs
CREATE INDEX idx_automation_logs_rule_id ON public.automation_logs(rule_id);
CREATE INDEX idx_automation_logs_triggered_at ON public.automation_logs(triggered_at);

-- Add column to tasks to track active time entry
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS active_time_entry_id UUID;

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow all on time_entries" ON public.time_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on automation_rules" ON public.automation_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on automation_logs" ON public.automation_logs FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for updating automation_rules updated_at
CREATE TRIGGER update_automation_rules_updated_at
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default automation rules
INSERT INTO public.automation_rules (name, description, trigger_type, trigger_config, action_type, action_config) VALUES
('Follow-up Em Espera', 'Alerta quando tarefa está em espera por mais de 3 dias', 'on_hold_days', '{"days": 3}', 'alert', '{"message": "Tarefa em espera por mais de 3 dias, considere fazer follow-up"}'),
('Prazo Próximo', 'Alerta quando prazo está a 1 dia de vencer', 'due_date_approaching', '{"days_before": 1}', 'alert', '{"message": "Prazo vence amanhã!"}'),
('Tarefa Parada', 'Alerta quando tarefa em andamento não tem atividade por 2 dias', 'stale_task', '{"days": 2}', 'alert', '{"message": "Tarefa sem atividade por 2 dias"}');