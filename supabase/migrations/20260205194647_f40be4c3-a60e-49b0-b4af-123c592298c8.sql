-- Add idea_type column to digital_ideas
ALTER TABLE public.digital_ideas 
ADD COLUMN idea_type text NOT NULL DEFAULT 'conteudo';

-- Add comment for documentation
COMMENT ON COLUMN public.digital_ideas.idea_type IS 'Type of idea: conteudo, anuncio, cadastro, campanha';