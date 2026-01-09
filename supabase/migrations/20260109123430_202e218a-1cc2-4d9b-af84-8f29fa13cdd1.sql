
-- Create ai_insights table for storing AI-generated insights
CREATE TABLE public.ai_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  area TEXT NOT NULL CHECK (area IN ('Financeiro', 'Projetos', 'Tempo', 'Recursos')),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'media' CHECK (severity IN ('baixa', 'media', 'alta')),
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  impact DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK (impact >= 0 AND impact <= 1),
  risk DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK (risk >= 0 AND risk <= 1),
  decision JSONB,
  status TEXT NOT NULL DEFAULT 'proposto' CHECK (status IN ('proposto', 'aprovado', 'executado', 'rejeitado')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_actions table for storing executed actions
CREATE TABLE public.ai_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_id UUID NOT NULL REFERENCES public.ai_insights(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ok', 'erro')),
  result TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  executed_at TIMESTAMP WITH TIME ZONE
);

-- Create ai_policies table for governance
CREATE TABLE public.ai_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area TEXT NOT NULL UNIQUE CHECK (area IN ('Financeiro', 'Projetos', 'Tempo', 'Recursos')),
  autopilot BOOLEAN NOT NULL DEFAULT false,
  max_risk DECIMAL(3,2) NOT NULL DEFAULT 0.4 CHECK (max_risk >= 0 AND max_risk <= 1),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default policies for each area
INSERT INTO public.ai_policies (area, autopilot, max_risk) VALUES
  ('Financeiro', false, 0.3),
  ('Projetos', false, 0.4),
  ('Tempo', false, 0.5),
  ('Recursos', false, 0.4);

-- Create indexes for better query performance
CREATE INDEX idx_ai_insights_status ON public.ai_insights(status);
CREATE INDEX idx_ai_insights_area ON public.ai_insights(area);
CREATE INDEX idx_ai_insights_created_at ON public.ai_insights(created_at DESC);
CREATE INDEX idx_ai_actions_insight_id ON public.ai_actions(insight_id);
CREATE INDEX idx_ai_actions_status ON public.ai_actions(status);

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_policies ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since app doesn't have auth yet)
CREATE POLICY "Allow all operations on ai_insights" ON public.ai_insights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on ai_actions" ON public.ai_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on ai_policies" ON public.ai_policies FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for ai_insights
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_insights;

-- Create trigger to update updated_at
CREATE TRIGGER update_ai_insights_updated_at
  BEFORE UPDATE ON public.ai_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_policies_updated_at
  BEFORE UPDATE ON public.ai_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
