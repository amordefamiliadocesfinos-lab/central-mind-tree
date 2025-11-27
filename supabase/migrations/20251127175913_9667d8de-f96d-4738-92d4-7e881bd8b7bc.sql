-- Create nodes table
CREATE TABLE public.nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID REFERENCES public.nodes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT NOT NULL CHECK (color IN ('roxo', 'vermelho', 'amarelo', 'verde')),
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is a simple single-user app)
CREATE POLICY "Allow all operations on nodes" 
ON public.nodes 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Insert root node
INSERT INTO public.nodes (title, parent_id, color) 
VALUES ('Deividi', NULL, 'roxo');