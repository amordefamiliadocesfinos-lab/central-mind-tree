-- Add product_id column to digital_ideas for product linking
ALTER TABLE public.digital_ideas 
ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX idx_digital_ideas_product_id ON public.digital_ideas(product_id);
