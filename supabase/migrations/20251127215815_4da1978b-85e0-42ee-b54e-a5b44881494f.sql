-- Habilitar realtime para a tabela nodes
ALTER TABLE public.nodes REPLICA IDENTITY FULL;

-- Adicionar a tabela nodes à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes;