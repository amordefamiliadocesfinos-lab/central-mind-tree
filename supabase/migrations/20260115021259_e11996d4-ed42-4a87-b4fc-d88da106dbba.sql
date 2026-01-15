-- Drop the old posts table and recreate with new structure for Digital module
-- Ideas table (main content ideas)
CREATE TABLE IF NOT EXISTS public.digital_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  objective TEXT,
  target_audience TEXT,
  key_message TEXT,
  kpi TEXT,
  status TEXT NOT NULL DEFAULT 'estrutural' CHECK (status IN ('estrutural', 'andamento', 'pendente', 'concluido')),
  order_index INTEGER DEFAULT 0,
  node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
  media_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Platform variations table (one idea can have multiple platform variations)
CREATE TABLE IF NOT EXISTS public.digital_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  idea_id UUID NOT NULL REFERENCES public.digital_ideas(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram_feed', 'instagram_reels', 'instagram_stories', 'youtube_long', 'youtube_shorts', 'tiktok', 'facebook_post', 'facebook_video', 'facebook_carousel')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('estrutural', 'andamento', 'pendente', 'concluido')),
  -- Common fields
  title TEXT,
  description TEXT,
  caption TEXT,
  hashtags TEXT,
  cta TEXT,
  cover_url TEXT,
  -- Platform specific
  aspect_ratio TEXT,
  duration_seconds INTEGER,
  resolution TEXT,
  tags TEXT,
  music TEXT,
  link TEXT,
  chapters TEXT,
  playlist TEXT,
  thumbnail_url TEXT,
  -- Scheduling
  scheduled_date DATE,
  scheduled_time TIME,
  -- Metrics (manual input)
  metric_reach INTEGER,
  metric_engagement INTEGER,
  metric_clicks INTEGER,
  metric_retention DECIMAL(5,2),
  metric_ctr DECIMAL(5,2),
  -- Media
  media_urls JSONB DEFAULT '[]'::jsonb,
  -- Checklist
  checklist JSONB DEFAULT '[]'::jsonb,
  -- Template
  is_template BOOLEAN DEFAULT false,
  template_name TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Templates table for reusable platform configurations
CREATE TABLE IF NOT EXISTS public.digital_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram_feed', 'instagram_reels', 'instagram_stories', 'youtube_long', 'youtube_shorts', 'tiktok', 'facebook_post', 'facebook_video', 'facebook_carousel')),
  config JSONB DEFAULT '{}'::jsonb,
  checklist_template JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Media library table
CREATE TABLE IF NOT EXISTS public.digital_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  filename TEXT,
  file_type TEXT,
  file_size INTEGER,
  tags TEXT[],
  idea_id UUID REFERENCES public.digital_ideas(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES public.digital_variations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.digital_ideas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.digital_variations;

-- Create update trigger for ideas
CREATE TRIGGER update_digital_ideas_updated_at
  BEFORE UPDATE ON public.digital_ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create update trigger for variations
CREATE TRIGGER update_digital_variations_updated_at
  BEFORE UPDATE ON public.digital_variations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();