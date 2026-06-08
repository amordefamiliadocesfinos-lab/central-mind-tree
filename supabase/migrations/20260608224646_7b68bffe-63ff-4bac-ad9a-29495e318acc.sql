ALTER TABLE public.digital_ideas
  ADD COLUMN IF NOT EXISTS seasonal_day_id uuid REFERENCES public.seasonal_days(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seasonal_date date;
CREATE INDEX IF NOT EXISTS idx_digital_ideas_seasonal_day_id ON public.digital_ideas(seasonal_day_id);
CREATE INDEX IF NOT EXISTS idx_digital_ideas_seasonal_date ON public.digital_ideas(seasonal_date);