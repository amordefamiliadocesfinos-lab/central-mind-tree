
-- Add is_posted boolean for the primary scheduled date
ALTER TABLE public.digital_variations ADD COLUMN IF NOT EXISTS is_posted boolean NOT NULL DEFAULT false;

-- Add additional_dates JSONB array for extra posting dates
-- Format: [{"date": "2025-02-10", "time": "08:00", "posted": false}, ...]
ALTER TABLE public.digital_variations ADD COLUMN IF NOT EXISTS additional_dates jsonb DEFAULT '[]'::jsonb;
