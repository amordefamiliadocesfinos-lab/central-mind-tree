-- Create timer_state table
CREATE TABLE public.timer_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remaining_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('stopped', 'running', 'paused')),
  last_update TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.timer_state ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on timer_state"
ON public.timer_state
FOR ALL
USING (true)
WITH CHECK (true);

-- Insert default timer state (single row)
INSERT INTO public.timer_state (remaining_seconds, status) VALUES (0, 'stopped');