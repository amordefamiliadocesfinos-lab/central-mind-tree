-- Create table to store AI assistant chat messages
CREATE TABLE public.ai_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth in this app)
CREATE POLICY "Allow all on ai_chat_messages" 
ON public.ai_chat_messages 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for faster ordering
CREATE INDEX idx_ai_chat_messages_created_at ON public.ai_chat_messages(created_at DESC);