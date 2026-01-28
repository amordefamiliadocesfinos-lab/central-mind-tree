-- Add custom_field_values column to store dynamic custom field data
ALTER TABLE public.digital_variations 
ADD COLUMN IF NOT EXISTS custom_field_values JSONB DEFAULT '{}'::jsonb;