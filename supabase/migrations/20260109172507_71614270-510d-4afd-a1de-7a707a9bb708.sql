-- Add routine_prefs table for user preferences
CREATE TABLE IF NOT EXISTS public.routine_prefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_hours_start TIME NOT NULL DEFAULT '08:00',
  work_hours_end TIME NOT NULL DEFAULT '18:00',
  breaks JSONB DEFAULT '[]'::jsonb,
  default_template_id UUID REFERENCES public.routine_templates(id) ON DELETE SET NULL,
  capacity_targets JSONB DEFAULT '{"deep_work_min": 180, "atendimento_min": 120}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add routine_stats table for daily statistics
CREATE TABLE IF NOT EXISTS public.routine_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  planned_min INTEGER NOT NULL DEFAULT 0,
  done_min INTEGER NOT NULL DEFAULT 0,
  deep_work_min INTEGER NOT NULL DEFAULT 0,
  atendimento_min INTEGER NOT NULL DEFAULT 0,
  context_switches INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.routine_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_stats ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all on routine_prefs" ON public.routine_prefs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on routine_stats" ON public.routine_stats FOR ALL USING (true) WITH CHECK (true);

-- Add new focus types to routine_blocks and templates by adding a focus column
ALTER TABLE public.routine_blocks ADD COLUMN IF NOT EXISTS focus TEXT DEFAULT 'trabalho_profundo';
ALTER TABLE public.routine_templates ADD COLUMN IF NOT EXISTS focus TEXT DEFAULT 'trabalho_profundo';

-- Create index for faster date queries
CREATE INDEX IF NOT EXISTS idx_routine_stats_date ON public.routine_stats(date);
CREATE INDEX IF NOT EXISTS idx_routine_blocks_date_focus ON public.routine_blocks(date, focus);

-- Enable realtime for routine tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.routine_prefs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.routine_stats;