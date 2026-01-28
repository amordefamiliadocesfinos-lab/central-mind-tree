-- Create table for media folders
CREATE TABLE public.digital_media_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digital_media_folders ENABLE ROW LEVEL SECURITY;

-- Allow all operations (single-user app)
CREATE POLICY "Allow all on digital_media_folders"
  ON public.digital_media_folders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add folder_id to digital_media
ALTER TABLE public.digital_media 
ADD COLUMN folder_id UUID REFERENCES public.digital_media_folders(id) ON DELETE SET NULL;