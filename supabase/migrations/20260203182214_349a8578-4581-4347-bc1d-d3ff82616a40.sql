-- Add order_type column to orders table
-- 'stock' = Venda de Estoque (consome do estoque acabado, sem gerar OP)
-- 'production' = Produção (gera OP e segue fluxo de produção)
ALTER TABLE public.orders 
ADD COLUMN order_type text NOT NULL DEFAULT 'production';

-- Add a comment for clarity
COMMENT ON COLUMN public.orders.order_type IS 'Type of order: stock (consumes finished goods, no production order) or production (generates production order)';