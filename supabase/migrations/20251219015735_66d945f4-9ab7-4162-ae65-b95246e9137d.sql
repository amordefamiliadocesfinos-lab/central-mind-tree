-- Create storage locations table
CREATE TABLE public.storage_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all on storage_locations" ON public.storage_locations
  FOR ALL USING (true) WITH CHECK (true);

-- Insert default locations
INSERT INTO public.storage_locations (name, description) VALUES
  ('Fábrica', 'Local de produção principal'),
  ('CD01', 'Centro de Distribuição 01'),
  ('CD02', 'Centro de Distribuição 02');

-- Modify inventory table to support multiple locations per product
-- First, drop the unique constraint if it exists
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_product_id_key;

-- Add unique constraint on product_id + location combination
ALTER TABLE public.inventory ADD CONSTRAINT inventory_product_location_unique UNIQUE (product_id, location);

-- Add location_id reference (optional, keeping location as text for flexibility)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.storage_locations(id);

-- Add transfer movement type support (already in movements table as text)
-- Add from_location and to_location columns to inventory_movements for transfers
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS from_location text;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS to_location text;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS location text;

-- Create unique constraint for product_components to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_components_product_component_unique'
  ) THEN
    ALTER TABLE public.product_components 
    ADD CONSTRAINT product_components_product_component_unique UNIQUE (product_id, component_id);
  END IF;
END $$;