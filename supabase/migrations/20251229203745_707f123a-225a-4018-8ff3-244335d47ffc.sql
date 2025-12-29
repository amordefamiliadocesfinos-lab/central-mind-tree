-- Alterar colunas de custo e preço para suportar precisão total (até 10 casas decimais)
-- Isso permite valores como 0,0079166667 (custo por grama)

ALTER TABLE public.products 
  ALTER COLUMN cost TYPE numeric(20, 10),
  ALTER COLUMN price TYPE numeric(20, 10);

-- Alterar também qty_per_unit em product_components para precisão total
ALTER TABLE public.product_components 
  ALTER COLUMN qty_per_unit TYPE numeric(20, 10);

-- Alterar colunas de custo em product_processes
ALTER TABLE public.product_processes 
  ALTER COLUMN cost_per_unit TYPE numeric(20, 10);

-- Alterar colunas de custo em product_optional_costs
ALTER TABLE public.product_optional_costs 
  ALTER COLUMN cost_per_unit TYPE numeric(20, 10);

-- Alterar colunas de valor em processes
ALTER TABLE public.processes 
  ALTER COLUMN value_per_unit TYPE numeric(20, 10);

-- Alterar colunas de preço unitário em order_items
ALTER TABLE public.order_items 
  ALTER COLUMN unit_price TYPE numeric(20, 10);

-- Alterar colunas de quantidade em inventory
ALTER TABLE public.inventory 
  ALTER COLUMN quantity TYPE numeric(20, 10);

-- Alterar colunas de quantidade em inventory_movements
ALTER TABLE public.inventory_movements 
  ALTER COLUMN quantity TYPE numeric(20, 10),
  ALTER COLUMN previous_balance TYPE numeric(20, 10),
  ALTER COLUMN new_balance TYPE numeric(20, 10);