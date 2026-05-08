CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read product_categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Allow all insert product_categories" ON public.product_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update product_categories" ON public.product_categories FOR UPDATE USING (true);
CREATE POLICY "Allow all delete product_categories" ON public.product_categories FOR DELETE USING (true);

CREATE TRIGGER update_product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.product_categories (name, order_index) VALUES
  ('Estrutural', 0),
  ('Alimentos', 1),
  ('Bebidas', 2),
  ('Doces', 3),
  ('Salgados', 4),
  ('Embalagens', 5),
  ('Insumos', 6),
  ('Outros', 7);

ALTER PUBLICATION supabase_realtime ADD TABLE public.product_categories;