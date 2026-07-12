ALTER TABLE public.routine_blocks ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
UPDATE public.routine_blocks SET is_active = true WHERE is_active IS DISTINCT FROM true;
CREATE INDEX IF NOT EXISTS idx_routine_blocks_active_date ON public.routine_blocks (date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_routine_blocks_active_user_date ON public.routine_blocks (assigned_user_id, date) WHERE is_active = true;