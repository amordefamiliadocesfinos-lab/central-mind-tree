ALTER TABLE public.digital_platforms
ADD COLUMN IF NOT EXISTS structure_media_urls jsonb NOT NULL DEFAULT '[]'::jsonb;