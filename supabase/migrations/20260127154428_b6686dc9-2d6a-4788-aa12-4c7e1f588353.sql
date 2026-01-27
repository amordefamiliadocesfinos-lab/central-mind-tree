-- Table for storing trend searches and results
CREATE TABLE public.digital_trends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  niche TEXT,
  results JSONB DEFAULT '[]'::jsonb,
  insights TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digital_trends ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "Allow all on digital_trends" ON public.digital_trends FOR ALL USING (true) WITH CHECK (true);

-- Table for customer service knowledge base
CREATE TABLE public.digital_knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id UUID REFERENCES public.digital_platforms(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digital_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "Allow all on digital_knowledge_base" ON public.digital_knowledge_base FOR ALL USING (true) WITH CHECK (true);

-- Table for customer interactions (DMs, comments, funnel)
CREATE TABLE public.digital_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id UUID REFERENCES public.digital_platforms(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES public.digital_variations(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_handle TEXT,
  interaction_type TEXT NOT NULL DEFAULT 'comment', -- comment, dm, mention
  funnel_stage TEXT NOT NULL DEFAULT 'lead', -- lead, interested, engaged, customer
  content TEXT NOT NULL,
  ai_suggested_response TEXT,
  actual_response TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, responded, ignored
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digital_interactions ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "Allow all on digital_interactions" ON public.digital_interactions FOR ALL USING (true) WITH CHECK (true);

-- Update timestamp trigger for new tables
CREATE TRIGGER update_digital_trends_updated_at
  BEFORE UPDATE ON public.digital_trends
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_digital_knowledge_base_updated_at
  BEFORE UPDATE ON public.digital_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_digital_interactions_updated_at
  BEFORE UPDATE ON public.digital_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();