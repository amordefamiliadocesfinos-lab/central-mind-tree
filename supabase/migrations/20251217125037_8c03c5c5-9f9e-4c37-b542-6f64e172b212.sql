-- Em Espera (On Hold) fields for tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS on_hold BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS on_hold_who TEXT,
ADD COLUMN IF NOT EXISTS on_hold_channel TEXT,
ADD COLUMN IF NOT EXISTS on_hold_deadline DATE,
ADD COLUMN IF NOT EXISTS on_hold_note TEXT,
ADD COLUMN IF NOT EXISTS on_hold_created_at TIMESTAMP WITH TIME ZONE;

-- Task merge history for undo functionality
CREATE TABLE IF NOT EXISTS public.task_merge_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merged_task_ids UUID[] NOT NULL,
  target_task_id UUID NOT NULL,
  merged_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '10 minutes')
);

-- Enable RLS on task_merge_history
ALTER TABLE public.task_merge_history ENABLE ROW LEVEL SECURITY;

-- Allow all operations on task_merge_history (following existing pattern)
CREATE POLICY "Allow all on task_merge_history" ON public.task_merge_history
  AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);

-- On hold follow-up log
CREATE TABLE IF NOT EXISTS public.on_hold_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  previous_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on on_hold_log
ALTER TABLE public.on_hold_log ENABLE ROW LEVEL SECURITY;

-- Allow all operations on on_hold_log
CREATE POLICY "Allow all on on_hold_log" ON public.on_hold_log
  AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);