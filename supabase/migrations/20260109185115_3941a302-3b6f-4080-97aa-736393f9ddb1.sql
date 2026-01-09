-- Create seasonal_days table for seasonal/recurring events
CREATE TABLE public.seasonal_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#F59E0B',
  importance INTEGER NOT NULL DEFAULT 2 CHECK (importance >= 1 AND importance <= 3),
  
  -- Recurrence type: 'fixed' (same date), 'nth_weekday' (e.g., 2nd Monday of November), 'range' (date range)
  recurrence_type TEXT NOT NULL DEFAULT 'fixed' CHECK (recurrence_type IN ('fixed', 'nth_weekday', 'range')),
  
  -- For fixed and range: month (1-12), day (1-31)
  month INTEGER CHECK (month >= 1 AND month <= 12),
  day INTEGER CHECK (day >= 1 AND day <= 31),
  
  -- For range type: end month/day
  end_month INTEGER CHECK (end_month >= 1 AND end_month <= 12),
  end_day INTEGER CHECK (end_day >= 1 AND end_day <= 31),
  
  -- For nth_weekday: which occurrence (1=first, 2=second, -1=last) and weekday (0=Sunday, 1=Monday, etc.)
  nth_occurrence INTEGER CHECK (nth_occurrence >= -1 AND nth_occurrence <= 5),
  weekday INTEGER CHECK (weekday >= 0 AND weekday <= 6),
  
  -- Preparation days before the event
  prep_days INTEGER NOT NULL DEFAULT 0,
  
  -- Reminders as JSON array: ["-30d", "-7d", "08:00"]
  reminders JSONB DEFAULT '[]'::jsonb,
  
  -- Auto-create tasks/nodes
  auto_tasks BOOLEAN NOT NULL DEFAULT false,
  auto_task_templates JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seasonal_days ENABLE ROW LEVEL SECURITY;

-- Allow all operations (single-user app, no auth)
CREATE POLICY "Allow all operations on seasonal_days"
  ON public.seasonal_days
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_seasonal_days_updated_at
  BEFORE UPDATE ON public.seasonal_days
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.seasonal_days;