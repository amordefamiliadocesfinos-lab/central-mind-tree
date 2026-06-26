ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS height_cm numeric(20,10),
  ADD COLUMN IF NOT EXISTS width_cm numeric(20,10),
  ADD COLUMN IF NOT EXISTS length_cm numeric(20,10),
  ADD COLUMN IF NOT EXISTS weight_g numeric(20,10);