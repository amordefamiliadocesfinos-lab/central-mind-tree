-- Consolida linhas de estoque legadas sem localização definida no local padrão "Fábrica"
WITH ghosts AS (
  SELECT product_id, sum(quantity) AS qty
  FROM public.inventory
  WHERE location IS NULL OR btrim(location) = ''
  GROUP BY product_id
)
INSERT INTO public.inventory (product_id, location, quantity, updated_at)
SELECT g.product_id, 'Fábrica', g.qty, now() FROM ghosts g
ON CONFLICT (product_id, location)
DO UPDATE SET quantity = public.inventory.quantity + EXCLUDED.quantity, updated_at = now();

DELETE FROM public.inventory WHERE location IS NULL OR btrim(location) = '';

-- Impede novas linhas fantasma sem localização
ALTER TABLE public.inventory ALTER COLUMN location SET DEFAULT 'Fábrica';
UPDATE public.inventory SET location = 'Fábrica' WHERE location IS NULL;
ALTER TABLE public.inventory ALTER COLUMN location SET NOT NULL;