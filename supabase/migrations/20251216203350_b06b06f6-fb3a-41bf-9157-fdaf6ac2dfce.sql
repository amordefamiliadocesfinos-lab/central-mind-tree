-- Enhanced products table with category, attributes, media
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cover_image_url TEXT DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS expiry_days INTEGER DEFAULT NULL;

-- Inventory movements table for tracking all stock changes
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'reserve', 'consume', 'adjust')),
  quantity INTEGER NOT NULL,
  previous_balance INTEGER NOT NULL DEFAULT 0,
  new_balance INTEGER NOT NULL DEFAULT 0,
  reference_type TEXT DEFAULT NULL,
  reference_id UUID DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT DEFAULT NULL
);

-- Enable RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS policy for inventory_movements
CREATE POLICY "Allow all on inventory_movements" ON public.inventory_movements
  FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON public.inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON public.inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);