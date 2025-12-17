-- Add order_index to nodes for manual ordering
ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- Add default hierarchy structure if empty (only on first setup)
-- This creates the base structure: Deividi > Financeiro / Saúde / Espiritual
-- Under Financeiro: Amor de Família / Digital

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_nodes_parent_order ON public.nodes(parent_id, order_index);

-- Create wizard_steps configuration table
CREATE TABLE IF NOT EXISTS public.wizard_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_key text NOT NULL UNIQUE,
  label text NOT NULL,
  module_route text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wizard_steps ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for wizard_steps
CREATE POLICY "Allow all on wizard_steps" ON public.wizard_steps FOR ALL USING (true) WITH CHECK (true);

-- Insert default wizard steps
INSERT INTO public.wizard_steps (step_key, label, module_route, order_index, is_active) VALUES
  ('priorities', 'Revisar Prioridades', '/planejamento', 0, true),
  ('overdue', 'Tarefas Atrasadas', '/planejamento', 1, true),
  ('calendar', 'Distribuir na Semana', '/calendario', 2, true),
  ('production', 'Planejamento de Produção', '/operacoes', 3, true),
  ('blocks', 'Blocos de Trabalho', '/rotina', 4, true),
  ('alerts', 'Alertas e Lembretes', NULL, 5, true),
  ('summary', 'Resumo Final', NULL, 6, true)
ON CONFLICT (step_key) DO NOTHING;