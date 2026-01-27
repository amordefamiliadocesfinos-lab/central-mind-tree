-- Create table for dynamic platforms
CREATE TABLE public.digital_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📱',
  group_type TEXT NOT NULL DEFAULT 'social', -- social, ecommerce, marketplace, other
  aspect_ratio TEXT,
  duration TEXT,
  fields TEXT[] DEFAULT ARRAY['caption', 'cta'],
  checklist_template JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digital_platforms ENABLE ROW LEVEL SECURITY;

-- Create policy for full access
CREATE POLICY "Allow all on digital_platforms" 
ON public.digital_platforms 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Also enable RLS on existing tables that were missing it
ALTER TABLE public.digital_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for the other tables
CREATE POLICY "Allow all on digital_ideas" 
ON public.digital_ideas 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all on digital_variations" 
ON public.digital_variations 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all on digital_media" 
ON public.digital_media 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all on digital_templates" 
ON public.digital_templates 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Insert default platforms (social media)
INSERT INTO public.digital_platforms (name, icon, group_type, aspect_ratio, duration, fields, checklist_template, order_index) VALUES
('Instagram Feed', '📷', 'social', '1:1 / 4:5', NULL, ARRAY['caption', 'hashtags', 'cta', 'cover_url'], '[{"id": "img-size", "text": "Imagem 1080x1080 ou 1080x1350?"}, {"id": "caption", "text": "Legenda otimizada?"}, {"id": "hashtags", "text": "Hashtags relevantes (max 30)?"}, {"id": "cta", "text": "CTA incluído?"}]', 1),
('Instagram Reels', '🎬', 'social', '9:16', '15-90s', ARRAY['caption', 'hashtags', 'cta', 'cover_url', 'music'], '[{"id": "vertical", "text": "Vídeo vertical 9:16?"}, {"id": "duration", "text": "Duração entre 15-90s?"}, {"id": "cover", "text": "Capa personalizada?"}, {"id": "music", "text": "Música adicionada?"}]', 2),
('Instagram Stories', '📱', 'social', '9:16', '15s', ARRAY['caption', 'cta', 'link'], '[{"id": "vertical", "text": "Formato vertical 9:16?"}, {"id": "cta", "text": "Sticker de CTA?"}, {"id": "link", "text": "Link adicionado?"}]', 3),
('YouTube Long', '📺', 'social', '16:9', NULL, ARRAY['title', 'description', 'tags', 'thumbnail_url', 'cta', 'chapters', 'playlist'], '[{"id": "thumb", "text": "Thumbnail atrativa (1280x720)?"}, {"id": "title", "text": "Título otimizado (max 60 chars)?"}, {"id": "desc", "text": "Descrição com links e capítulos?"}, {"id": "tags", "text": "Tags relevantes?"}, {"id": "cta", "text": "CTA no final?"}, {"id": "end-screen", "text": "End screen configurado?"}]', 4),
('YouTube Shorts', '⚡', 'social', '9:16', '60s max', ARRAY['title', 'description', 'tags', 'cta'], '[{"id": "vertical", "text": "Vídeo vertical 9:16?"}, {"id": "duration", "text": "Máximo 60 segundos?"}, {"id": "hook", "text": "Hook nos primeiros 3s?"}, {"id": "title", "text": "Título com #shorts?"}]', 5),
('TikTok', '🎵', 'social', '9:16', NULL, ARRAY['caption', 'hashtags', 'music', 'cta', 'cover_url'], '[{"id": "vertical", "text": "Vídeo vertical 9:16?"}, {"id": "hook", "text": "Hook nos primeiros 2s?"}, {"id": "music", "text": "Música viral adicionada?"}, {"id": "hashtags", "text": "Hashtags virais?"}, {"id": "cta", "text": "CTA no final?"}]', 6),
('Facebook Post', '📘', 'social', NULL, NULL, ARRAY['caption', 'link', 'cta'], '[{"id": "text", "text": "Texto envolvente?"}, {"id": "link", "text": "Link preview ok?"}, {"id": "cta", "text": "CTA claro?"}]', 7),
('Facebook Vídeo', '🎥', 'social', '16:9 / 9:16', NULL, ARRAY['title', 'description', 'cta'], '[{"id": "thumb", "text": "Thumbnail atrativa?"}, {"id": "captions", "text": "Legendas automáticas?"}, {"id": "cta", "text": "CTA no vídeo?"}]', 8),
('Facebook Carrossel', '🎠', 'social', NULL, NULL, ARRAY['caption', 'link', 'cta'], '[{"id": "cards", "text": "Mínimo 2 cards?"}, {"id": "cta", "text": "CTA por card?"}]', 9),
-- E-commerce
('Nuvemshop', '🛒', 'ecommerce', NULL, NULL, ARRAY['title', 'description', 'cta', 'link'], '[{"id": "title", "text": "Título do produto?"}, {"id": "desc", "text": "Descrição completa?"}, {"id": "images", "text": "Imagens de qualidade?"}, {"id": "price", "text": "Preço configurado?"}]', 10),
-- Marketplaces
('Mercado Livre', '🟡', 'marketplace', NULL, NULL, ARRAY['title', 'description', 'cta', 'link'], '[{"id": "title", "text": "Título otimizado?"}, {"id": "desc", "text": "Descrição detalhada?"}, {"id": "images", "text": "Mínimo 3 fotos?"}, {"id": "ficha", "text": "Ficha técnica completa?"}]', 11),
('Shopee', '🧡', 'marketplace', NULL, NULL, ARRAY['title', 'description', 'cta', 'link'], '[{"id": "title", "text": "Título com palavras-chave?"}, {"id": "desc", "text": "Descrição atrativa?"}, {"id": "images", "text": "Fotos em alta resolução?"}, {"id": "video", "text": "Vídeo do produto?"}]', 12);

-- Create trigger for updated_at
CREATE TRIGGER update_digital_platforms_updated_at
BEFORE UPDATE ON public.digital_platforms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();