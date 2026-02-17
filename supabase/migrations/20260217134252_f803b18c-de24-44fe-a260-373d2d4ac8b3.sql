
-- Add custom fields definition and values to digital_ideas
ALTER TABLE public.digital_ideas 
ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_field_values jsonb DEFAULT '{}'::jsonb;
