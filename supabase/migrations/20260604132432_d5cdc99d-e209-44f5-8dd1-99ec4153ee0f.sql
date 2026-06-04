ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS lost_reason text,
ADD COLUMN IF NOT EXISTS lost_reason_detail text,
ADD COLUMN IF NOT EXISTS lost_at timestamptz;