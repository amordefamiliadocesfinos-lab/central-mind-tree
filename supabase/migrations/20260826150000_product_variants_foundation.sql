-- FASE 2.5B: Produto Mestre + Variação Física.
-- Não migra produtos existentes e não altera estoque, pedidos ou produção.
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sku text NOT NULL UNIQUE CHECK (btrim(sku) <> ''),
  variant_name text NOT NULL CHECK (btrim(variant_name) <> ''),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit text,
  is_active boolean NOT NULL DEFAULT true,
  cost_override numeric(20, 10),
  price_override numeric(20, 10),
  weight_g numeric(20, 10),
  height_cm numeric(20, 10),
  width_cm numeric(20, 10),
  length_cm numeric(20, 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_variants_product_id_idx ON public.product_variants(product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on product_variants"
  ON public.product_variants FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_tasks_updated_at();
