-- Add media inheritance fields to digital_variations
ALTER TABLE public.digital_variations 
ADD COLUMN IF NOT EXISTS hidden_inherited_media jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS extra_media_ids jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS media_transforms jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS media_mode text DEFAULT 'inherit'::text;

-- Add comment for documentation
COMMENT ON COLUMN public.digital_variations.hidden_inherited_media IS 'IDs of inherited media from idea that are hidden in this variation';
COMMENT ON COLUMN public.digital_variations.extra_media_ids IS 'IDs of media specific to this variation only';
COMMENT ON COLUMN public.digital_variations.media_transforms IS 'Transform settings per media ID (preset, aspect, cover)';
COMMENT ON COLUMN public.digital_variations.media_mode IS 'inherit or custom - controls whether to inherit from idea';