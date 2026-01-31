-- Add quality status and versioning fields to digital_media
ALTER TABLE public.digital_media 
ADD COLUMN IF NOT EXISTS quality_status text DEFAULT 'pending' CHECK (quality_status IN ('approved', 'review', 'low', 'pending')),
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_media_id uuid REFERENCES public.digital_media(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ai_enhanced boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS original_url text,
ADD COLUMN IF NOT EXISTS enhancement_type text;

-- Create index for versioning queries
CREATE INDEX IF NOT EXISTS idx_digital_media_parent ON public.digital_media(parent_media_id);
CREATE INDEX IF NOT EXISTS idx_digital_media_quality ON public.digital_media(quality_status);