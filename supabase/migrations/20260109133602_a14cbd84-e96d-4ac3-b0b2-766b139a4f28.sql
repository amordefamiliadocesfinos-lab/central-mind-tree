-- Create table for AI insight chat messages
CREATE TABLE public.ai_insight_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_id UUID NOT NULL REFERENCES public.ai_insights(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_ai_insight_messages_insight_id ON public.ai_insight_messages(insight_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_insight_messages;