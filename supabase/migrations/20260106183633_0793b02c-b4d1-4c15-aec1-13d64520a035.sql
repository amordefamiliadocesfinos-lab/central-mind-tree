-- Add source_order_id column to production_orders to link to sales orders
ALTER TABLE public.production_orders 
ADD COLUMN source_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_production_orders_source_order_id ON public.production_orders(source_order_id);