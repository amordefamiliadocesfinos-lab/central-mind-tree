-- OP-02: memória mínima e reutilizável de Produto Shopee/variação → Produto Mestre.
CREATE TABLE IF NOT EXISTS public.marketplace_product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace text NOT NULL,
  marketplace_account text NOT NULL,
  external_item_key text NOT NULL,
  external_product_title text,
  external_variation text,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  physical_multiplier numeric NOT NULL DEFAULT 1 CHECK (physical_multiplier > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (marketplace, marketplace_account, external_item_key)
);

ALTER TABLE public.marketplace_product_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage marketplace product mappings"
  ON public.marketplace_product_mappings FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
