ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS operation_nature TEXT;