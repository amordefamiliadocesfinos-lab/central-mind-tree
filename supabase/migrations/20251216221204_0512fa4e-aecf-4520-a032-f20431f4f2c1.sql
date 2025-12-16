-- BOM (Bill of Materials) table - components per product
CREATE TABLE public.product_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty_per_unit NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, component_id),
  CHECK (product_id != component_id)
);

-- Enable RLS
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all on product_components" ON public.product_components
  FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_product_components_product ON public.product_components(product_id);
CREATE INDEX idx_product_components_component ON public.product_components(component_id);