-- Enable RLS on ai_insight_messages
ALTER TABLE public.ai_insight_messages ENABLE ROW LEVEL SECURITY;

-- Allow all operations (this is an internal tool, no auth required)
CREATE POLICY "Allow all operations on ai_insight_messages"
ON public.ai_insight_messages
FOR ALL
USING (true)
WITH CHECK (true);