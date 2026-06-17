ALTER TABLE public.routine_blocks 
  ADD COLUMN IF NOT EXISTS recurrence text,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES public.routine_blocks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_routine_blocks_recurrence_parent ON public.routine_blocks(recurrence_parent_id);